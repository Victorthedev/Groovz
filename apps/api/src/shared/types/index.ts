// ─── Core internal types — platform-agnostic, never persisted ────────────────

export interface CanonicalTrack {
  id: string               // hash(normalisedArtist + normalisedTitle)
  title: string
  artist: string
  featuredArtists?: string[]
  durationMs?: number
  tags: string[]
  baseSimilarity: number   // from Last.fm or embedding cosine similarity
  popularity?: number
  energy?: number          // optional, inferred
  tempo?: number           // optional, inferred
}

export interface Intent {
  mood?: string[]
  energy?: 'low' | 'medium' | 'high'
  tempo?: 'slow' | 'medium' | 'fast'
  activity?: string
  durationRequestedMs?: number
  tags?: string[]          // derived from text prompt
}

export interface PlaylistBlueprint {
  id: string
  tracks: CanonicalTrack[]
  totalDurationMs: number
  generationType: 'seed' | 'prompt' | 'hybrid' | 'weekly_ml' | 'blend'
  intent?: Intent
  backupTracks?: CanonicalTrack[]  // pre-scored candidates for resolution fallback (§5.9)
  seedWasRemix?: boolean           // controls reject-keyword filter in resolver
  deepCuts?: boolean
}

export interface ResolvedTrack {
  canonicalId: string
  title: string
  artist: string
  platform: string
  platformTrackId: string
  confidence: number
}

// ─── Platform display types (frontend-safe, no platform IDs) ─────────────────

export interface LibraryTrack {
  displayId: string       // our own temporary ID, never the platform's
  title: string
  artist: string
  artworkUrl: string
  source: 'spotify' | 'deezer' | 'audiomack' | 'youtube_music'
}

export interface LibraryPlaylist {
  displayPlaylistId: string  // our own temporary ID, never the platform's
  name: string
  trackCount: number
  artworkUrl: string
  source: 'spotify' | 'deezer' | 'audiomack' | 'youtube_music'
}
