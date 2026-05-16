import { randomBytes } from 'crypto'
import { Platform } from '@prisma/client'
import { prisma } from '../../shared/utils/prisma.js'
import { redis } from '../../shared/utils/redis.js'
import { encrypt, decrypt } from '../../shared/utils/encryption.js'
import { platformConfigs, SUPPORTED_PLATFORMS, type SupportedPlatform } from './platform.config.js'
import type { LibraryTrack, LibraryPlaylist } from '../../shared/types/index.js'

const DISPLAY_PLAYLIST_TTL_SECONDS = 60 * 60 * 2  // 2 hours

export interface LibraryData {
  tracks: LibraryTrack[]
  playlists: LibraryPlaylist[]
}

const CALLBACK_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001'
const DISPLAY_ID_TTL_SECONDS = 60 * 60 * 2 // 2 hours

// ─── OAuth URL generation ─────────────────────────────────────────────────────

export async function getOAuthUrl(
  platform: SupportedPlatform,
  userId: string,
  signState: (userId: string, platform: string) => string,
): Promise<string> {
  if (platform === 'audiomack') {
    throw Object.assign(new Error('Audiomack not yet implemented'), { statusCode: 501 })
  }

  // Platform locking — free tier: 1 connected platform at a time (§9)
  const [capabilities, connected] = await Promise.all([
    prisma.userCapabilities.findUnique({ where: { userId }, select: { plan: true } }),
    prisma.connectedPlatform.findMany({ where: { userId }, select: { platform: true } }),
  ])

  if (capabilities?.plan === 'free' && connected.length >= 1) {
    const alreadyConnected = connected.some(c => c.platform === platform)
    if (!alreadyConnected) {
      throw Object.assign(
        new Error('Free plan supports 1 connected platform. Disconnect your current platform first, or upgrade to connect multiple.'),
        { statusCode: 403 },
      )
    }
  }

  const config = platformConfigs[platform]
  const state = signState(userId, platform)
  const callbackUrl = `${CALLBACK_BASE}/api/v1/platforms/callback/${platform}`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(platform),
    redirect_uri: callbackUrl,
    scope: config.scopes.join(' '),
    state,
  })

  if (platform === 'spotify') {
    params.set('show_dialog', 'true')
  }

  return `${config.authUrl}?${params.toString()}`
}

// ─── OAuth callback ───────────────────────────────────────────────────────────

export async function handleOAuthCallback(
  platform: SupportedPlatform,
  code: string,
  state: string,
  verifyState: (state: string) => { userId: string; platform: string },
): Promise<{ userId: string }> {
  const { userId } = verifyState(state)

  if (platform === 'spotify') {
    await handleSpotifyCallback(userId, code)
  } else {
    throw Object.assign(new Error(`${platform} not yet implemented`), { statusCode: 501 })
  }

  return { userId }
}

// ─── Connected platforms list ─────────────────────────────────────────────────

export async function getConnectedPlatforms(userId: string) {
  const rows = await prisma.connectedPlatform.findMany({
    where: { userId },
    select: { platform: true, connectedAt: true },
    orderBy: { connectedAt: 'desc' },
  })
  return rows.map(r => ({ platform: r.platform as string, connectedAt: r.connectedAt }))
}

// ─── Library fetch ────────────────────────────────────────────────────────────

export async function getLibrary(
  userId: string,
  platform: SupportedPlatform,
): Promise<LibraryData> {
  if (platform === 'spotify') return getSpotifyLibrary(userId)
  throw Object.assign(new Error(`${platform} library not yet implemented`), { statusCode: 501 })
}

export async function getPlaylistTracks(
  userId: string,
  platform: SupportedPlatform,
  displayPlaylistId: string,
): Promise<LibraryTrack[]> {
  if (platform === 'spotify') return getSpotifyPlaylistTracks(userId, displayPlaylistId)
  throw Object.assign(new Error(`${platform} playlist tracks not yet implemented`), { statusCode: 501 })
}

