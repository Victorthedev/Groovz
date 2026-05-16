import { lastfm } from '../clients/lastfm.js'
import { canonicalId, normaliseArtist } from './normaliser.js'
import { deriveTrackFeatures } from '../../../shared/data/tag-mappings.js'
import { DEFAULT_TRACK_DURATION_MS } from '../../../shared/utils/index.js'
import type { CanonicalTrack, Intent } from '../../../shared/types/index.js'
import type { CandidatePool } from '../../../shared/types/session.js'

// Oversampling targets (§5.2)
const TARGET_60MIN = 400
const TARGET_120MIN = 900

// ─── Public API ───────────────────────────────────────────────────────────────

export async function expandFromSeed(
  seedTitle: string,
  seedArtist: string,
  targetDurationMs: number,
): Promise<CandidatePool> {
  const targetRaw = targetDurationMs >= 100 * 60 * 1000 ? TARGET_120MIN : TARGET_60MIN
  const raw = new Map<string, CanonicalTrack>()

  // Step 1 — direct track similarity (highest quality signal)
  const similarTracks = await lastfm.getSimilarTracks(seedTitle, seedArtist, 100)
  for (const t of similarTracks) {
    addToRaw(raw, t.name, t.artist, {
      baseSimilarity: t.match * 0.7,  // track weight — artist component added below
      durationMs: t.durationMs || undefined,
      listeners: t.listeners,
    })
  }

  // Step 2 — similar artists
  const similarArtists = await lastfm.getSimilarArtists(seedArtist, 50)

  // Step 3+4 — top tracks + tags for each similar artist (and seed artist)
  const artistsToExpand = [
    { name: seedArtist, match: 1.0 },
    ...similarArtists.slice(0, 40),
  ]

  for (const { name: artist, match: artistSim } of artistsToExpand) {
    const [tracks, tags] = await Promise.all([
      lastfm.getArtistTopTracks(artist, targetRaw >= TARGET_120MIN ? 15 : 10),
      lastfm.getArtistTopTags(artist),
    ])

    for (const t of tracks) {
      const id = canonicalId(t.artist, t.name)
      const existing = raw.get(id)
      const artistContribution = artistSim * 0.3

      if (existing) {
        // Enrich similarity: the track was already found via getSimilarTracks,
        // add the artist component to its base similarity
        existing.baseSimilarity = Math.min(1, existing.baseSimilarity + artistContribution)
        if (!existing.tags.length) existing.tags = tags
      } else {
        addToRaw(raw, t.name, t.artist, {
          baseSimilarity: artistContribution,  // no direct track match
          durationMs: t.durationMs || undefined,
          listeners: t.listeners,
          tags,
        })
      }
    }

    if (raw.size >= targetRaw) break
  }

  return buildPool(raw)
}

export async function expandFromPrompt(
  intent: Intent,
  targetDurationMs: number,
): Promise<CandidatePool> {
  const targetRaw = targetDurationMs >= 100 * 60 * 1000 ? TARGET_120MIN : TARGET_60MIN
  const raw = new Map<string, CanonicalTrack>()

  const tags = intent.tags ?? []
  if (tags.length === 0) return buildPool(raw)

  for (const tag of tags.slice(0, 10)) {
    const artists = await lastfm.getTagTopArtists(tag, 20)

    for (const artist of artists) {
      const [tracks, artistTags] = await Promise.all([
        lastfm.getArtistTopTracks(artist, 15),
        lastfm.getArtistTopTags(artist),
      ])

      for (const t of tracks) {
        const tagOverlap = computeTagOverlap(artistTags, tags)
        addToRaw(raw, t.name, t.artist, {
          baseSimilarity: tagOverlap,
          durationMs: t.durationMs || undefined,
          listeners: t.listeners,
          tags: artistTags,
        })
      }

      if (raw.size >= targetRaw) break
    }

    if (raw.size >= targetRaw) break
  }

  return buildPool(raw)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RawInput {
  baseSimilarity: number
  durationMs?: number
  listeners?: number
  tags?: string[]
}

function addToRaw(
  raw: Map<string, CanonicalTrack>,
  title: string,
  artist: string,
  input: RawInput,
): void {
  const id = canonicalId(artist, title)
  if (raw.has(id)) return  // dedup — first entry wins

  const tags = input.tags ?? []
  const { energy, tempo } = deriveTrackFeatures(tags)

  raw.set(id, {
    id,
    title,
    artist,
    tags,
    baseSimilarity: Math.min(1, input.baseSimilarity),
    durationMs: input.durationMs || DEFAULT_TRACK_DURATION_MS,
    popularity: normaliseListeners(input.listeners ?? 0),
    energy: energy ?? undefined,
    tempo: tempo ?? undefined,
  })
}

function buildPool(raw: Map<string, CanonicalTrack>): CandidatePool {
  const pool: CandidatePool = {
    tracks: raw,
    byArtist: new Map(),
    byTag: new Map(),
    unpicked: new Set(raw.keys()),
  }

  for (const [id, track] of raw) {
    const normArtist = normaliseArtist(track.artist)
    if (!pool.byArtist.has(normArtist)) pool.byArtist.set(normArtist, new Set())
    pool.byArtist.get(normArtist)!.add(id)

    for (const tag of track.tags) {
      if (!pool.byTag.has(tag)) pool.byTag.set(tag, new Set())
      pool.byTag.get(tag)!.add(id)
    }
  }

  return pool
}

// log10-based normalisation — 1M listeners → 1.0, ~1K → 0.5
function normaliseListeners(listeners: number): number {
  return Math.min(1, Math.log10(listeners + 1) / 6)
}

// Tag overlap: what fraction of the intent tags appear in the track tags?
function computeTagOverlap(trackTags: string[], intentTags: string[]): number {
  if (intentTags.length === 0) return 0.5
  const trackSet = new Set(trackTags.map(t => t.toLowerCase()))
  const matches = intentTags.filter(t => trackSet.has(t.toLowerCase())).length
  return matches / intentTags.length
}
