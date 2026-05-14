export interface PlatformOAuthConfig {
  authUrl: string
  tokenUrl: string
  scopes: string[]
}

export const platformConfigs: Record<string, PlatformOAuthConfig> = {
  spotify: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    scopes: [
      'user-read-private',
      'user-read-email',
      'user-library-read',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-recently-played',
      'user-top-read',
    ],
  },
  deezer: {
    authUrl: 'https://connect.deezer.com/oauth/auth.php',
    tokenUrl: 'https://connect.deezer.com/oauth/access_token.php',
    scopes: ['basic_access', 'email', 'manage_library', 'offline_access'],
  },
  audiomack: {
    // Audiomack uses OAuth 1.0a — full implementation deferred to v1 platform expansion
    authUrl: 'https://www.audiomack.com/oauth/authenticate',
    tokenUrl: 'https://www.audiomack.com/oauth/access_token',
    scopes: [],
  },
  youtube_music: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
  },
}

export const SUPPORTED_PLATFORMS = ['spotify', 'deezer', 'audiomack', 'youtube_music'] as const
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number]
