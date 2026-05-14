import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exportBlueprint } from './export.service.js'

const exportBody = z.object({
  platform: z.enum(['spotify', 'deezer', 'audiomack', 'youtube_music']),
})

export async function registerExportRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/playlists/:id/export',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = exportBody.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: 'Invalid platform' })

      const result = await exportBlueprint(id, body.data.platform, request.user.userId)
      return reply.send(result)
    },
  )
}
