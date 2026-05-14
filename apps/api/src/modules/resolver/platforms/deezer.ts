import type { PlatformSearchResult } from '../matcher.js'

export async function searchDeezerTrack(
  _title: string,
  _artist: string,
  _accessToken: string,
): Promise<PlatformSearchResult[]> {
  throw Object.assign(new Error('Deezer resolution not yet implemented'), { statusCode: 501 })
}
