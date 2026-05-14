import type { PlaylistSession, CandidatePool } from '../types/session.js'
import type { CanonicalTrack, Intent } from '../types/index.js'

// ─── Serialised forms (JSON-safe) ────────────────────────────────────────────

interface SerialisedSession {
  sessionId: string
  userId: string
  generationType: string
  targetPlatform: string
  targetDurationMs: number
  minDurationMs: number
  maxDurationMs: number
  currentDurationMs: number
  overflowUsed: boolean
  selectedTracks: CanonicalTrack[]
  artistCount: Record<string, number>
  tagCount: Record<string, number>
  rejectedIds: string[]
  blockedArtists: string[]
  temperature: number
  iteration: number
  softPenaltiesRelaxed: boolean
  intent?: Intent
  seedTrackTitle?: string
  seedTrackArtist?: string
  promptEmbedding?: number[]
  embeddingFailed: boolean
}

interface SerialisedPool {
  tracks: Record<string, CanonicalTrack>
  byArtist: Record<string, string[]>
  byTag: Record<string, string[]>
  unpicked: string[]
}

// ─── Session ─────────────────────────────────────────────────────────────────

export function serialiseSession(session: PlaylistSession): string {
  const s: SerialisedSession = {
    ...session,
    artistCount: Object.fromEntries(session.artistCount),
    tagCount: Object.fromEntries(session.tagCount),
    rejectedIds: [...session.rejectedIds],
    blockedArtists: [...session.blockedArtists],
  }
  return JSON.stringify(s)
}

export function deserialiseSession(raw: string): PlaylistSession {
  const s: SerialisedSession = JSON.parse(raw)
  return {
    ...s,
    generationType: s.generationType as PlaylistSession['generationType'],
    artistCount: new Map(Object.entries(s.artistCount)),
    tagCount: new Map(Object.entries(s.tagCount)),
    rejectedIds: new Set(s.rejectedIds),
    blockedArtists: new Set(s.blockedArtists),
  }
}

// ─── Candidate pool ───────────────────────────────────────────────────────────

export function serialisePool(pool: CandidatePool): string {
  const p: SerialisedPool = {
    tracks: Object.fromEntries(pool.tracks),
    byArtist: Object.fromEntries(
      [...pool.byArtist.entries()].map(([k, v]) => [k, [...v]]),
    ),
    byTag: Object.fromEntries(
      [...pool.byTag.entries()].map(([k, v]) => [k, [...v]]),
    ),
    unpicked: [...pool.unpicked],
  }
  return JSON.stringify(p)
}

export function deserialisePool(raw: string): CandidatePool {
  const p: SerialisedPool = JSON.parse(raw)
  return {
    tracks: new Map(Object.entries(p.tracks)),
    byArtist: new Map(
      Object.entries(p.byArtist).map(([k, v]) => [k, new Set(v)]),
    ),
    byTag: new Map(
      Object.entries(p.byTag).map(([k, v]) => [k, new Set(v)]),
    ),
    unpicked: new Set(p.unpicked),
  }
}
