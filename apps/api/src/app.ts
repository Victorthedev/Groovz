import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { registerRoutes } from './api/index.js'
import { startPlaylistGenerationWorker } from './jobs/playlist-generation.job.js'
import { createSocketServer } from './shared/utils/socket.js'

const app = Fastify({ logger: true })

app.register(cors)
app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production' })

app.register(registerRoutes)

app.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    // ready() ensures JWT plugin is initialised before we reference app.jwt.verify
    await app.ready()

    createSocketServer(
      app.server,
      (token) => app.jwt.verify<{ userId: string; type: string }>(token),
    )

    startPlaylistGenerationWorker()

    await app.listen({ port: 3001, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
