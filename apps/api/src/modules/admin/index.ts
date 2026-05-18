import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { registerAdminRoutes } from './admin.routes.js'

export default fp(async (fastify: FastifyInstance) => {
  await registerAdminRoutes(fastify)
})
