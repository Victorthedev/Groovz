import { randomUUID } from 'crypto'
import { redis } from '../../shared/utils/redis.js'
import { prisma } from '../../shared/utils/prisma.js'
import { getIO } from '../../shared/utils/socket.js'
import { createSession } from '../recommendation/engine/generator.js'
import { expandFromPrompt } from '../recommendation/engine/expander.js'
import { serialiseSession, serialisePool } from '../../shared/utils/redis-serialise.js'
import { playlistGenerationQueue } from '../../jobs/playlist-generation.job.js'
import type { BlendSession, BlendParticipant, SessionTasteProfile } from './blend.types.js'
import type { Intent } from '../../shared/types/index.js'

const BLEND_TTL    = 30 * 60  // 30 minutes
const MAX_PARTICIPANTS = 4
const STAGE_1_THRESHOLD = 50
const SESSION_TTL  = 60 * 10
const POOL_TTL     = 60 * 10
const ENERGY_MAP   = { low: 0.2, medium: 0.5, high: 0.8 }
const GENRE_TAGS   = new Set([
  'ambient','electronic','hip hop','hip-hop','indie','jazz','rock','pop','r&b','rnb',
  'soul','classical','techno','house','deep house','drum and bass','dnb','reggae','folk',
  'metal','afrobeats','afrobeat','lo-fi','lo fi','drill','trap','alternative','blues',
  'country','funk','gospel','grime','punk','synthwave','neo soul','trip hop','downtempo',
  'chillhop','shoegaze','post rock','indie rock','indie pop','dream pop','bedroom pop',
])

const sessionKey = (id: string) => `blend:session:${id}`
const tasteKey   = (sid: string, pid: string) => `blend:taste:${sid}:${pid}`

// ─── Session management ───────────────────────────────────────────────────────

export async function createBlendSession(hostUserId: string, hostEmail: string): Promise<BlendSession> {
  const hostParticipantId = randomUUID()
  const session: BlendSession = {
    id: randomUUID(),
    hostUserId,
    expiresAt: Date.now() + BLEND_TTL * 1000,
    status: 'waiting',
    participants: [{
      id: hostParticipantId,
      userId: hostUserId,
      displayName: hostEmail[0].toUpperCase(),
      isAnonymous: false,
      hasProfile: false,
      joinedAt: Date.now(),
    }],
  }

  await redis.setex(sessionKey(session.id), BLEND_TTL, JSON.stringify(session))

  // Host must be in the blend room to receive participant_joined events
  try {
    getIO().in(`user:${hostUserId}`).socketsJoin(`blend:${session.id}`)
  } catch { /* socket may not be connected yet */ }

  // Auto-build host profile from their signals if above threshold
  await autoProfileIfReady(session.id, hostParticipantId, hostUserId)

  return session
}

export async function getBlendSession(sessionId: string): Promise<BlendSession | null> {
  const raw = await redis.get(sessionKey(sessionId))
  return raw ? JSON.parse(raw) as BlendSession : null
}

export async function joinSession(
  sessionId: string,
  userId: string,
  email: string,
): Promise<{ participant: BlendParticipant; needsProfile: boolean }> {
  const session = await getBlendSession(sessionId)
  if (!session) throw Object.assign(new Error('Blend session not found or expired'), { statusCode: 404 })
  if (session.status !== 'waiting') throw Object.assign(new Error('Blend session is no longer accepting participants'), { statusCode: 409 })
  if (session.participants.length >= MAX_PARTICIPANTS) throw Object.assign(new Error('Blend session is full'), { statusCode: 409 })

  // Idempotent — if already a participant, return existing
  const existing = session.participants.find(p => p.userId === userId)
  if (existing) {
    const hasProfile = !!await redis.get(tasteKey(sessionId, existing.id))
    return { participant: existing, needsProfile: !hasProfile }
  }

  const participant: BlendParticipant = {
    id: randomUUID(),
    userId,
    displayName: email[0].toUpperCase(),
    isAnonymous: false,
    hasProfile: false,
    joinedAt: Date.now(),
  }

  session.participants.push(participant)
  await redis.setex(sessionKey(sessionId), remainingTtl(session), JSON.stringify(session))

  // Join their socket to the blend room
  try {
    getIO().in(`user:${userId}`).socketsJoin(`blend:${sessionId}`)
  } catch { /* socket may not be connected */ }

  // Emit join event to everyone in the room
  getIO().to(`blend:${sessionId}`).emit('blend:participant_joined', {
    sessionId,
    participantId: participant.id,
    displayName: participant.displayName,
  })

  // Auto-build profile if they have enough signals
  const signalCount = await prisma.userSignal.count({ where: { userId } })
  if (signalCount >= STAGE_1_THRESHOLD) {
    await autoProfileIfReady(sessionId, participant.id, userId)
    return { participant: { ...participant, hasProfile: true }, needsProfile: false }
  }

  return { participant, needsProfile: true }
}

