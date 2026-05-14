import type { PlatformSearchResult } from '../matcher.js'

export async function searchSpotifyTrack(
  title: string,
  artist: string,
  accessToken: string,
): Promise<PlatformSearchResult[]> {
  const q = encodeURIComponent(`${title} ${artist}`)
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${q}&type=track&limit=5`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (res.status === 401) throw Object.assign(new Error('spotify_token_expired'), { statusCode: 401 })
  if (!res.ok) return []

  const data = (await res.json()) as {
    tracks: { items: Array<{
      id: string
      name: string
      artists: Array<{ name: string }>
      duration_ms: number
    }> }
  }

  return (data.tracks?.items ?? []).map(item => ({
    platformTrackId: item.id,
    title: item.name,
    artists: item.artists.map(a => a.name),
    durationMs: item.duration_ms,
  }))
}
