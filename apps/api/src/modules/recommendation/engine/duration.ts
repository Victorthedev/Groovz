import { DEFAULT_TRACK_DURATION_MS } from '../../../shared/utils/index.js'
import type { CanonicalTrack } from '../../../shared/types/index.js'
import type { PlaylistSession } from '../../../shared/types/session.js'

const NEAR_END_BUFFER_MS = 10 * 60 * 1000    // 10 minutes
const SHORT_TRACK_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
const OVERFLOW_ALLOWANCE_MS = 2 * 60 * 1000   // ±2 minutes

export function fitsInSession(track: CanonicalTrack, session: PlaylistSession): boolean {
  const durationMs = track.durationMs ?? DEFAULT_TRACK_DURATION_MS

  if (session.currentDurationMs + durationMs <= session.maxDurationMs) return true

  // One-time overflow allowance (§5.6)
  if (
    !session.overflowUsed &&
    session.currentDurationMs >= session.minDurationMs - OVERFLOW_ALLOWANCE_MS &&
    session.currentDurationMs + durationMs <= session.maxDurationMs + OVERFLOW_ALLOWANCE_MS
  ) {
    return true
  }

  return false
}

export function isNearEnd(session: PlaylistSession): boolean {
  return session.maxDurationMs - session.currentDurationMs < NEAR_END_BUFFER_MS
}

export function shouldStop(session: PlaylistSession): boolean {
  return session.currentDurationMs >= session.minDurationMs
}

export function isShortTrack(track: CanonicalTrack): boolean {
  return (track.durationMs ?? Infinity) < SHORT_TRACK_THRESHOLD_MS
}
