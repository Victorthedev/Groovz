import { redis } from '../../../shared/utils/redis.js'

const BASE_URL    = 'https://ws.audioscrobbler.com/2.0/'
const RATE_LIMIT_MS = 210  // ~4.7 req/sec, safely under Last.fm's 5/sec
const CACHE_TTL     = 86_400  // 24 hours — artist/album data is stable day-to-day

// ─── Response shape types ─────────────────────────────────────────────────────

export interface LastFmSimilarTrack {
  name: string
  artist: string
  match: number
  durationMs: number
  listeners: number
}

export interface LastFmSimilarArtist {
  name: string
  match: number
}

export interface LastFmArtistTrack {
  name: string
  artist: string
  durationMs: number
  listeners: number
  playcount: number
}

export interface LastFmAlbumTrack {
  name: string
  artist: string
  durationMs: number
}

// ─── Cache key helper ─────────────────────────────────────────────────────────

function ck(...parts: (string | number)[]): string {
  return 'lfm:' + parts
    .map(p => String(p).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 80))
    .join(':')
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

class RequestQueue {
  private queue: Array<() => Promise<void>> = []
  private running = false

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try { resolve(await fn()) } catch (e) { reject(e) }
      })
      if (!this.running) this.drain()
    })
  }

  private async drain() {
    this.running = true
    while (this.queue.length > 0) {
      await this.queue.shift()!()
      if (this.queue.length > 0) await sleep(RATE_LIMIT_MS)
    }
    this.running = false
  }
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err
      await sleep(Math.pow(2, i) * 1000)
    }
  }
  throw new Error('unreachable')
}

// ─── Client ───────────────────────────────────────────────────────────────────

class LastFmClient {
  private queue = new RequestQueue()

  private get apiKey(): string {
    const key = process.env.LASTFM_API_KEY
    if (!key) throw new Error('LASTFM_API_KEY not configured')
    return key
  }

  private fetch<T>(params: Record<string, string>): Promise<T> {
    return this.queue.enqueue(() =>
      withRetry(async () => {
        const url = new URL(BASE_URL)
        url.search = new URLSearchParams({
          ...params,
          api_key: this.apiKey,
          format: 'json',
        }).toString()

        const res = await fetch(url.toString())
        if (!res.ok) throw new Error(`Last.fm ${res.status}: ${params['method']}`)
        const data = await res.json() as Record<string, unknown>
        if (data['error']) throw new Error(`Last.fm error ${data['error']}: ${data['message']}`)
        return data as T
      }),
    )
  }

  async getSimilarTracks(
    track: string,
    artist: string,
    limit = 100,
  ): Promise<LastFmSimilarTrack[]> {
    const key = ck('st', artist, track, limit)
    const hit = await redis.get(key)
    if (hit) return JSON.parse(hit) as LastFmSimilarTrack[]

    try {
      const data = await this.fetch<{
        similartracks: { track: Array<{
          name: string
          match: string
          duration: string
          listeners?: string
          artist: { name: string }
        }> }
      }>({ method: 'track.getSimilar', track, artist, limit: String(limit), autocorrect: '1' })

      const result = (data.similartracks.track ?? []).map(t => ({
        name: t.name,
        artist: t.artist.name,
        match: parseFloat(t.match),
        durationMs: parseInt(t.duration || '0') * 1000,
        listeners: parseInt(t.listeners ?? '0'),
      }))
      await redis.setex(key, CACHE_TTL, JSON.stringify(result))
      return result
    } catch {
      return []
    }
  }

  async getSimilarArtists(artist: string, limit = 50): Promise<LastFmSimilarArtist[]> {
    const key = ck('sa', artist, limit)
    const hit = await redis.get(key)
    if (hit) return JSON.parse(hit) as LastFmSimilarArtist[]

    try {
      const data = await this.fetch<{
        similarartists: { artist: Array<{ name: string; match: string }> }
      }>({ method: 'artist.getSimilar', artist, limit: String(limit), autocorrect: '1' })

      const result = (data.similarartists.artist ?? []).map(a => ({
        name: a.name,
        match: parseFloat(a.match),
      }))
      await redis.setex(key, CACHE_TTL, JSON.stringify(result))
      return result
    } catch {
      return []
    }
  }