export async function joinSessionAnonymous(sessionId: string): Promise<{ participant: BlendParticipant }> {
  const session = await getBlendSession(sessionId)
  if (!session) throw Object.assign(new Error('Blend session not found or expired'), { statusCode: 404 })
  if (session.status !== 'waiting') throw Object.assign(new Error('Blend session is no longer accepting participants'), { statusCode: 409 })
  if (session.participants.length >= MAX_PARTICIPANTS) throw Object.assign(new Error('Blend session is full'), { statusCode: 409 })

  const displayName = 'G'

  const participant: BlendParticipant = {
    id: randomUUID(),
    isAnonymous: true,
    displayName,
    hasProfile: false,
    joinedAt: Date.now(),
  }

  session.participants.push(participant)
  await redis.setex(sessionKey(sessionId), remainingTtl(session), JSON.stringify(session))

  getIO().to(`blend:${sessionId}`).emit('blend:participant_joined', {
    sessionId,
    participantId: participant.id,
    displayName: participant.displayName,
  })

  return { participant }
}

export async function submitTasteProfile(
  sessionId: string,
  participantId: string,
  profile: Pick<SessionTasteProfile, 'energyCentroid' | 'tempoCentroid' | 'genreAffinities' | 'tags'>,
  isAnonymous: boolean,
): Promise<void> {
  const session = await getBlendSession(sessionId)
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 })

  const taste: SessionTasteProfile = {
    sessionId,
    participantId,
    isAnonymous,
    ...profile,
  }

  await redis.setex(tasteKey(sessionId, participantId), remainingTtl(session), JSON.stringify(taste))

  // Mark participant as profiled and notify the host
  const p = session.participants.find(x => x.id === participantId)
  if (p) {
    p.hasProfile = true
    await redis.setex(sessionKey(sessionId), remainingTtl(session), JSON.stringify(session))
    getIO().to(`blend:${sessionId}`).emit('blend:participant_ready', {
      sessionId,
      participantId,
    })
  }
}

// ─── Blend generation ─────────────────────────────────────────────────────────

export async function generateBlend(sessionId: string, hostUserId: string): Promise<void> {
  const session = await getBlendSession(sessionId)
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 })
  if (session.hostUserId !== hostUserId) throw Object.assign(new Error('Only the host can generate'), { statusCode: 403 })
  if (session.status !== 'waiting') throw Object.assign(new Error('Already generating or done'), { statusCode: 409 })

  // Collect profiles
  const profiles: SessionTasteProfile[] = []
  for (const p of session.participants) {
    const raw = await redis.get(tasteKey(sessionId, p.id))
    if (raw) profiles.push(JSON.parse(raw) as SessionTasteProfile)
  }

  if (profiles.length < 1) {
    throw Object.assign(new Error('No taste profiles available yet'), { statusCode: 409 })
  }

  session.status = 'generating'
  await redis.setex(sessionKey(sessionId), remainingTtl(session), JSON.stringify(session))
  getIO().to(`blend:${sessionId}`).emit('blend:generating', { sessionId })

  // Compute blend intent
  const intent = computeBlendIntent(profiles)

  // Create generation session
  const genSession = createSession({
    userId: hostUserId,
    generationType: 'blend',
    targetPlatform: 'spotify',  // placeholder — each participant exports to their own platform
    targetDurationMs: 60 * 60 * 1000,
    intent,
  })

  const pool = await expandFromPrompt(intent, 60 * 60 * 1000)

  await Promise.all([
    redis.setex(`session:${genSession.sessionId}`, SESSION_TTL, serialiseSession(genSession)),
    redis.setex(`pool:${genSession.sessionId}`, POOL_TTL, serialisePool(pool)),
  ])

  // Create a PlaylistRecord placeholder for each signed-in participant
  const participantInitials = session.participants.map(p => p.displayName).join(' · ')
  const recordIds: Record<string, string> = {}  // userId → recordId

  for (const p of session.participants.filter(x => !x.isAnonymous && x.userId)) {
    const record = await prisma.playlistRecord.create({
      data: {
        userId: p.userId!,
        platform: 'spotify',  // updated at export time per participant
        generationType: 'blend',
        promptSummary: `Blend · ${participantInitials}`,
        durationMinutes: 60,
        trackCount: 0,
        blendSessionId: sessionId,
      },
    })
    recordIds[p.userId!] = record.id
  }

  // Use the host's record id as the blueprint id (shared blueprint)
  const blueprintId = recordIds[hostUserId] ?? randomUUID()

  await playlistGenerationQueue.add('generate', {
    sessionId: genSession.sessionId,
    userId: hostUserId,
    playlistRecordId: blueprintId,
    blendSessionId: sessionId,
    blendParticipantRecordIds: JSON.stringify(recordIds),
  })

  session.blueprintId = blueprintId
  await redis.setex(sessionKey(sessionId), remainingTtl(session), JSON.stringify(session))
}

