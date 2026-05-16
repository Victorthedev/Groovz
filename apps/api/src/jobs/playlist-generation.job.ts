import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { generate } from '../modules/recommendation/engine/generator.js'
import {
  deserialiseSession,
  deserialisePool,
} from '../shared/utils/redis-serialise.js'
import { getIO } from '../shared/utils/socket.js'
import { prisma } from '../shared/utils/prisma.js'
import { generateNarrative } from '../modules/recommendation/clients/huggingface.js'

const SESSION_KEY   = (id: string) => `session:${id}`
const POOL_KEY      = (id: string) => `pool:${id}`
const BLUEPRINT_KEY = (id: string) => `blueprint:${id}`
const BLUEPRINT_TTL = 60 * 60 * 24  // 24 hours

function makeConnection() {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,  // required by BullMQ
    enableReadyCheck: false,
  })
}

export interface PlaylistGenerationJobData {
  sessionId: string
  userId: string
  playlistRecordId: string
  promptHash?: string
  contextCardId?: string
  blendSessionId?: string
  blendParticipantRecordIds?: string  // JSON: Record<userId, recordId>
}

export const playlistGenerationQueue = new Queue<PlaylistGenerationJobData>(
  'playlist-generation',
  { connection: makeConnection() },
)

export function startPlaylistGenerationWorker() {
  const worker = new Worker<PlaylistGenerationJobData>(
    'playlist-generation',
    async (job) => {
      const { sessionId, userId, playlistRecordId, promptHash, contextCardId, blendSessionId, blendParticipantRecordIds } = job.data
      const conn = makeConnection()

      try {
        const [rawSession, rawPool] = await Promise.all([
          conn.get(SESSION_KEY(sessionId)),
          conn.get(POOL_KEY(sessionId)),
        ])

        if (!rawSession || !rawPool) {
          throw new Error(`Session or pool not found for ${sessionId}`)
        }

        const session = deserialiseSession(rawSession)
        const pool    = deserialisePool(rawPool)

        const blueprint = await generate(session, pool)

        // Align blueprint id with PlaylistRecord id so export can look it up by the same key
        blueprint.id = playlistRecordId
        await conn.setex(BLUEPRINT_KEY(playlistRecordId), BLUEPRINT_TTL, JSON.stringify(blueprint))

        // Generate narrative — non-blocking, failure never stops the playlist
        let narrative: string | undefined
        try {
          narrative = await generateNarrative(blueprint.tracks)
        } catch { /* narrative is optional */ }

        // Update PlaylistRecord with result
        await prisma.playlistRecord.update({
          where: { id: playlistRecordId },
          data: {
            trackCount: blueprint.tracks.length,
            durationMinutes: Math.round(blueprint.totalDurationMs / 60_000),
            narrative,
          },
        })

        // Record signal — full context for ML pipeline (§18.2)
        await prisma.userSignal.create({
          data: {
            userId,
            signalType: 'playlist_created',
            data: {
              generationType: blueprint.generationType,
              platform: session.targetPlatform,
              durationMs: blueprint.totalDurationMs,
              trackCount: blueprint.tracks.length,
              deepCuts: session.deepCuts || undefined,
              ...(session.seedTrackTitle && {
                seedTrack: { title: session.seedTrackTitle, artist: session.seedTrackArtist },
              }),
              ...(promptHash && { promptHash }),
              ...(contextCardId && { contextCard: contextCardId }),
              ...(session.intent && {
                intent: {
                  energy: session.intent.energy,
                  tempo: session.intent.tempo,
                  mood: session.intent.mood,
                  tags: session.intent.tags,
                },
              }),
            },
          },
        })

        if (blendSessionId) {
          // Update all other participants' PlaylistRecords with final track count and duration
          if (blendParticipantRecordIds) {
            const recordIds = JSON.parse(blendParticipantRecordIds) as Record<string, string>
            await Promise.all(
              Object.values(recordIds)
                .filter(id => id !== playlistRecordId)
                .map(id => prisma.playlistRecord.update({
                  where: { id },
                  data: {
                    trackCount: blueprint.tracks.length,
                    durationMinutes: Math.round(blueprint.totalDurationMs / 60_000),
                    narrative,
                  },
                }).catch(() => {})),
            )
          }

          // Update BlendSession status and emit to the blend room
          const { redis: sharedRedis } = await import('../shared/utils/redis.js')
          const rawBlend = await sharedRedis.get(`blend:session:${blendSessionId}`)
          if (rawBlend) {
            const blendSession = JSON.parse(rawBlend)
            blendSession.status = 'complete'
            blendSession.blueprintId = blueprint.id
            const ttl = Math.max(60, Math.floor((blendSession.expiresAt - Date.now()) / 1000))
            await sharedRedis.setex(`blend:session:${blendSessionId}`, ttl, JSON.stringify(blendSession))
          }

          getIO().to(`blend:${blendSessionId}`).emit('blend:ready', {
            sessionId: blendSessionId,
            blueprintId: blueprint.id,
          })
        } else {
          // §16.1 — standard playlist push
          getIO().to(`user:${userId}`).emit('playlist:ready', { blueprintId: blueprint.id })
        }

        return { blueprintId: blueprint.id }
      } finally {
        await conn.quit()
      }
    },
    { connection: makeConnection() },
  )

  worker.on('failed', (job, err) => {
    console.error(`[playlist-generation] job ${job?.id} failed`, err.message)
    try {
      const { blendSessionId, userId } = job?.data ?? {}
      if (blendSessionId) {
        getIO().to(`blend:${blendSessionId}`).emit('blend:failed', {
          sessionId: blendSessionId,
          reason: err.message,
        })
      } else {
        getIO().to(`user:${userId}`).emit('playlist:error', { error: err.message })
      }
    } catch { /* socket may not be ready on startup failures */ }
  })

  return worker
}
