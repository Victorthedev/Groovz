import { randomUUID } from 'crypto'
import { calculateTemperature } from './temperature.js'
import { fitsInSession, isNearEnd, shouldStop, isShortTrack } from './duration.js'
import { failsHardRules, applyTrackToSession } from './fatigue.js'
import { selectWeightedRandom } from './scorer.js'
import { sequenceTracks } from './sequencer.js'
import { expandFromSeed } from './expander.js'
import type { CanonicalTrack, PlaylistBlueprint } from '../../../shared/types/index.js'
import type { PlaylistSession, CandidatePool } from '../../../shared/types/session.js'

// ─── Main generation loop ─────────────────────────────────────────────────────

export async function generate(
  session: PlaylistSession,
  pool: CandidatePool,
): Promise<PlaylistBlueprint> {
  const maxIterations = pool.tracks.size * 2  // §5.7 infinite loop protection — NEVER skip

  while (!shouldStop(session) && session.iteration < maxIterations) {
    session.temperature = calculateTemperature(session)

    // Build candidate list: unpicked tracks that haven't been rejected
    let candidates = getCandidates(pool, session)

    // Near-end preference: bias toward short tracks (§5.6)
    if (isNearEnd(session) && candidates.some(isShortTrack)) {
      candidates = candidates.filter(isShortTrack)
    }

    // Apply hard fatigue rules — rules 1–3 (§5.5 precedence order, no scoring)
    candidates = candidates.filter(t => !failsHardRules(t, session))

    // Apply duration fit check (§5.6)
    candidates = candidates.filter(t => fitsInSession(t, session))

    // Deep Cuts — hard filter: no mainstream tracks (popularity > 0.75) in the pool
    if (session.deepCuts) {
      const underground = candidates.filter(t => (t.popularity ?? 0) <= 0.75)
      if (underground.length > 0) candidates = underground
    }

    // Popular track cap — stricter threshold (0.5) in Deep Cuts mode
    const popularThreshold = session.deepCuts ? 0.5 : 0.75
    if (session.selectedTracks.length > 0) {
      const popularRatio = session.popularTrackCount / session.selectedTracks.length
      if (popularRatio >= 0.2) {
        const nonPopular = candidates.filter(t => (t.popularity ?? 0) < popularThreshold)
        if (nonPopular.length > 0) candidates = nonPopular
      }
    }

    if (candidates.length === 0) {
      const recovered = await handleExhaustion(session, pool)
      if (!recovered) break
      session.iteration++
      continue
    }

    // Weighted stochastic selection (§5.3) — NEVER argmax
    const selected = selectWeightedRandom(candidates, session)
    if (!selected) break

    // Mark as picked, handle the overflow flag if this was an overflow track
    pool.unpicked.delete(selected.id)
    if (!fitsNormally(selected, session)) {
      session.overflowUsed = true
    }

    applyTrackToSession(selected, session)
    session.rejectedIds.delete(selected.id)

    session.iteration++
  }

  if (session.iteration >= maxIterations) {
    // §5.7 — log and return best valid playlist so far
    console.error(`[generator] maxIterations reached for session ${session.sessionId}`, {
      sessionId: session.sessionId,
      userId: session.userId,
      iteration: session.iteration,
      poolSize: pool.tracks.size,
      selectedCount: session.selectedTracks.length,
    })
  }

  const ordered = sequenceTracks(session.selectedTracks)

  // Collect up to 30 highest-scoring unpicked tracks as the backup pool (§5.9)
  const selectedIds = new Set(ordered.map(t => t.id))
  const backupTracks = [...pool.unpicked]
    .filter(id => !session.rejectedIds.has(id) && !selectedIds.has(id))
    .map(id => pool.tracks.get(id))
    .filter((t): t is CanonicalTrack => t !== undefined)
    .sort((a, b) => b.baseSimilarity - a.baseSimilarity)
    .slice(0, 30)

  return {
    id: randomUUID(),
    tracks: ordered,
    totalDurationMs: ordered.reduce((sum, t) => sum + (t.durationMs ?? 0), 0),
    generationType: session.generationType,
    intent: session.intent,
    backupTracks,
    deepCuts: session.deepCuts || undefined,
  }
}

