import type { AudioFeatures } from '../harmonic-sequencer.js'

const API = 'https://api.spotify.com/v1'

export async function getSpotifyUserId(accessToken: string): Promise<string> {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) throw Object.assign(new Error('spotify_token_expired'), { statusCode: 401 })
  if (!res.ok) throw Object.assign(new Error('Failed to fetch Spotify user'), { statusCode: 502 })
  const data = (await res.json()) as { id: string }
  return data.id
}

export async function createSpotifyPlaylist(
  name: string,
  description: string,
  spotifyUserId: string,
  accessToken: string,
): Promise<{ id: string; url: string }> {
  const res = await fetch(`${API}/users/${spotifyUserId}/playlists`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, public: false }),
  })
  if (!res.ok) throw Object.assign(new Error('Failed to create Spotify playlist'), { statusCode: 502 })
  const data = (await res.json()) as { id: string; external_urls: { spotify: string } }
  return { id: data.id, url: data.external_urls.spotify }
}

export async function addTracksToSpotifyPlaylist(
  playlistId: string,
  trackIds: string[],
  accessToken: string,
): Promise<void> {
  // Spotify limits to 100 tracks per request
  for (let i = 0; i < trackIds.length; i += 100) {
    const batch = trackIds.slice(i, i + 100)
    const uris = batch.map(id => `spotify:track:${id}`)
    const res = await fetch(`${API}/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris }),
    })
    if (!res.ok) throw Object.assign(new Error('Failed to add tracks to Spotify playlist'), { statusCode: 502 })
  }
}

// ─── Audio features (for harmonic sequencing) ─────────────────────────────────

export async function getSpotifyAudioFeatures(
  trackIds: string[],
  accessToken: string,
): Promise<Map<string, AudioFeatures>> {
  const features = new Map<string, AudioFeatures>()
  const headers = { Authorization: `Bearer ${accessToken}` }

  // Batch in groups of 100 (Spotify limit)
  for (let i = 0; i < trackIds.length; i += 100) {
    const batch = trackIds.slice(i, i + 100)
    const ids = batch.join(',')

    const res = await fetch(`${API}/audio-features?ids=${ids}`, { headers })
    if (!res.ok) continue  // non-fatal — sequencer falls back to neutral defaults

    const data = (await res.json()) as {
      audio_features: Array<{
        id: string
        tempo: number
        key: number
        mode: number
        energy: number
      } | null>
    }

    for (const f of data.audio_features) {
      if (!f) continue  // null = Spotify couldn't analyse this track (e.g. local file)
      features.set(f.id, {
        id: f.id,
        tempo: f.tempo,
        key: f.key,
        mode: f.mode,
        energy: f.energy,
      })
    }
  }

  return features
}
