// v1
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import authPlugin from './modules/auth/index.js'
import userPlugin from './modules/user/index.js'
import recommendationPlugin from './modules/recommendation/index.js'
import billingPlugin from './modules/billing/index.js'
import exportPlugin from './modules/export/index.js'
import chatPlugin from './modules/chat/index.js'
import blendPlugin from './modules/blend/index.js'
import adminPlugin from './modules/admin/index.js'
import { startPlaylistGenerationWorker } from './jobs/playlist-generation.job.js'
import { startSpotifySignalJobs } from './jobs/spotify-signals.job.js'
import { startWeeklyRecommendationJob } from './jobs/weekly-recommendation.job.js'
import { createSocketServer } from './shared/utils/socket.js'

const app = Fastify({ logger: true })

app.register(cookie)

app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: 60_000,
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'You are sending too many requests. Please slow down.',
  }),
})

const WEB_ORIGIN = (process.env.WEB_BASE_URL ?? 'http://localhost:3000').trim()

app.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', WEB_ORIGIN)
  reply.header('Access-Control-Allow-Credentials', 'true')
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Security headers
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  if (req.method === 'OPTIONS') {
    reply.status(204).send()
  }
})

app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production' })

// A single non-encapsulated container carries the /api/v1 prefix.
// fp() plugins inside inherit the container scope (and its prefix) correctly.
// Registering fp() plugins with { prefix } directly on app causes the prefix
// to be skipped because fp() runs in the parent scope, not a new prefixed child.
app.register(async (fastify) => {
  fastify.register(authPlugin)
  fastify.register(userPlugin)
  fastify.register(recommendationPlugin)
  fastify.register(billingPlugin)
  fastify.register(exportPlugin)
  fastify.register(chatPlugin)
  fastify.register(blendPlugin)
  fastify.register(adminPlugin)
}, { prefix: '/api/v1' })

app.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    await app.ready()

    createSocketServer(
      app.server,
      (token) => app.jwt.verify<{ userId: string; type: string }>(token),
    )

    startPlaylistGenerationWorker()
    startSpotifySignalJobs()
    startWeeklyRecommendationJob()

    await app.listen({ port: parseInt(process.env.PORT ?? '3001'), host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