// ─── Blend algorithm ──────────────────────────────────────────────────────────

function computeBlendIntent(profiles: SessionTasteProfile[]): Intent {
  const energyCentroid = avg(profiles.map(p => p.energyCentroid))
  const tempoCentroid  = avg(profiles.map(p => p.tempoCentroid))

  // Shared genres: appear in ALL profiles' top genres
  const topGenreSets = profiles.map(p =>
    Object.entries(p.genreAffinities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g.toLowerCase()),
  )
  const sharedGenres = topGenreSets[0]?.filter(g => topGenreSets.every(s => s.includes(g))) ?? []

  // Divergent genres: top genre from each participant not in shared set
  const divergentGenres: string[] = []
  for (const p of profiles) {
    const top = Object.entries(p.genreAffinities)
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g.toLowerCase())
      .find(g => !sharedGenres.includes(g))
    if (top) divergentGenres.push(top)
  }

  // 70% shared anchors, 30% divergent — reflect each participant
  const tags = [
    ...sharedGenres.slice(0, 5),                // anchor
    ...divergentGenres.slice(0, 2),             // everyone hears something from others
    ...profiles.flatMap(p => p.tags).slice(0, 3), // mood/activity tags
  ]

  return {
    energy: energyCentroid > 0.65 ? 'high' : energyCentroid > 0.35 ? 'medium' : 'low',
    tempo: tempoCentroid > 0.65 ? 'fast' : tempoCentroid > 0.35 ? 'medium' : 'slow',
    tags: [...new Set(tags)],
  }
}

// ─── Auto-profile from signals ────────────────────────────────────────────────

async function autoProfileIfReady(sessionId: string, participantId: string, userId: string): Promise<void> {
  const signals = await prisma.userSignal.findMany({
    where: { userId },
    select: { signalType: true, data: true },
    orderBy: { recordedAt: 'desc' },
    take: 200,
  })

  const tagFreq = new Map<string, number>()
  const energyValues: number[] = []

  for (const s of signals) {
    const d = s.data as Record<string, unknown>
    if (s.signalType === 'seed_used') {
      (d['tags'] as string[] | undefined)?.slice(0, 5).forEach(t => tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1))
    }
    if (s.signalType === 'playlist_created') {
      const intent = d['intent'] as { energy?: string; tags?: string[] } | undefined
      intent?.tags?.slice(0, 5).forEach(t => tagFreq.set(t, (tagFreq.get(t) ?? 0) + 0.8))
      const ev = ENERGY_MAP[intent?.energy as keyof typeof ENERGY_MAP]
      if (ev !== undefined) energyValues.push(ev)
    }
  }

  const genreEntries = [...tagFreq.entries()].filter(([t]) => GENRE_TAGS.has(t.toLowerCase()))
  const topGenres = (genreEntries.length >= 2 ? genreEntries : [...tagFreq.entries()])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const genreAffinities = Object.fromEntries(topGenres)
  const tags = topGenres.map(([t]) => t)
  const energyCentroid = energyValues.length > 0
    ? energyValues.reduce((s, v) => s + v, 0) / energyValues.length
    : 0.5

  await submitTasteProfile(sessionId, participantId, {
    energyCentroid,
    tempoCentroid: 0.5,
    genreAffinities,
    tags,
  }, false)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0.5
  return nums.reduce((s, v) => s + v, 0) / nums.length
}

function remainingTtl(session: BlendSession): number {
  return Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000))
}
