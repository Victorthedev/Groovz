import { prisma } from '../../shared/utils/prisma.js'
import { deriveTrackFeatures, lookupTag, normaliseTag } from '../../shared/data/tag-mappings.js'
import type { SignalType } from '@prisma/client'

// ─── Thresholds (§18.3) ───────────────────────────────────────────────────────

const STAGE_1 = 50
const STAGE_2 = 200
const STAGE_3 = 500

export function mlStage(signalCount: number): 0 | 1 | 2 | 3 {
  if (signalCount >= STAGE_3) return 3
  if (signalCount >= STAGE_2) return 2
  if (signalCount >= STAGE_1) return 1
  return 0
}

// ─── Signal weights (§18.4) ───────────────────────────────────────────────────

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  seed_used:            1.0,
  prompt_used:          0.8,
  context_used:         0.7,
  playlist_created:     0.6,
  spotify_top_track:    0.5,
  lastfm_scrobble:      0.4,
  spotify_recent_play:  0.3,
  playlist_regenerated: 0.0, // used for novelty calc only, not affinity
}

function recencyDecay(recordedAt: Date): number {
  const daysAgo = (Date.now() - recordedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysAgo <= 7)  return 1.0
  if (daysAgo <= 30) return 0.7
  if (daysAgo <= 90) return 0.4
  return 0.1
}

// ─── Entity extraction ────────────────────────────────────────────────────────

interface Entities {
  artists: string[]
  tags: string[]
}

function extractEntities(signalType: SignalType, raw: unknown): Entities {
  const data = raw as Record<string, unknown>
  const artists: string[] = []
  const tags: string[] = []

  if (signalType === 'seed_used') {
    if (typeof data.artist === 'string' && data.artist) artists.push(data.artist)
    if (Array.isArray(data.tags)) tags.push(...data.tags.filter((t): t is string => typeof t === 'string'))
  }

  if (signalType === 'spotify_top_track' || signalType === 'spotify_recent_play' || signalType === 'lastfm_scrobble') {
    if (typeof data.artist === 'string' && data.artist) artists.push(data.artist)
  }

  if (signalType === 'prompt_used') {
    const intent = data.extractedIntent as Record<string, unknown> | undefined
    if (intent) {
      if (Array.isArray(intent.tags)) tags.push(...intent.tags.filter((t): t is string => typeof t === 'string'))
      if (Array.isArray(intent.mood)) tags.push(...intent.mood.filter((t): t is string => typeof t === 'string'))
    }
  }

  if (signalType === 'context_used') {
    const contextTagMap: Record<string, string[]> = {
      'pre-match':    ['energetic', 'upbeat', 'workout'],
      'cant-sleep':   ['ambient', 'chill', 'lo-fi'],
      'cooking':      ['soul', 'indie pop', 'happy'],
      'flight':       ['ambient', 'classical', 'downtempo'],
      'running':      ['electronic', 'drum and bass', 'energetic'],
      'getting-ready':['pop', 'dance pop', 'upbeat'],
      'deep-focus':   ['ambient', 'study', 'instrumental'],
      'post-workout': ['hip hop', 'chill', 'soul'],
    }
    const contextType = typeof data.contextType === 'string' ? data.contextType : ''
    tags.push(...(contextTagMap[contextType] ?? []))
  }

  if (signalType === 'playlist_created') {
    const seed = data.seedTrack as Record<string, unknown> | undefined
    if (seed && typeof seed.artist === 'string' && seed.artist) artists.push(seed.artist)
    const intent = data.intent as Record<string, unknown> | undefined
    if (intent) {
      if (Array.isArray(intent.tags)) tags.push(...intent.tags.filter((t): t is string => typeof t === 'string'))
      if (Array.isArray(intent.mood)) tags.push(...intent.mood.filter((t): t is string => typeof t === 'string'))
    }
  }

  return { artists, tags }
}

// ─── Affinity map builder ─────────────────────────────────────────────────────

function buildAffinityMaps(
  signals: Array<{ signalType: SignalType; data: unknown; recordedAt: Date }>,
): {
  artists: Record<string, number>
  tags: Record<string, number>
  genres: Record<string, number>
} {
  const total = signals.length || 1

  const artistAcc: Map<string, number> = new Map()
  const tagAcc: Map<string, number>    = new Map()

  for (const signal of signals) {
    const weight = SIGNAL_WEIGHTS[signal.signalType]
    if (weight === 0) continue

    const decay        = recencyDecay(signal.recordedAt)
    const contribution = weight * decay
    const { artists, tags } = extractEntities(signal.signalType, signal.data)

    for (const raw of artists) {
      const key = raw.toLowerCase().trim()
      if (!key) continue
      artistAcc.set(key, (artistAcc.get(key) ?? 0) + contribution)
    }

    for (const raw of tags) {
      const key = normaliseTag(raw)
      if (!key) continue
      tagAcc.set(key, (tagAcc.get(key) ?? 0) + contribution)
    }
  }

  const artistAffinities = top20(artistAcc, total)
  const tagAffinities    = top20(tagAcc, total)

  // Genre affinities: tags that are genre-level (weight >= 0.8)
  const genreAcc: Map<string, number> = new Map()
  for (const [tag, score] of tagAcc) {
    const m = lookupTag(tag)
    if (m && m.weight >= 0.8) genreAcc.set(tag, score)
  }
  const genreAffinities = top20(genreAcc, total)

  return { artists: artistAffinities, tags: tagAffinities, genres: genreAffinities }
}

