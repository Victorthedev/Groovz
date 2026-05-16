import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '../shared/utils/prisma.js'
import { withSpotifyToken } from '../modules/auth/platform.service.js'

function makeConnection() {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

const spotifySignalsQueue = new Queue<Record<string, never>>('spotify-signals', {
  connection: makeConnection(),
})

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function runRecentlyPlayed(): Promise<void> {
  const users = await prisma.connectedPlatform.findMany({
    where: { platform: 'spotify' },
    select: { userId: true },
  })

  for (const { userId } of users) {
    const prefs = await prisma.userPreferences.findUnique({ where: { userId } })
    if (prefs?.spotifySignalEnabled === false) continue

    try {
      await withSpotifyToken(userId, async (token) => {
        const res = await fetch(
          'https://api.spotify.com/v1/me/player/recently-played?limit=50',
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) return

        const data = await res.json() as {
          items: Array<{
            played_at: string
            track: { name: string; artists: Array<{ name: string }>; duration_ms: number }
          }>
        }

        // Dedup — skip tracks already logged by this played_at timestamp
        const existingKeys = new Set(
          (await prisma.userSignal.findMany({
            where: { userId, signalType: 'spotify_recent_play' },
            orderBy: { recordedAt: 'desc' },
            take: 100,
            select: { data: true },
          })).map(s => (s.data as { playedAt?: string }).playedAt ?? ''),
        )

        const toInsert = data.items.filter(i => !existingKeys.has(i.played_at))
        if (toInsert.length === 0) return

        await prisma.userSignal.createMany({
          data: toInsert.map(item => ({
            userId,
            signalType: 'spotify_recent_play' as const,
            data: {
              title: item.track.name,
              artist: item.track.artists[0]?.name ?? '',
              durationMs: item.track.duration_ms,
              playedAt: item.played_at,
            },
          })),
        })
      })
    } catch {
      // One user's failure never blocks others
    }
  }
}

async function runTopTracks(): Promise<void> {
  const users = await prisma.connectedPlatform.findMany({
    where: { platform: 'spotify' },
    select: { userId: true },
  })

  const terms = ['short_term', 'medium_term', 'long_term'] as const

  for (const { userId } of users) {
    const prefs = await prisma.userPreferences.findUnique({ where: { userId } })
    if (prefs?.spotifySignalEnabled === false) continue

    try {
      await withSpotifyToken(userId, async (token) => {
        for (const term of terms) {
          const res = await fetch(
            `https://api.spotify.com/v1/me/top/tracks?time_range=${term}&limit=50`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          if (!res.ok) continue

          const data = await res.json() as {
            items: Array<{ name: string; artists: Array<{ name: string }>; popularity: number }>
          }

          await prisma.userSignal.createMany({
            data: data.items.map((track, rank) => ({
              userId,
              signalType: 'spotify_top_track' as const,
              data: { title: track.name, artist: track.artists[0]?.name ?? '', term, rank },
            })),
          })
        }
      })
    } catch {
      // One user's failure never blocks others
    }
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startSpotifySignalJobs() {
  new Worker<Record<string, never>>(
    'spotify-signals',
    async (job) => {
      if (job.name === 'recently_played') await runRecentlyPlayed()
      if (job.name === 'top_tracks')      await runTopTracks()
    },
    { connection: makeConnection() },
  )

  // Recently played — every 6 hours
  spotifySignalsQueue.add('recently_played', {}, {
    repeat: { pattern: '0 */6 * * *' },
    jobId: 'spotify-recent-cron',
  })

  // Top tracks — every Sunday at 00:00 UTC
  spotifySignalsQueue.add('top_tracks', {}, {
    repeat: { pattern: '0 0 * * 0' },
    jobId: 'spotify-top-cron',
  })
}
