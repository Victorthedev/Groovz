import { normaliseTitle } from '../recommendation/engine/normaliser.js'

// §5.9 reject keywords — applied to search result titles
const REJECT_KEYWORDS = ['cover', 'live', 'karaoke', 'instrumental', 'tribute', 'remix']

export interface PlatformSearchResult {
  platformTrackId: string
  title: string
  artists: string[]
  durationMs: number
  isVerifiedArtistChannel?: boolean  // YouTube Music only
}

export function scoreResult(
  ourTrack: { title: string; artist: string; durationMs?: number },
  result: PlatformSearchResult,
  seedWasRemix = false,
): number {
  if (hasRejectKeyword(result.title, seedWasRemix)) return 0

  const titleSim = wordJaccard(normaliseTitle(ourTrack.title), normaliseTitle(result.title))
  const artistSim = artistMatch(ourTrack.artist, result.artists)
  const durSim = durationScore(ourTrack.durationMs, result.durationMs)

  return 0.50 * titleSim + 0.35 * artistSim + 0.15 * durSim
}

export function bestResult(
  ourTrack: { title: string; artist: string; durationMs?: number },
  results: PlatformSearchResult[],
  seedWasRemix = false,
): PlatformSearchResult | null {
  let best: PlatformSearchResult | null = null
  let bestScore = 0

  for (const r of results) {
    const score = scoreResult(ourTrack, r, seedWasRemix)
    if (score > bestScore) { bestScore = score; best = r }
  }

  return bestScore >= 0.8 ? best : null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasRejectKeyword(title: string, seedWasRemix: boolean): boolean {
  const lower = title.toLowerCase()
  for (const kw of REJECT_KEYWORDS) {
    if (kw === 'remix' && seedWasRemix) continue
    if (lower.includes(kw)) return true
  }
  return false
}

function wordJaccard(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(Boolean))
  const wordsB = new Set(b.split(/\s+/).filter(Boolean))
  if (wordsA.size === 0 && wordsB.size === 0) return 1
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return intersection / union
}

function artistMatch(ourArtist: string, searchArtists: string[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim()
  const ours = norm(ourArtist)
  for (const a of searchArtists) {
    const theirs = norm(a)
    if (theirs === ours) return 1.0
    if (theirs.includes(ours) || ours.includes(theirs)) return 0.7
  }
  return 0.0
}

function durationScore(ourMs: number | undefined, theirMs: number): number {
  if (!ourMs) return 0.5  // unknown duration — neutral
  const delta = Math.abs(ourMs - theirMs)
  return Math.max(0, 1 - delta / 30_000)  // 0 at 30s+ difference
}
