import { prisma } from '../../shared/utils/prisma.js'

export interface PreferencesUpdate {
  defaultPlatform?: string
  defaultDuration?: number
  diversityBias?: number
  whatsappPhone?: string
  signalCollectionConsented?: boolean
  spotifySignalEnabled?: boolean
  seenFeatureIntros?: string[]
}

export async function getPreferences(userId: string) {
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } })
  if (!prefs) throw Object.assign(new Error('Preferences not found'), { statusCode: 404 })
  return prefs
}

export async function updatePreferences(userId: string, update: PreferencesUpdate) {
  if (update.diversityBias !== undefined) {
    const caps = await prisma.userCapabilities.findUnique({ where: { userId } })
    if (!caps || caps.plan !== 'paid') {
      throw Object.assign(new Error('diversityBias tuning requires a paid plan'), { statusCode: 403 })
    }
  }

  return prisma.userPreferences.update({
    where: { userId },
    data: update,
  })
}

export async function getCapabilities(userId: string) {
  const caps = await prisma.userCapabilities.findUnique({ where: { userId } })
  if (!caps) throw Object.assign(new Error('Capabilities not found'), { statusCode: 404 })
  return caps
}

// ─── Taste summary (v1 on-the-fly computation, v2+ uses stored TasteProfile) ──

const STAGE_1_THRESHOLD = 50

// Genre tags that are meaningful for taste profiling
const GENRE_TAG_SET = new Set([
  'ambient', 'electronic', 'hip hop', 'hip-hop', 'indie', 'jazz', 'rock', 'pop',
  'r&b', 'rnb', 'soul', 'classical', 'techno', 'house', 'deep house', 'drum and bass',
  'dnb', 'reggae', 'folk', 'metal', 'afrobeats', 'afrobeat', 'lo-fi', 'lo fi',
  'drill', 'trap', 'alternative', 'blues', 'country', 'funk', 'gospel', 'grime',
  'punk', 'synthwave', 'vaporwave', 'neo soul', 'trip hop', 'downtempo', 'chillhop',
  'shoegaze', 'post rock', 'indie rock', 'indie pop', 'dream pop', 'bedroom pop',
])

export async function getTasteSummary(userId: string) {
  const signalCount = await prisma.userSignal.count({ where: { userId } })

  if (signalCount < STAGE_1_THRESHOLD) {
    return { available: false as const, signalCount, threshold: STAGE_1_THRESHOLD }
  }

  // Derive taste from recent signals
  const signals = await prisma.userSignal.findMany({
    where: { userId },
    select: { signalType: true, data: true },
    orderBy: { recordedAt: 'desc' },
    take: 500,
  })

  const tagFreq = new Map<string, number>()
  const energyValues: number[] = []
  const ENERGY_MAP = { low: 0.2, medium: 0.5, high: 0.8 }

  for (const signal of signals) {
    const d = signal.data as Record<string, unknown>

    if (signal.signalType === 'seed_used') {
      const tags = d['tags'] as string[] | undefined
      tags?.slice(0, 5).forEach(t => tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1.0))
    }

    if (signal.signalType === 'playlist_created') {
      const intent = d['intent'] as { energy?: string; tags?: string[] } | undefined
      intent?.tags?.slice(0, 5).forEach(t => tagFreq.set(t, (tagFreq.get(t) ?? 0) + 0.8))
      const ev = ENERGY_MAP[intent?.energy as keyof typeof ENERGY_MAP]
      if (ev !== undefined) energyValues.push(ev)
    }

    if (signal.signalType === 'prompt_used') {
      const ei = d['extractedIntent'] as { energy?: string; tags?: string[] } | undefined
      ei?.tags?.slice(0, 3).forEach(t => tagFreq.set(t, (tagFreq.get(t) ?? 0) + 0.5))
      const ev = ENERGY_MAP[ei?.energy as keyof typeof ENERGY_MAP]
      if (ev !== undefined) energyValues.push(ev * 0.7)
    }

    if (signal.signalType === 'spotify_top_track' || signal.signalType === 'spotify_recent_play') {
      // No genre tags directly but contributes to signal richness — logged for future ML use
    }
  }

  // Top 3 genre tags — prefer recognised genre names over mood/activity tags
  const genreEntries = [...tagFreq.entries()].filter(([t]) => GENRE_TAG_SET.has(t.toLowerCase()))
  const genres = (
    genreEntries.length >= 3
      ? genreEntries
      : [...tagFreq.entries()]
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)

  const energyCentroid = energyValues.length > 0
    ? energyValues.reduce((s, v) => s + v, 0) / energyValues.length
    : 0.5

  const [user, playlistCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.playlistRecord.count({ where: { userId } }),
  ])

  return {
    available: true as const,
    signalCount,
    phaseLabel: derivePhaseLabel(genres, energyCentroid),
    genres,
    energyCentroid,
    playlistCount,
    memberSince: user ? formatMonth(user.createdAt) : '',
  }
}

function derivePhaseLabel(genres: string[], energy: number): string {
  const top = genres[0]?.toLowerCase() ?? ''
  if (energy >= 0.7) {
    if (['techno', 'drum and bass', 'dnb', 'grime', 'drill', 'metal', 'punk'].some(g => top.includes(g))) return 'Relentless and raw'
    if (['hip hop', 'hip-hop', 'trap', 'afrobeats', 'afrobeat'].some(g => top.includes(g))) return 'Hard and in motion'
    if (['electronic', 'house', 'synthwave'].some(g => top.includes(g))) return 'Electric and propulsive'
    return 'High energy and moving'
  }
  if (energy >= 0.45) {
    if (['indie', 'alternative', 'shoegaze', 'dream pop'].some(g => top.includes(g))) return 'Textured and searching'
    if (['r&b', 'rnb', 'soul', 'neo soul', 'funk'].some(g => top.includes(g))) return 'Warm and grooved'
    if (['jazz', 'bossa nova', 'blues'].some(g => top.includes(g))) return 'Fluid and considered'
    if (['folk', 'acoustic', 'country'].some(g => top.includes(g))) return 'Grounded and honest'
    if (['pop', 'indie pop', 'bedroom pop'].some(g => top.includes(g))) return 'Bright and restless'
    return 'Mid-range and exploring'
  }
  if (['ambient', 'drone', 'classical', 'downtempo', 'lo-fi', 'lo fi', 'chillhop'].some(g => top.includes(g))) return 'Still and internal'
  if (['trip hop', 'vaporwave'].some(g => top.includes(g))) return 'Hazy and distant'
  if (genres.length === 0) return 'Your sound is forming'
  return 'Quiet and deliberate'
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
