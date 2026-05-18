import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { registerBlendRoutes } from './blend.routes.js'

export default fp(async (fastify: FastifyInstance) => {
  await registerBlendRoutes(fastify)
})
