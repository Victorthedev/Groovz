import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { registerAuthRoutes } from './auth.routes.js'
import { registerPlatformRoutes } from './platform.routes.js'

// Decorate fastify with the authenticate preHandler so any route can use it
async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: Parameters<typeof fastify.authenticate>[0], reply: Parameters<typeof fastify.authenticate>[1]) {
    try {
      await request.jwtVerify()
      if (request.user.type !== 'access') {
        return reply.status(401).send({ error: 'Unauthorized' })
      }
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  await registerAuthRoutes(fastify)
  await registerPlatformRoutes(fastify)
}

// fp() makes the decorators visible to the parent scope
export default fp(authPlugin, { name: 'auth' })
