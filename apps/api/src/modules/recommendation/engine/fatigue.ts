import { normaliseArtist } from './normaliser.js'
import { DEFAULT_TRACK_DURATION_MS } from '../../../shared/utils/index.js'
import type { CanonicalTrack } from '../../../shared/types/index.js'
import type { PlaylistSession } from '../../../shared/types/session.js'

// ─── Thresholds (§5.5) ────────────────────────────────────────────────────────

export function maxTracksPerArtist(targetDurationMs: number): number {
  const mins = targetDurationMs / 60_000
  if (mins >= 90) return 2   // long-form tightening
  if (mins <= 70) return 2
  return 3
}

export function minArtistGap(targetDurationMs: number): number {
  return targetDurationMs / 60_000 >= 90 ? 4 : 3
}

// ─── Hard rules — checked BEFORE scoring (§5.5 precedence 1–3) ───────────────
// Returns true if the track should be REJECTED.

export function failsHardRules(track: CanonicalTrack, session: PlaylistSession): boolean {
  const artist = normaliseArtist(track.artist)
  const maxPerArtist = maxTracksPerArtist(session.targetDurationMs)
  const artistCount = session.artistCount.get(artist) ?? 0

  // Rule 1 — hard cap
  if (artistCount >= maxPerArtist) return true

  // Rule 2 — consecutive
  const last = session.selectedTracks[session.selectedTracks.length - 1]
  if (last && normaliseArtist(last.artist) === artist) return true

  // Rule 3 — spacing
  const gap = minArtistGap(session.targetDurationMs)
  const progress = session.currentDurationMs / session.targetDurationMs
  const recentArtists = session.selectedTracks.slice(-gap).map(t => normaliseArtist(t.artist))
  if (recentArtists.includes(artist)) {
    // Hard reject in second half; soft penalty handled by getArtistPenalty in first half
    if (progress >= 0.5) return true
  }

  // Rule — seed artist rule (§5.5)
  if (
    session.generationType === 'seed' &&
    session.seedTrackArtist &&
    artist === normaliseArtist(session.seedTrackArtist)
  ) {
    const seedCount = session.artistCount.get(artist) ?? 0
    if (progress > 0.4 && seedCount >= 1) return true
  }

  return false
}

// ─── Soft penalties — applied during scoring ─────────────────────────────────

// Returns a multiplier (0.0–1.0) per §5.3 P_artist definition.
export function getArtistPenalty(track: CanonicalTrack, session: PlaylistSession): number {
  const artist = normaliseArtist(track.artist)
  const maxPerArtist = maxTracksPerArtist(session.targetDurationMs)
  const count = session.artistCount.get(artist) ?? 0

  if (count >= maxPerArtist) return 0.0               // safety net (hard rule fires first)
  if (count === maxPerArtist - 1) return 0.6           // approaching cap

  // Spacing penalty in first half
  const gap = minArtistGap(session.targetDurationMs)
  const progress = session.currentDurationMs / session.targetDurationMs
  const recentArtists = session.selectedTracks.slice(-gap).map(t => normaliseArtist(t.artist))
  if (recentArtists.includes(artist) && progress < 0.5) return 0.7

  return 1.0
}

// Returns a multiplier (0.5–1.0) per §5.5 tag diversity rule.
export function getTagDiversityPenalty(track: CanonicalTrack, session: PlaylistSession): number {
  if (session.selectedTracks.length < 4) return 1.0

  const last4 = session.selectedTracks.slice(-4)
  const dominantTags = getDominantTags(last4)

  // If last 4 tracks all share a dominant tag with this track → penalty
  const trackTagSet = new Set(track.tags.map(t => t.toLowerCase()))
  const streakTag = dominantTags.find(tag => trackTagSet.has(tag))

  return streakTag ? 0.5 : 1.0
}

// ─── Session update ───────────────────────────────────────────────────────────

export function applyTrackToSession(track: CanonicalTrack, session: PlaylistSession): void {
  const artist = normaliseArtist(track.artist)

  session.selectedTracks.push(track)
  session.currentDurationMs += track.durationMs ?? DEFAULT_TRACK_DURATION_MS
  session.artistCount.set(artist, (session.artistCount.get(artist) ?? 0) + 1)
  if ((track.popularity ?? 0) >= 0.75) session.popularTrackCount++

  for (const tag of track.tags) {
    session.tagCount.set(tag, (session.tagCount.get(tag) ?? 0) + 1)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDominantTags(tracks: CanonicalTrack[]): string[] {
  const freq = new Map<string, number>()
  for (const t of tracks) {
    for (const tag of t.tags.slice(0, 3)) {  // top 3 tags per track
      freq.set(tag, (freq.get(tag) ?? 0) + 1)
    }
  }
  return [...freq.entries()]
    .filter(([, count]) => count === tracks.length)  // appeared in ALL 4 tracks
    .map(([tag]) => tag)
}
