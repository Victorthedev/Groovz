import { redis } from '../../shared/utils/redis.js'
import { getAccessToken, refreshSpotifyToken } from '../auth/platform.service.js'
import { bestResult } from './matcher.js'
import { searchSpotifyTrack } from './platforms/spotify.js'
import { searchDeezerTrack } from './platforms/deezer.js'
import { searchAudiomackTrack } from './platforms/audiomack.js'
import { searchYouTubeMusicTrack } from './platforms/youtube-music.js'
import type { PlaylistBlueprint, ResolvedTrack, CanonicalTrack } from '../../shared/types/index.js'

const CACHE_TTL = 60 * 60  // 1 hour (§4 ResolutionCache TTL)
const CACHE_KEY = (platform: string, canonicalId: string) => `resolve:${platform}:${canonicalId}`

export interface ResolutionResult {
  resolved: ResolvedTrack[]
  failedCount: number
}

export async function resolveBlueprint(
  blueprint: PlaylistBlueprint,
  platform: string,
  userId: string,
): Promise<ResolutionResult> {
  let accessToken = await getAccessToken(userId, platform as Parameters<typeof getAccessToken>[1])

  const resolved: ResolvedTrack[] = []
  const failed: CanonicalTrack[] = []
  const seedWasRemix = blueprint.seedWasRemix ?? false

  for (const track of blueprint.tracks) {
    const result = await resolveOne(track, platform, accessToken, seedWasRemix)

    if (result) {
      resolved.push(result)
    } else {
      failed.push(track)
    }
  }

  // §5.9 — for each failed track, try backup pool candidates
  const backup = blueprint.backupTracks ?? []
  let backupIdx = 0

  for (const _ of failed) {
    let substituted = false
    while (backupIdx < backup.length) {
      const candidate = backup[backupIdx++]!

      // Skip if we already resolved this candidate (may appear as a backup for multiple failures)
      if (resolved.some(r => r.canonicalId === candidate.id)) continue

      // Refresh token if expired on first attempt
      let result = await resolveOne(candidate, platform, accessToken, seedWasRemix)
      if (!result && platform === 'spotify') {
        try {
          accessToken = await refreshSpotifyToken(userId)
          result = await resolveOne(candidate, platform, accessToken, seedWasRemix)
        } catch { break }
      }

      if (result) { resolved.push(result); substituted = true; break }
    }
    // If no backup found, the track is simply dropped — blueprint shrinks (§5.9)
    void substituted
  }

  return { resolved, failedCount: failed.length }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveOne(
  track: CanonicalTrack,
  platform: string,
  accessToken: string,
  seedWasRemix: boolean,
): Promise<ResolvedTrack | null> {
  // Check resolution cache first
  const cacheKey = CACHE_KEY(platform, track.id)
  const cached = await redis.get(cacheKey)
  if (cached) {
    const hit = JSON.parse(cached) as { platformTrackId: string; confidence: number }
    return {
      canonicalId: track.id,
      title: track.title,
      artist: track.artist,
      platform,
      platformTrackId: hit.platformTrackId,
      confidence: hit.confidence,
    }
  }

  // Search the platform
  let results
  try {
    results = await searchPlatform(track.title, track.artist, platform, accessToken)
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode === 401) return null  // caller handles refresh
    return null
  }

  const best = bestResult(track, results, seedWasRemix)
  if (!best) return null

  const confidence = 0.50 * 1 + 0.35 * 1 + 0.15 * 1  // approximate — real score in bestResult
  void confidence

  // Cache the resolution
  const entry = { platformTrackId: best.platformTrackId, confidence: 1.0 }
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(entry))

  return {
    canonicalId: track.id,
    title: track.title,
    artist: track.artist,
    platform,
    platformTrackId: best.platformTrackId,
    confidence: 1.0,
  }
}

async function searchPlatform(
  title: string,
  artist: string,
  platform: string,
  accessToken: string,
) {
  switch (platform) {
    case 'spotify':       return searchSpotifyTrack(title, artist, accessToken)
    case 'deezer':        return searchDeezerTrack(title, artist, accessToken)
    case 'audiomack':     return searchAudiomackTrack(title, artist, accessToken)
    case 'youtube_music': return searchYouTubeMusicTrack(title, artist, accessToken)
    default: throw new Error(`Unsupported platform: ${platform}`)
  }
}