// ─── Resolve a displayId back to { title, artist } for the recommendation engine

export async function resolveDisplayId(
  userId: string,
  displayId: string,
): Promise<{ title: string; artist: string } | null> {
  const raw = await redis.get(`display:${userId}:${displayId}`)
  if (!raw) return null
  const entry = JSON.parse(raw) as { title: string; artist: string }
  return { title: entry.title, artist: entry.artist }
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

export async function disconnectPlatform(
  userId: string,
  platform: SupportedPlatform,
): Promise<void> {
  await prisma.connectedPlatform.deleteMany({
    where: { userId, platform: platform as Platform },
  })
}

// ─── Spotify implementation ───────────────────────────────────────────────────

async function handleSpotifyCallback(userId: string, code: string): Promise<void> {
  const callbackUrl = `${CALLBACK_BASE}/api/v1/platforms/callback/spotify`
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString('base64')

  const res = await fetch(platformConfigs.spotify.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
    }),
  })

  if (!res.ok) {
    throw Object.assign(new Error('Spotify token exchange failed'), { statusCode: 502 })
  }

  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    scope: string
  }

  await prisma.connectedPlatform.upsert({
    where: { userId_platform: { userId, platform: Platform.spotify } },
    create: {
      userId,
      platform: Platform.spotify,
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      scopes: data.scope.split(' '),
    },
    update: {
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      scopes: data.scope.split(' '),
    },
  })
}

async function getSpotifyLibrary(userId: string): Promise<LibraryData> {
  return withSpotifyToken(userId, async (accessToken) => {
  const headers = { Authorization: `Bearer ${accessToken}` }

  // Fetch liked songs and playlists in parallel
  const [tracksRes, playlistsRes] = await Promise.all([
    fetch('https://api.spotify.com/v1/me/tracks?limit=50', { headers }),
    fetch('https://api.spotify.com/v1/me/playlists?limit=50', { headers }),
  ])

  if (tracksRes.status === 401 || playlistsRes.status === 401) {
    throw Object.assign(new Error('spotify_token_expired'), { statusCode: 401 })
  }
  if (!tracksRes.ok) throw Object.assign(new Error('Spotify library fetch failed'), { statusCode: 502 })

  const tracksData = (await tracksRes.json()) as {
    items: Array<{
      track: {
        id: string
        name: string
        artists: Array<{ name: string }>
        album: { images: Array<{ url: string }> }
      }
    }>
  }

  const playlistsData = playlistsRes.ok
    ? (await playlistsRes.json()) as {
        items: Array<{
          id: string
          name: string
          tracks: { total: number }
          images: Array<{ url: string }>
        }>
      }
    : { items: [] }

  // Build liked songs with displayId mappings
  const tracks: LibraryTrack[] = []
  for (const item of tracksData.items) {
    const { track } = item
    const displayId = randomBytes(16).toString('hex')
    await redis.setex(
      `display:${userId}:${displayId}`,
      DISPLAY_ID_TTL_SECONDS,
      JSON.stringify({ title: track.name, artist: track.artists[0]?.name ?? '', platformTrackId: track.id }),
    )
    tracks.push({
      displayId,
      title: track.name,
      artist: track.artists[0]?.name ?? '',
      artworkUrl: track.album.images[0]?.url ?? '',
      source: 'spotify',
    })
  }

  // Build playlists with displayPlaylistId mappings
  const playlists: LibraryPlaylist[] = []
  for (const pl of playlistsData.items) {
    const displayPlaylistId = randomBytes(16).toString('hex')
    await redis.setex(
      `dplaylist:${userId}:${displayPlaylistId}`,
      DISPLAY_PLAYLIST_TTL_SECONDS,
      JSON.stringify({ name: pl.name, platformPlaylistId: pl.id }),
    )
    playlists.push({
      displayPlaylistId,
      name: pl.name,
      trackCount: pl.tracks.total,
      artworkUrl: pl.images[0]?.url ?? '',
      source: 'spotify',
    })
  }

  return { tracks, playlists }
  })
}

