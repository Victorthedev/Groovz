export async function createYouTubeMusicPlaylist(_name: string, _accessToken: string): Promise<{ id: string; url: string }> {
  throw Object.assign(new Error('YouTube Music export not yet implemented'), { statusCode: 501 })
}
export async function addTracksToYouTubeMusicPlaylist(_id: string, _trackIds: string[], _token: string): Promise<void> {
  throw Object.assign(new Error('YouTube Music export not yet implemented'), { statusCode: 501 })
}
