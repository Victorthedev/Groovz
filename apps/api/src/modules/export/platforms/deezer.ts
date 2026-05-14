export async function createDeezerPlaylist(_name: string, _accessToken: string): Promise<{ id: string; url: string }> {
  throw Object.assign(new Error('Deezer export not yet implemented'), { statusCode: 501 })
}
export async function addTracksToDeezerPlaylist(_id: string, _trackIds: string[], _token: string): Promise<void> {
  throw Object.assign(new Error('Deezer export not yet implemented'), { statusCode: 501 })
}