async function getSpotifyPlaylistTracks(userId: string, displayPlaylistId: string): Promise<LibraryTrack[]> {
  const raw = await redis.get(`dplaylist:${userId}:${displayPlaylistId}`)
  if (!raw) throw Object.assign(new Error('Playlist not found — refetch library'), { statusCode: 400 })

  const { platformPlaylistId } = JSON.parse(raw) as { name: string; platformPlaylistId: string }

  return withSpotifyToken(userId, async (accessToken) => {
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${platformPlaylistId}/tracks?limit=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (res.status === 401) throw Object.assign(new Error('spotify_token_expired'), { statusCode: 401 })
  if (!res.ok) throw Object.assign(new Error('Spotify playlist fetch failed'), { statusCode: 502 })

  const data = (await res.json()) as {
    items: Array<{
      track: {
        id: string
        name: string
        artists: Array<{ name: string }>
        album: { images: Array<{ url: string }> }
      } | null
    }>
  }

  const tracks: LibraryTrack[] = []
  for (const item of data.items) {
    if (!item.track) continue  // local files in playlists have null track
    const { track } = item
    const displayId = randomBytes(16).toString('hex')
    await redis.setex(
      `display:${userId}:${displayId}`,
      DISPLAY_ID_TTL_SECONDS,
      JSON.stringify({ title: track.name, artist: track.artists[0]?.name ?? '', platformTrackId: track.id }),
    )
    tracks.push({
      displayId,
      title: track.name,
      artist: track.artists[0]?.name ?? '',
      artworkUrl: track.album.images[0]?.url ?? '',
      source: 'spotify',
    })
  }

  return tracks
  })
}

// ─── Token access (used by resolver + export modules) ────────────────────────

export async function getAccessToken(userId: string, platform: SupportedPlatform): Promise<string> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId, platform: platform as Platform } },
  })
  if (!connection) {
    throw Object.assign(new Error(`${platform} not connected`), { statusCode: 400 })
  }
  return decrypt(connection.accessToken)
}

export async function refreshSpotifyToken(userId: string): Promise<string> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId, platform: Platform.spotify } },
  })
  if (!connection) throw Object.assign(new Error('Spotify not connected'), { statusCode: 400 })

  const refreshToken = decrypt(connection.refreshToken)
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString('base64')

  const res = await fetch(platformConfigs.spotify.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })

  if (!res.ok) throw Object.assign(new Error('Spotify token refresh failed'), { statusCode: 502 })

  const data = (await res.json()) as { access_token: string }

  await prisma.connectedPlatform.update({
    where: { userId_platform: { userId, platform: Platform.spotify } },
    data: { accessToken: encrypt(data.access_token) },
  })

  return data.access_token
}

// ─── Shared token refresh wrapper ────────────────────────────────────────────
// Runs fn with the current access token. On a 401 from Spotify, refreshes
// once silently and retries. If still 401 after refresh, throws — meaning
// the refresh token itself is invalid (user revoked app in Spotify settings).

export async function withSpotifyToken<T>(
  userId: string,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  const token = await getAccessToken(userId, 'spotify')
  try {
    return await fn(token)
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      const refreshed = await refreshSpotifyToken(userId)
      return fn(refreshed)
    }
    throw err
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientId(platform: SupportedPlatform): string {
  const ids: Record<SupportedPlatform, string | undefined> = {
    spotify: process.env.SPOTIFY_CLIENT_ID,
    deezer: process.env.DEEZER_APP_ID,
    audiomack: process.env.AUDIOMACK_CONSUMER_KEY,
    youtube_music: process.env.YOUTUBE_MUSIC_CLIENT_ID,
  }
  const id = ids[platform]
  if (!id) throw Object.assign(new Error(`${platform} client ID not configured`), { statusCode: 500 })
  return id
}

export { SUPPORTED_PLATFORMS }
