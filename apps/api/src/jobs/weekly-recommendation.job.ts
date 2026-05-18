import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '../shared/utils/prisma.js'
import { computeTasteProfile, mlStage } from '../modules/ml/index.js'
import { startWeeklyGeneration } from '../modules/recommendation/recommendation.service.js'

function makeConnection() {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

const weeklyQueue = new Queue<Record<string, never>>('weekly-recommendation', {
  connection: makeConnection(),
})

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startWeeklyRecommendationJob() {
  new Worker<Record<string, never>>(
    'weekly-recommendation',
    async () => {
      const users = await prisma.user.findMany({ select: { id: true } })

      for (const { id: userId } of users) {
        try {
          await computeTasteProfile(userId)

          const profile = await prisma.tasteProfile.findUnique({
            where:  { userId },
            select: { signalCount: true },
          })

          if (!profile || mlStage(profile.signalCount) < 1) continue

          await startWeeklyGeneration(userId)
        } catch (err) {
          // One user's failure never blocks others
          console.error(`[weekly-recommendation] failed for user ${userId}`, (err as Error).message)
        }
      }
    },
    { connection: makeConnection() },
  )

  // Every Sunday at 02:00 UTC (§18.6)
  weeklyQueue.add('compute-taste-profiles', {}, {
    repeat: { pattern: '0 2 * * 0' },
    jobId:  'weekly-taste-profile-cron',
  })
}
