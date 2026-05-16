// v1
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import authPlugin from './modules/auth/index.js'
import userPlugin from './modules/user/index.js'
import recommendationPlugin from './modules/recommendation/index.js'
import billingPlugin from './modules/billing/index.js'
import exportPlugin from './modules/export/index.js'
import chatPlugin from './modules/chat/index.js'
import { startPlaylistGenerationWorker } from './jobs/playlist-generation.job.js'
import { createSocketServer } from './shared/utils/socket.js'

const app = Fastify({ logger: true })

app.register(cors, {
  origin: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
  credentials: true,
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

    await app.listen({ port: parseInt(process.env.PORT ?? '3001'), host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
