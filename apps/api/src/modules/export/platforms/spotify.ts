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
