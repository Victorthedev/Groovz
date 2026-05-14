import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { generate } from '../modules/recommendation/engine/generator.js'
import {
  deserialiseSession,
  deserialisePool,
} from '../shared/utils/redis-serialise.js'
import { getIO } from '../shared/utils/socket.js'
import { prisma } from '../shared/utils/prisma.js'

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
}

export const playlistGenerationQueue = new Queue<PlaylistGenerationJobData>(
  'playlist-generation',
  { connection: makeConnection() },
)

export function startPlaylistGenerationWorker() {
  const worker = new Worker<PlaylistGenerationJobData>(
    'playlist-generation',
    async (job) => {
      const { sessionId, userId, playlistRecordId } = job.data
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

        // Update PlaylistRecord with result
        await prisma.playlistRecord.update({
          where: { id: playlistRecordId },
          data: {
            trackCount: blueprint.tracks.length,
            durationMinutes: Math.round(blueprint.totalDurationMs / 60_000),
          },
        })

        // Record signal for ML pipeline
        await prisma.userSignal.create({
          data: {
            userId,
            signalType: 'playlist_created',
            data: {
              blueprintId: blueprint.id,
              generationType: blueprint.generationType,
              trackCount: blueprint.tracks.length,
              durationMs: blueprint.totalDurationMs,
            },
          },
        })

        // §16.1 — push to the user's socket room the moment generation is done
        getIO().to(`user:${userId}`).emit('playlist:ready', { blueprintId: blueprint.id })

        return { blueprintId: blueprint.id }
      } finally {
        await conn.quit()
      }
    },
    { connection: makeConnection() },
  )

  worker.on('failed', (job, err) => {
    console.error(`[playlist-generation] job ${job?.id} failed`, err.message)
    // §16.1 — push error to the user's socket room
    try {
      getIO().to(`user:${job?.data.userId}`).emit('playlist:error', { error: err.message })
    } catch { /* socket may not be ready on startup failures */ }
  })

  return worker
}
