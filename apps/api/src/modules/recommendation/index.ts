import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { registerRecommendationRoutes } from './recommendation.routes.js'

async function recommendationPlugin(fastify: FastifyInstance) {
  await registerRecommendationRoutes(fastify)
}

export default fp(recommendationPlugin, { name: 'recommendation', dependencies: ['auth'] })
