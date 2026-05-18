import { randomUUID } from 'crypto'
import { prisma } from '../../shared/utils/prisma.js'
import { redis } from '../../shared/utils/redis.js'
import { serialiseSession, serialisePool } from '../../shared/utils/redis-serialise.js'
import { createSession } from './engine/generator.js'
import { expandFromSeed, expandFromPrompt, expandFromSeedDeepCuts } from './engine/expander.js'
import { extractIntent, embedText } from './clients/huggingface.js'
import { resolveDisplayId } from '../auth/platform.service.js'
import { lastfm } from './clients/lastfm.js'
import { playlistGenerationQueue } from '../../jobs/playlist-generation.job.js'
import { CONTEXT_CARD_MAP, energyRangeToIntent, tempoRangeToIntent } from '../../shared/data/context-cards.js'
import { mlStage } from '../ml/index.js'
import type { PlaylistBlueprint, Intent } from '../../shared/types/index.js'

const SESSION_TTL = 60 * 10   // 10 minutes (§4 Redis TTL)
const POOL_TTL    = 60 * 10

export interface GenerateInput {
  userId: string
  type: 'seed' | 'prompt' | 'hybrid'
  platform: string
  seedDisplayId?: string
  prompt?: string
  contextCardId?: string
  deepCuts?: boolean
  intent?: {
    energy?: 'low' | 'medium' | 'high'
    tempo?: 'slow' | 'medium' | 'fast'
    mood?: string[]
    tags?: string[]
    durationMinutes?: number
  }
}

export async function startGeneration(input: GenerateInput): Promise<{ jobId: string; blueprintId: string }> {
  // Capability check — never trust frontend-provided limits (§15)
  let caps = await prisma.userCapabilities.findUnique({ where: { userId: input.userId } })
  // Fetch TasteProfile for ML affinity (§8) — non-blocking, absent = rules-only mode
  const tasteProfile = await prisma.tasteProfile.findUnique({ where: { userId: input.userId } }).catch(() => null)
  if (!caps) throw Object.assign(new Error('Capabilities not found'), { statusCode: 500 })

  // Reset monthly counter if the billing period has rolled over
  if (caps.resetDate <= new Date()) {
    const nextReset = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth() + 1,
      1,
    ))
    caps = await prisma.userCapabilities.update({
      where: { userId: input.userId },
      data: { playlistsGeneratedThisMonth: 0, resetDate: nextReset },
    })
  }

  // Playlist count cap intentionally not enforced — generation is free for all users.
  // Paid tier gates: duration (4hr vs 2hr), platforms (multiple vs 1), WhatsApp, Route.

  // Merge context card sonic profile into intent if provided
  if (input.contextCardId) {
    const card = CONTEXT_CARD_MAP.get(input.contextCardId)
    if (card) {
      const profile = card.sonicProfile
      input.intent = {
        ...input.intent,
        energy: input.intent?.energy ?? energyRangeToIntent(profile.energyRange),
        tempo:  input.intent?.tempo  ?? tempoRangeToIntent(profile.tempoRange),
        tags:   [...(input.intent?.tags ?? []), ...profile.preferredTags],
      } as typeof input.intent

      // Fire-and-forget context signal
      prisma.userSignal.create({
        data: {
          userId: input.userId,
          signalType: 'context_used',
          data: { contextType: input.contextCardId },
        },
      }).catch(() => {})
    }
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

    // Fetch tags for the seed artist — cached, negligible cost after first hit
    const seedTags = await lastfm.getArtistTopTags(seedArtist).catch(() => [] as string[])

    // Detect regeneration: same user + same seed within 48 hours
    const recentSame = await prisma.playlistRecord.findFirst({
      where: {
        userId: input.userId,
        seedTrackTitle: seedTitle,
        seedTrackArtist: seedArtist,
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      select: { id: true },
    })

    if (recentSame) {
      prisma.userSignal.create({
        data: {
          userId: input.userId,
          signalType: 'playlist_regenerated',
          data: { title: seedTitle, artist: seedArtist },
        },
      }).catch(() => {})
    }

    prisma.userSignal.create({
      data: {
        userId: input.userId,
        signalType: 'seed_used',
        data: { title: seedTitle, artist: seedArtist, tags: seedTags, platform: input.platform },
      },
    }).catch(() => {})
  }

  // Extract intent and embedding for prompt/hybrid modes
  let intent: Intent | undefined
  let promptEmbedding: number[] | undefined
  let embeddingFailed = false

  if (input.prompt) {
    const promptHash = Buffer.from(input.prompt).toString('base64').slice(0, 32)

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

    // Log after extraction so extractedIntent is available
    prisma.userSignal.create({
      data: {
        userId: input.userId,
        signalType: 'prompt_used',
        data: {
          promptHash,
          platform: input.platform,
          extractedIntent: intent
            ? { energy: intent.energy, tempo: intent.tempo, mood: intent.mood, tags: intent.tags }
            : undefined,
        },
      },
    }).catch(() => {})

    try {
      promptEmbedding = await embedText(input.prompt)
    } catch {
      embeddingFailed = true
    }
  } else {
    intent = buildIntentFromInput(input.intent)
  }

  // Expand candidate pool — Deep Cuts uses 3-hop similarity for seed/hybrid
  const pool = input.type === 'prompt'
    ? await expandFromPrompt(intent ?? {}, targetDurationMs)
    : input.deepCuts
    ? await expandFromSeedDeepCuts(seedTitle!, seedArtist!, targetDurationMs)
    : await expandFromSeed(seedTitle!, seedArtist!, targetDurationMs)

  // Resolve ML stage + affinity maps from TasteProfile
  const stage = tasteProfile ? mlStage(tasteProfile.signalCount) : 0
  const affinityMaps = stage >= 1 && tasteProfile
    ? {
        artists: tasteProfile.artistAffinities as Record<string, number>,
        tags:    tasteProfile.tagAffinities    as Record<string, number>,
      }
    : undefined

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
    deepCuts: input.deepCuts ?? false,
    mlStage: stage,
    affinityMaps,
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

  // Queue job — pass signal context so the worker can log complete playlist_created data
  const promptHash = input.prompt
    ? Buffer.from(input.prompt).toString('base64').slice(0, 32)
    : undefined

  const job = await playlistGenerationQueue.add('generate', {
    sessionId: session.sessionId,
    userId: input.userId,
    playlistRecordId: record.id,
    promptHash,
    contextCardId: input.contextCardId,
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
      narrative: true,
      platformPlaylistUrl: true,
      createdAt: true,
    },
  })
}

