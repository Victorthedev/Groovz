import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { processMessage } from './chat.service.js'

const chatBody = z.object({
  message: z.string().min(1).max(500),
  platform: z.enum(['spotify', 'deezer', 'audiomack', 'youtube_music']),
  sessionId: z.string().uuid().optional(),
})

export async function registerChatRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/chat',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 30, timeWindow: 60_000 } } },
    async (request, reply) => {
      const body = chatBody.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: 'Invalid request' })

      const result = await processMessage(
        request.user.userId,
        body.data.message,
        body.data.platform,
        body.data.sessionId,
      )

      return reply.send(result)
    },
  )
}
