import type { FastifyInstance } from 'fastify'
import authPlugin from '../modules/auth/index.js'
import userPlugin from '../modules/user/index.js'
import recommendationPlugin from '../modules/recommendation/index.js'
import billingPlugin from '../modules/billing/index.js'
import exportPlugin from '../modules/export/index.js'

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.register(authPlugin, { prefix: '/api/v1' })
  fastify.register(userPlugin, { prefix: '/api/v1' })
  fastify.register(recommendationPlugin, { prefix: '/api/v1' })
  fastify.register(billingPlugin, { prefix: '/api/v1' })
  fastify.register(exportPlugin, { prefix: '/api/v1' })
}