// ─── Weekly ML generation (§18.6) ────────────────────────────────────────────

export async function startWeeklyGeneration(userId: string): Promise<void> {
  const [prefs, caps, tasteProfile] = await Promise.all([
    prisma.userPreferences.findUnique({ where: { userId } }),
    prisma.userCapabilities.findUnique({ where: { userId } }),
    prisma.tasteProfile.findUnique({ where: { userId } }),
  ])

  // Weekly playlist is a paid feature (§9) — gating removed, all users get it
  // if (caps?.plan !== 'paid') return

  if (!tasteProfile) return
  const stage = mlStage(tasteProfile.signalCount)
  if (stage < 1) return

  const platform = prefs?.defaultPlatform ?? 'spotify'
  const targetMinutes = Math.min(150, caps?.maxPlaylistDurationMinutes ?? 150)
  const targetDurationMs = targetMinutes * 60_000

  const topTags   = Object.keys(tasteProfile.tagAffinities    as Record<string, number>).slice(0, 5)
  const topGenres = Object.keys(tasteProfile.genreAffinities  as Record<string, number>).slice(0, 3)

  const intent: Intent = {
    tags:   [...topGenres, ...topTags],
    energy: energyBand(tasteProfile.energyCentroid),
    tempo:  tempoBand(tasteProfile.tempoCentroid),
  }

  const pool = await expandFromPrompt(intent, targetDurationMs)

  const affinityMaps = {
    artists: tasteProfile.artistAffinities as Record<string, number>,
    tags:    tasteProfile.tagAffinities    as Record<string, number>,
  }

  const session = createSession({
    userId,
    generationType: 'weekly_ml',
    targetPlatform: platform,
    targetDurationMs,
    intent,
    embeddingFailed: false,
    mlStage: stage,
    affinityMaps,
  })

  await Promise.all([
    redis.setex(`session:${session.sessionId}`, SESSION_TTL, serialiseSession(session)),
    redis.setex(`pool:${session.sessionId}`, POOL_TTL, serialisePool(pool)),
  ])

  const blueprintId = randomUUID()
  await prisma.playlistRecord.create({
    data: {
      id: blueprintId,
      userId,
      platform,
      generationType: 'weekly_ml',
      durationMinutes: 60,
      trackCount: 0,
    },
  })

  await playlistGenerationQueue.add('generate', {
    sessionId:        session.sessionId,
    userId,
    playlistRecordId: blueprintId,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function energyBand(centroid: number): 'low' | 'medium' | 'high' {
  if (centroid >= 0.65) return 'high'
  if (centroid >= 0.35) return 'medium'
  return 'low'
}

function tempoBand(centroid: number): 'slow' | 'medium' | 'fast' {
  if (centroid >= 0.65) return 'fast'
  if (centroid >= 0.35) return 'medium'
  return 'slow'
}

function buildIntentFromInput(raw?: GenerateInput['intent']): Intent | undefined {
  if (!raw) return undefined
  return {
    energy: raw.energy,
    tempo: raw.tempo,
    mood: raw.mood,
    tags: raw.tags,
    durationRequestedMs: raw.durationMinutes ? raw.durationMinutes * 60_000 : undefined,
  }
}
