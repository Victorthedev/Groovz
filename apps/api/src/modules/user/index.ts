import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { registerUserRoutes } from './user.routes.js'

async function userPlugin(fastify: FastifyInstance) {
  await registerUserRoutes(fastify)
}

export default fp(userPlugin, { name: 'user', dependencies: ['auth'] })
