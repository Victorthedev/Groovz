import type { CanonicalTrack, Intent } from './index.js'

export interface PlaylistSession {
  sessionId: string
  userId: string
  generationType: 'seed' | 'prompt' | 'hybrid' | 'weekly_ml'
  targetPlatform: string

  // Duration (§5.6)
  targetDurationMs: number
  minDurationMs: number
  maxDurationMs: number
  currentDurationMs: number
  overflowUsed: boolean          // one-time ±2 min overflow flag

  // Selection state
  selectedTracks: CanonicalTrack[]
  artistCount: Map<string, number>
  tagCount: Map<string, number>
  rejectedIds: Set<string>
  blockedArtists: Set<string>

  // Algorithm state
  temperature: number
  iteration: number
  softPenaltiesRelaxed: boolean  // §5.7 candidate exhaustion step 1

  // Intent
  intent?: Intent

  // Seed info (seed / hybrid modes, §5.5 seed artist rule)
  seedTrackTitle?: string
  seedTrackArtist?: string

  // §16.3 — stored, not used for per-candidate scoring in v1
  promptEmbedding?: number[]
  embeddingFailed: boolean       // triggers §5.7 tag-overlap fallback
}

export interface CandidatePool {
  tracks: Map<string, CanonicalTrack>    // canonicalId → track
  byArtist: Map<string, Set<string>>     // normalisedArtist → Set<canonicalId>
  byTag: Map<string, Set<string>>        // tag → Set<canonicalId>
  unpicked: Set<string>                  // canonicalIds not yet selected
}
