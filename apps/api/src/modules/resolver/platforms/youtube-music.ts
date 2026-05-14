import type { PlatformSearchResult } from '../matcher.js'

export async function searchYouTubeMusicTrack(
  _title: string,
  _artist: string,
  _accessToken: string,
): Promise<PlatformSearchResult[]> {
  // §5.9: prefer "Official Artist Channel" verified tracks — implement in full YouTube Data API integration
  throw Object.assign(new Error('YouTube Music resolution not yet implemented'), { statusCode: 501 })
}
