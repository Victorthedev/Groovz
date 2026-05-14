import { randomUUID } from 'crypto'
import { prisma } from '../../shared/utils/prisma.js'
import { redis } from '../../shared/utils/redis.js'
import { serialiseSession, serialisePool } from '../../shared/utils/redis-serialise.js'
import { createSession } from './engine/generator.js'
import { expandFromSeed, expandFromPrompt } from './engine/expander.js'
import { extractIntent, embedText } from './clients/huggingface.js'
import { resolveDisplayId } from '../auth/platform.service.js'
import { playlistGenerationQueue } from '../../jobs/playlist-generation.job.js'
import type { PlaylistBlueprint, Intent } from '../../shared/types/index.js'

const SESSION_TTL = 60 * 10   // 10 minutes (§4 Redis TTL)
const POOL_TTL    = 60 * 10

export interface GenerateInput {
  userId: string
  type: 'seed' | 'prompt' | 'hybrid'
  platform: string
  seedDisplayId?: string
  prompt?: string
  intent?: {
    energy?: 'low' | 'medium' | 'high'
    tempo?: 'slow' | 'medium' | 'fast'
    mood?: string[]
    durationMinutes?: number
  }
}

export async function startGeneration(input: GenerateInput): Promise<{ jobId: string; blueprintId: string }> {
  // Capability check — never trust frontend-provided limits (§15)
  const caps = await prisma.userCapabilities.findUnique({ where: { userId: input.userId } })
  if (!caps) throw Object.assign(new Error('Capabilities not found'), { statusCode: 500 })

  if (caps.playlistsGeneratedThisMonth >= caps.maxPlaylistsPerMonth) {
    throw Object.assign(new Error('Monthly playlist limit reached'), { statusCode: 403 })
  }

  // Resolve duration
  const requestedMinutes = input.intent?.durationMinutes
  const maxMinutes = caps.maxPlaylistDurationMinutes
  const targetMinutes = requestedMinutes
    ? Math.min(requestedMinutes, maxMinutes)
    : 60
  const targetDurationMs = targetMinutes * 60_000

  // If requesting >120 min on free tier, the route layer should have caught this.
  // Belt-and-suspenders: clamp silently here.

  // Resolve seed track if provided
  let seedTitle: string | undefined
  let seedArtist: string | undefined
  if (input.seedDisplayId) {
    const resolved = await resolveDisplayId(input.userId, input.seedDisplayId)
    if (!resolved) throw Object.assign(new Error('Seed track not found — refetch library'), { statusCode: 400 })
    seedTitle = resolved.title
    seedArtist = resolved.artist
  }

  // Extract intent and embedding for prompt/hybrid modes
  let intent: Intent | undefined
  let promptEmbedding: number[] | undefined
  let embeddingFailed = false

  if (input.prompt) {
    try {
      intent = await extractIntent(input.prompt)
      // Merge explicit intent fields from request body (override HF extraction)
      if (input.intent?.energy) intent.energy = input.intent.energy
      if (input.intent?.tempo)  intent.tempo  = input.intent.tempo
      if (input.intent?.mood)   intent.mood   = input.intent.mood
    } catch {
      // §5.7 embedding service failure — run with whatever we have
      embeddingFailed = true
      intent = buildIntentFromInput(input.intent)
    }

    try {
      promptEmbedding = await embedText(input.prompt)
    } catch {
      embeddingFailed = true
    }
  } else {
    intent = buildIntentFromInput(input.intent)
  }

  // Expand candidate pool
  const pool = input.type === 'prompt'
    ? await expandFromPrompt(intent ?? {}, targetDurationMs)
    : await expandFromSeed(seedTitle!, seedArtist!, targetDurationMs)

  // Create session
  const session = createSession({
    userId: input.userId,
    generationType: input.type,
    targetPlatform: input.platform,
    targetDurationMs,
    seedTrackTitle: seedTitle,
    seedTrackArtist: seedArtist,
    intent,
    promptEmbedding,
    embeddingFailed,
  })

  // Persist session + pool to Redis
  await Promise.all([
    redis.setex(`session:${session.sessionId}`, SESSION_TTL, serialiseSession(session)),
    redis.setex(`pool:${session.sessionId}`, POOL_TTL, serialisePool(pool)),
  ])

  // Create placeholder PlaylistRecord
  const blueprintId = randomUUID()
  const record = await prisma.playlistRecord.create({
    data: {
      id: blueprintId,
      userId: input.userId,
      platform: input.platform,
      generationType: input.type,
      seedTrackTitle: seedTitle,
      seedTrackArtist: seedArtist,
      promptSummary: input.prompt?.slice(0, 120),
      durationMinutes: targetMinutes,
      trackCount: 0,  // updated when job completes
    },
  })

  // Increment monthly counter
  await prisma.userCapabilities.update({
    where: { userId: input.userId },
    data: { playlistsGeneratedThisMonth: { increment: 1 } },
  })

  // Queue job
  const job = await playlistGenerationQueue.add('generate', {
    sessionId: session.sessionId,
    userId: input.userId,
    playlistRecordId: record.id,
  })

  return { jobId: job.id!, blueprintId }
}

export async function getBlueprint(blueprintId: string): Promise<PlaylistBlueprint | null> {
  const raw = await redis.get(`blueprint:${blueprintId}`)
  if (!raw) return null
  return JSON.parse(raw) as PlaylistBlueprint
}

export async function getHistory(userId: string) {
  return prisma.playlistRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      platform: true,
      generationType: true,
      seedTrackTitle: true,
      seedTrackArtist: true,
      promptSummary: true,
      durationMinutes: true,
      trackCount: true,
      platformPlaylistUrl: true,
      createdAt: true,
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildIntentFromInput(raw?: GenerateInput['intent']): Intent | undefined {
  if (!raw) return undefined
  return {
    energy: raw.energy,
    tempo: raw.tempo,
    mood: raw.mood,
    durationRequestedMs: raw.durationMinutes ? raw.durationMinutes * 60_000 : undefined,
  }
}
