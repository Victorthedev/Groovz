import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { registerExportRoutes } from './export.routes.js'

async function exportPlugin(fastify: FastifyInstance) {
  await registerExportRoutes(fastify)
}

export default fp(exportPlugin, { name: 'export', dependencies: ['auth'] })
