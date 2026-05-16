import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { registerChatRoutes } from './chat.routes.js'

async function chatPlugin(fastify: FastifyInstance) {
  await registerChatRoutes(fastify)
}

export default fp(chatPlugin, { name: 'chat', dependencies: ['auth'] })