// ─── Candidate exhaustion handler (§5.7) ─────────────────────────────────────

async function handleExhaustion(
  session: PlaylistSession,
  pool: CandidatePool,
): Promise<boolean> {
  // Step 1 — relax soft penalties (once)
  if (!session.softPenaltiesRelaxed) {
    session.softPenaltiesRelaxed = true
    return true
  }

  // Step 2 — expand pool with a secondary Last.fm fetch
  const expanded = await expandPool(session)
  if (expanded.length > 0) {
    for (const id of expanded) pool.unpicked.add(id)
    return true
  }

  // Step 3 — lower temperature slightly to bias toward known-good tracks
  if (session.temperature > 0.2) {
    session.temperature = Math.max(0.2, session.temperature - 0.1)
    return true
  }

  // Exhausted all recovery options — stop cleanly
  return false
}

// Returns new canonicalIds added to the pool
async function expandPool(session: PlaylistSession): Promise<string[]> {
  if (!session.seedTrackTitle || !session.seedTrackArtist) return []

  try {
    const extra = await expandFromSeed(
      session.seedTrackTitle,
      session.seedTrackArtist,
      session.targetDurationMs,
    )
    const newIds: string[] = []
    for (const [id] of extra.tracks) {
      // Only add genuinely new tracks
      if (!session.rejectedIds.has(id)) {
        newIds.push(id)
      }
    }
    return newIds
  } catch {
    return []
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCandidates(pool: CandidatePool, session: PlaylistSession): CanonicalTrack[] {
  return [...pool.unpicked]
    .filter(id => !session.rejectedIds.has(id))
    .map(id => pool.tracks.get(id))
    .filter((t): t is CanonicalTrack => t !== undefined)
}

function fitsNormally(track: CanonicalTrack, session: PlaylistSession): boolean {
  const durationMs = track.durationMs ?? 0
  return session.currentDurationMs + durationMs <= session.maxDurationMs
}

// ─── Session factory ──────────────────────────────────────────────────────────

export function createSession(params: {
  userId: string
  generationType: PlaylistSession['generationType']
  targetPlatform: string
  targetDurationMs: number
  seedTrackTitle?: string
  seedTrackArtist?: string
  intent?: PlaylistSession['intent']
  promptEmbedding?: number[]
  embeddingFailed?: boolean
  deepCuts?: boolean
  mlStage?: 0 | 1 | 2 | 3
  affinityMaps?: PlaylistSession['affinityMaps']
}): PlaylistSession {
  const toleranceMs = 10 * 60 * 1000  // ±10 minutes (§5.1)
  return {
    sessionId: randomUUID(),
    userId: params.userId,
    generationType: params.generationType,
    targetPlatform: params.targetPlatform,
    targetDurationMs: params.targetDurationMs,
    minDurationMs: params.targetDurationMs - toleranceMs,
    maxDurationMs: params.targetDurationMs + toleranceMs,
    currentDurationMs: 0,
    overflowUsed: false,
    selectedTracks: [],
    artistCount: new Map(),
    tagCount: new Map(),
    rejectedIds: new Set(),
    blockedArtists: new Set(),
    popularTrackCount: 0,
    temperature: 0.25,
    iteration: 0,
    softPenaltiesRelaxed: false,
    intent: params.intent,
    seedTrackTitle: params.seedTrackTitle,
    seedTrackArtist: params.seedTrackArtist,
    promptEmbedding: params.promptEmbedding,
    embeddingFailed: params.embeddingFailed ?? false,
    deepCuts: params.deepCuts ?? false,
    mlStage: params.mlStage ?? 0,
    affinityMaps: params.affinityMaps,
  }
}