function top20(acc: Map<string, number>, total: number): Record<string, number> {
  return Object.fromEntries(
    [...acc.entries()]
      .map(([k, v]) => [k, Math.min(v / total, 1)] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
  )
}

// ─── Sonic centroids ──────────────────────────────────────────────────────────

function computeSonicCentroids(
  signals: Array<{ signalType: SignalType; data: unknown; recordedAt: Date }>,
): { energy: number; tempo: number } {
  let energyWeightedSum = 0, energyTotalWeight = 0
  let tempoWeightedSum  = 0, tempoTotalWeight  = 0

  for (const signal of signals) {
    const weight = SIGNAL_WEIGHTS[signal.signalType]
    if (weight === 0) continue

    const decay        = recencyDecay(signal.recordedAt)
    const contribution = weight * decay
    const { tags }     = extractEntities(signal.signalType, signal.data)
    if (tags.length === 0) continue

    const { energy, tempo } = deriveTrackFeatures(tags)
    if (energy !== null) { energyWeightedSum += energy * contribution; energyTotalWeight += contribution }
    if (tempo  !== null) { tempoWeightedSum  += tempo  * contribution; tempoTotalWeight  += contribution }
  }

  return {
    energy: energyTotalWeight > 0 ? energyWeightedSum / energyTotalWeight : 0.5,
    tempo:  tempoTotalWeight  > 0 ? tempoWeightedSum  / tempoTotalWeight  : 0.5,
  }
}

// ─── Novelty tolerance ────────────────────────────────────────────────────────

function computeNoveltyTolerance(signals: Array<{ signalType: SignalType }>): number {
  const created     = signals.filter(s => s.signalType === 'playlist_created').length
  const regenerated = signals.filter(s => s.signalType === 'playlist_regenerated').length
  if (created === 0) return 0.5
  return Math.max(0, Math.min(1, 1 - regenerated / created))
}

// ─── Energy trend ─────────────────────────────────────────────────────────────

function computeEnergyTrend(
  signals: Array<{ signalType: SignalType; data: unknown; recordedAt: Date }>,
): 'rising' | 'falling' | 'stable' {
  const now          = Date.now()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  const recent = signals.filter(s => now - s.recordedAt.getTime() <= thirtyDaysMs)
  const older  = signals.filter(s => {
    const age = now - s.recordedAt.getTime()
    return age > thirtyDaysMs && age <= 2 * thirtyDaysMs
  })

  const { energy: recentEnergy } = computeSonicCentroids(recent)
  const { energy: olderEnergy }  = computeSonicCentroids(older)

  const delta = recentEnergy - olderEnergy
  if (delta >  0.05) return 'rising'
  if (delta < -0.05) return 'falling'
  return 'stable'
}

// ─── Phase label ──────────────────────────────────────────────────────────────

function derivePhaseLabel(
  energyCentroid: number,
  tempoCentroid: number,
  topGenres: string[],
  topTags: string[],
): string {
  if (topTags.includes('melancholic') || topTags.includes('sad') || topTags.includes('heartbreak')) {
    return energyCentroid < 0.4 ? 'Dark and introspective' : 'Intense and emotional'
  }
  if (topTags.includes('euphoric') || topTags.includes('uplifting')) return 'Bright and euphoric'
  if (topTags.includes('chill') || topTags.includes('chillout') || topTags.includes('downtempo')) return 'Slow and meandering'

  if (topGenres.some(g => ['metal', 'heavy metal', 'death metal', 'punk', 'punk rock'].includes(g))) return 'Raw and high-voltage'
  if (topGenres.some(g => ['ambient', 'drone', 'space music'].includes(g))) return 'Spacious and meditative'
  if (topGenres.some(g => ['hip hop', 'hip-hop', 'rap', 'trap', 'drill', 'grime'].includes(g))) return 'Rhythmic and forward-leaning'
  if (topGenres.includes('jazz')) return 'Fluid and improvisational'
  if (topGenres.some(g => ['classical', 'orchestral', 'neo classical'].includes(g))) return 'Structured and expansive'
  if (topGenres.some(g => ['electronic', 'techno', 'house', 'drum and bass'].includes(g))) return 'Mechanical and driving'
  if (topGenres.some(g => ['folk', 'acoustic', 'singer songwriter', 'singer-songwriter'].includes(g))) return 'Warm and stripped back'
  if (topGenres.some(g => ['indie', 'indie rock', 'alternative', 'shoegaze'].includes(g))) return 'Textured and restless'
  if (topGenres.some(g => ['r&b', 'rnb', 'soul', 'neo soul'].includes(g))) return 'Smooth and feeling-driven'

  if (energyCentroid >= 0.7 && tempoCentroid >= 0.7) return 'Fast-moving and propulsive'
  if (energyCentroid >= 0.7)                         return 'Energetic and in motion'
  if (energyCentroid <= 0.3 && tempoCentroid <= 0.3) return 'Quiet and reflective'
  if (energyCentroid <= 0.3)                         return 'Gentle and unhurried'
  return 'Eclectic and exploring'
}

// ─── Temporal patterns (Stage 3) ─────────────────────────────────────────────

function computeTemporalPatterns(
  signals: Array<{ signalType: SignalType; data: unknown; recordedAt: Date }>,
): Record<string, { energyCentroid: number; dominantGenres: string[]; dominantTags: string[] }> {
  const slotMap: Map<string, typeof signals> = new Map()

  for (const signal of signals) {
    const d    = signal.recordedAt
    const slot = `${d.getUTCDay()}:${Math.floor(d.getUTCHours() / 2)}`
    const arr  = slotMap.get(slot) ?? []
    arr.push(signal)
    slotMap.set(slot, arr)
  }

  const patterns: Record<string, { energyCentroid: number; dominantGenres: string[]; dominantTags: string[] }> = {}

  for (const [slot, slotSignals] of slotMap) {
    if (slotSignals.length < 5) continue
    const { energy }       = computeSonicCentroids(slotSignals)
    const { genres, tags } = buildAffinityMaps(slotSignals)
    patterns[slot] = {
      energyCentroid: energy,
      dominantGenres: Object.keys(genres).slice(0, 3),
      dominantTags:   Object.keys(tags).slice(0, 5),
    }
  }

  return patterns
}

// ─── Main computation (§18.6) ─────────────────────────────────────────────────

export async function computeTasteProfile(userId: string): Promise<void> {
  const signals = await prisma.userSignal.findMany({
    where:   { userId },
    orderBy: { recordedAt: 'desc' },
    select:  { signalType: true, data: true, recordedAt: true },
  })

  const signalCount = signals.length
  const stage       = mlStage(signalCount)
  if (stage === 0) return

  const { artists, tags, genres } = buildAffinityMaps(signals)
  const { energy, tempo }         = computeSonicCentroids(signals)
  const noveltyTolerance          = computeNoveltyTolerance(signals)
  const energyTrend               = computeEnergyTrend(signals)

  const topGenres = Object.keys(genres).slice(0, 3)
  const topTags   = Object.keys(tags).slice(0, 5)

  const phaseLabel = derivePhaseLabel(energy, tempo, topGenres, topTags)
  const comparedToLastMonth =
    energyTrend === 'rising'  ? 'More energetic than last month' :
    energyTrend === 'falling' ? 'Slower and more atmospheric than last month' :
                                'Pretty consistent with last month'

  const temporalPatterns = stage >= 3 ? computeTemporalPatterns(signals) : null

  const profileData = {
    signalCount,
    mlStage:          stage,
    energyCentroid:   energy,
    tempoCentroid:    tempo,
    noveltyTolerance,
    genreAffinities:  genres,
    artistAffinities: artists,
    tagAffinities:    tags,
    temporalPatterns,
    currentPhase: {
      label: phaseLabel,
      dominantGenres: topGenres,
      dominantTags:   topTags,
      energyTrend,
      comparedToLastMonth,
    },
  }

  await prisma.tasteProfile.upsert({
    where:  { userId },
    create: { userId, ...profileData },
    update: profileData,
  })
}

// ─── Affinity score for scorer integration (§8) ───────────────────────────────

export function computeAffinityScore(
  track: { artist: string; tags: string[] },
  maps: { artists: Record<string, number>; tags: Record<string, number> },
): number {
  const artistAff = maps.artists[track.artist.toLowerCase().trim()] ?? 0

  const tagScores = track.tags
    .map(t => maps.tags[normaliseTag(t)] ?? 0)
    .filter(s => s > 0)
  const tagAff = tagScores.length > 0
    ? tagScores.reduce((a, b) => a + b, 0) / tagScores.length
    : 0

  return artistAff * 0.5 + tagAff * 0.5
}