  async getArtistTopTracks(artist: string, limit = 10, page = 1): Promise<LastFmArtistTrack[]> {
    const key = ck('tt', artist, limit, page)
    const hit = await redis.get(key)
    if (hit) return JSON.parse(hit) as LastFmArtistTrack[]

    try {
      const data = await this.fetch<{
        toptracks: { track: Array<{
          name: string
          duration: string
          listeners: string
          playcount: string
          artist: { name: string }
        }> }
      }>({ method: 'artist.getTopTracks', artist, limit: String(limit), page: String(page), autocorrect: '1' })

      const result = (data.toptracks.track ?? []).map(t => ({
        name: t.name,
        artist: t.artist.name,
        durationMs: parseInt(t.duration || '0') * 1000,
        listeners: parseInt(t.listeners ?? '0'),
        playcount: parseInt(t.playcount ?? '0'),
      }))
      await redis.setex(key, CACHE_TTL, JSON.stringify(result))
      return result
    } catch {
      return []
    }
  }

  async getArtistTopTags(artist: string): Promise<string[]> {
    const key = ck('tags', artist)
    const hit = await redis.get(key)
    if (hit) return JSON.parse(hit) as string[]

    try {
      const data = await this.fetch<{
        toptags: { tag: Array<{ name: string; count: string }> }
      }>({ method: 'artist.getTopTags', artist, autocorrect: '1' })

      const result = (data.toptags.tag ?? []).slice(0, 10).map(t => t.name)
      await redis.setex(key, CACHE_TTL, JSON.stringify(result))
      return result
    } catch {
      return []
    }
  }

  async getTagTopArtists(tag: string, limit = 20, page = 1): Promise<string[]> {
    const key = ck('tagartists', tag, limit, page)
    const hit = await redis.get(key)
    if (hit) return JSON.parse(hit) as string[]

    try {
      const data = await this.fetch<{
        topartists: { artist: Array<{ name: string }> }
      }>({ method: 'tag.getTopArtists', tag, limit: String(limit), page: String(page) })

      const result = (data.topartists.artist ?? []).map(a => a.name)
      await redis.setex(key, CACHE_TTL, JSON.stringify(result))
      return result
    } catch {
      return []
    }
  }

  async getArtistTopAlbums(artist: string, limit = 3): Promise<Array<{ name: string; artist: string }>> {
    const key = ck('albums', artist, limit)
    const hit = await redis.get(key)
    if (hit) return JSON.parse(hit) as Array<{ name: string; artist: string }>

    try {
      const data = await this.fetch<{
        topalbums: { album: Array<{ name: string; artist: { name: string } }> }
      }>({ method: 'artist.getTopAlbums', artist, limit: String(limit), autocorrect: '1' })

      const SKIP = /greatest hits|best of|compilation|live at|live from|collection|essential|anthology|deluxe|remaster/i
      const result = (data.topalbums.album ?? [])
        .filter(a => !SKIP.test(a.name))
        .map(a => ({ name: a.name, artist: a.artist.name }))

      await redis.setex(key, CACHE_TTL, JSON.stringify(result))
      return result
    } catch {
      return []
    }
  }

  async getAlbumTracks(artist: string, album: string): Promise<LastFmAlbumTrack[]> {
    const key = ck('albumtracks', artist, album)
    const hit = await redis.get(key)
    if (hit) return JSON.parse(hit) as LastFmAlbumTrack[]

    try {
      const data = await this.fetch<{
        album: {
          tracks?: {
            track:
              | Array<{ name: string; duration: string; artist: { name: string } }>
              | { name: string; duration: string; artist: { name: string } }
          }
        }
      }>({ method: 'album.getInfo', artist, album, autocorrect: '1' })

      if (!data.album.tracks) {
        await redis.setex(key, CACHE_TTL, '[]')
        return []
      }

      const raw = data.album.tracks.track
      const tracks = Array.isArray(raw) ? raw : [raw]

      const result = tracks.map(t => ({
        name: t.name,
        artist: t.artist.name,
        durationMs: parseInt(t.duration || '0') * 1000,
      }))
      await redis.setex(key, CACHE_TTL, JSON.stringify(result))
      return result
    } catch {
      return []
    }
  }
}

export const lastfm = new LastFmClient()

// ─── Util ─────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
