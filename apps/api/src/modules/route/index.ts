import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { registerRouteRoutes } from './route.routes.js'

async function routePlugin(fastify: FastifyInstance) {
  await registerRouteRoutes(fastify)
}

export default fp(routePlugin, { name: 'route', dependencies: ['auth'] })
