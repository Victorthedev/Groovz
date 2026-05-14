import type { PlatformSearchResult } from '../matcher.js'

export async function searchAudiomackTrack(
  _title: string,
  _artist: string,
  _accessToken: string,
): Promise<PlatformSearchResult[]> {
  throw Object.assign(new Error('Audiomack resolution not yet implemented'), { statusCode: 501 })
}
