import type { ResolvedTrack } from '../../shared/types/index.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioFeatures {
  id: string
  tempo: number     // BPM
  key: number       // 0–11 (C to B)
  mode: number      // 1 = major, 0 = minor
  energy: number    // 0–1
}

// Used when Spotify returns null for a track (e.g. local files)
const NEUTRAL_FEATURES: Omit<AudioFeatures, 'id'> = {
  tempo: 120,
  key: 0,
  mode: 1,
  energy: 0.5,
}

// ─── Camelot wheel ────────────────────────────────────────────────────────────
// Maps Spotify (key 0–11, mode 0/1) → Camelot position 1–12.
// Major = B wheel, Minor = A wheel.

const CAMELOT_MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1] // C→B, mode=1
const CAMELOT_MINOR = [5, 12, 7, 2,  9, 4, 11, 6, 1,  8, 3, 10] // C→B, mode=0

function camelotPos(key: number, mode: number): number {
  return mode === 1 ? (CAMELOT_MAJOR[key] ?? 8) : (CAMELOT_MINOR[key] ?? 5)
}

function keyCompatibility(a: AudioFeatures, b: AudioFeatures): number {
  const pa = camelotPos(a.key, a.mode)
  const pb = camelotPos(b.key, b.mode)

  if (pa === pb && a.mode === b.mode) return 1.0   // same key — perfect
  if (pa === pb && a.mode !== b.mode) return 0.85  // relative major/minor — same camelot number

  // Adjacent on the wheel (wrap 12→1)
  const diff = Math.abs(pa - pb)
  const wrappedDiff = Math.min(diff, 12 - diff)
  if (wrappedDiff === 1 && a.mode === b.mode) return 0.7

  return 0.2
}

// ─── BPM compatibility ────────────────────────────────────────────────────────
// Tolerates exact match (±6%), half tempo, and double tempo — mirrors DJ mixing.

function bpmCompatibility(a: AudioFeatures, b: AudioFeatures): number {
  if (a.tempo === 0 || b.tempo === 0) return 0.5

  const ratio = a.tempo > b.tempo ? a.tempo / b.tempo : b.tempo / a.tempo

  // Exact, half, or double tempo within 6% tolerance
  for (const target of [1, 2, 0.5] as const) {
    if (Math.abs(ratio - target) / target <= 0.06) {
      return target === 1 ? 1.0 : 0.9
    }
  }

  // General penalty for large BPM jumps
  const pctDiff = Math.abs(a.tempo - b.tempo) / Math.max(a.tempo, b.tempo)
  return Math.max(0, 1 - pctDiff * 3)  // 33%+ difference → 0
}

// ─── Energy flow ──────────────────────────────────────────────────────────────

function energyFlow(a: AudioFeatures, b: AudioFeatures): number {
  const delta = Math.abs(a.energy - b.energy)
  if (delta <= 0.15) return 1.0
  if (delta <= 0.30) return 0.7
  return Math.max(0, 1 - delta * 2)
}

// ─── Transition score ─────────────────────────────────────────────────────────

function transitionScore(a: AudioFeatures, b: AudioFeatures): number {
  return (
    0.40 * keyCompatibility(a, b) +
    0.35 * bpmCompatibility(a, b) +
    0.25 * energyFlow(a, b)
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function harmonicSequence(
  tracks: ResolvedTrack[],
  features: Map<string, AudioFeatures>,
): ResolvedTrack[] {
  if (tracks.length <= 2) return tracks

  const getF = (t: ResolvedTrack): AudioFeatures =>
    features.get(t.platformTrackId) ?? { id: t.platformTrackId, ...NEUTRAL_FEATURES }

  // Start from the track closest to the 25th percentile energy — eases in, then builds
  const sorted = [...tracks].sort((a, b) => getF(a).energy - getF(b).energy)
  const p25 = sorted[Math.floor(sorted.length * 0.25)]!

  const remaining = [...tracks]
  const startIdx = remaining.findIndex(t => t.platformTrackId === p25.platformTrackId)
  const ordered: ResolvedTrack[] = [remaining.splice(startIdx, 1)[0]!]

  // Greedy nearest-neighbour
  while (remaining.length > 0) {
    const last = getF(ordered[ordered.length - 1]!)
    let bestIdx = 0
    let bestScore = -Infinity

    for (let i = 0; i < remaining.length; i++) {
      const score = transitionScore(last, getF(remaining[i]!))
      if (score > bestScore) { bestScore = score; bestIdx = i }
    }

    ordered.push(remaining.splice(bestIdx, 1)[0]!)
  }

  return ordered
}
