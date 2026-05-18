import { lerp } from '../../../shared/utils/index.js'
import { getArtistPenalty, getTagDiversityPenalty } from './fatigue.js'
import { computeAffinityScore } from '../../ml/index.js'
import type { CanonicalTrack } from '../../../shared/types/index.js'
import type { PlaylistSession } from '../../../shared/types/session.js'

// ─── Full scoring function (§5.3) ─────────────────────────────────────────────

export function scoreTrack(
  track: CanonicalTrack,
  session: PlaylistSession,
): number {
  const T = session.temperature
  const intent = session.intent

  const sBase = track.baseSimilarity

  const sEnergy = intent?.energy
    ? matchLevel(intent.energy, track.energy, { low: 0.2, medium: 0.5, high: 0.8 })
    : 0.5

  const sTempo = intent?.tempo
    ? matchLevel(intent.tempo, track.tempo, { slow: 0.2, medium: 0.5, fast: 0.8 })
    : 0.5

  const sPop   = track.popularity ?? 0.5
  const sNovel = 1 - sPop

  const pArtist = session.softPenaltiesRelaxed ? 1.0 : getArtistPenalty(track, session)
  const pTag    = session.softPenaltiesRelaxed ? 1.0 : getTagDiversityPenalty(track, session)

  // Dynamic weights — Deep Cuts inverts the popularity/novelty balance
  const wPop   = session.deepCuts ? 0.05 : lerp(0.4, 0.1, T)
  const wNovel = session.deepCuts ? 0.45 : lerp(0.1, 0.4, T)
  const wSim   = 0.5
  const wEnergy = 0.15
  const wTempo  = 0.15

  let sRaw = (
    wSim * sBase +
    wEnergy * sEnergy +
    wTempo * sTempo +
    wPop * sPop +
    wNovel * sNovel
  ) * pArtist * pTag

  // ML affinity signal (§8) — additive, weight grows with stage confidence
  if (session.mlStage >= 1 && session.affinityMaps) {
    const wAffinity = 0.1 + (session.mlStage - 1) * 0.05  // 0.1 → 0.15 → 0.2
    sRaw += wAffinity * computeAffinityScore(track, session.affinityMaps)
  }

  return sRaw
}

// ─── Stochastic selection — NEVER take argmax (§5.3) ─────────────────────────

export function selectWeightedRandom(
  candidates: CanonicalTrack[],
  session: PlaylistSession,
): CanonicalTrack | null {
  if (candidates.length === 0) return null

  const T = session.temperature

  // Score all candidates
  const scored = candidates.map(t => ({ track: t, score: scoreTrack(t, session) }))

  // Take top 20 by raw score
  scored.sort((a, b) => b.score - a.score)
  const top20 = scored.slice(0, 20)

  // Sampling weights: S_raw ^ (1/T)
  const weights = top20.map(({ score }) => Math.pow(Math.max(score, 0), 1 / T))
  const total = weights.reduce((s, w) => s + w, 0)
  if (total === 0) return top20[0]?.track ?? null

  // Weighted random draw
  let r = Math.random() * total
  for (let i = 0; i < top20.length; i++) {
    r -= weights[i]
    if (r <= 0) return top20[i].track
  }
  return top20[top20.length - 1]?.track ?? null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchLevel(
  level: string,
  value: number | null | undefined,
  targets: Record<string, number>,
): number {
  if (value == null) return 0.5
  const target = targets[level] ?? 0.5
  return Math.max(0, 1 - Math.abs(value - target) / 0.6)
}
