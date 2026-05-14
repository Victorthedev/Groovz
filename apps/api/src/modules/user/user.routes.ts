import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as userService from './user.service.js'

const preferencesUpdateBody = z.object({
  defaultPlatform: z.string().optional(),
  defaultDuration: z.number().int().min(1).max(480).optional(),
  diversityBias: z.number().min(0).max(1).optional(),
  whatsappPhone: z.string().optional(),
})

export async function registerUserRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.get('/user/preferences', auth, async (request, reply) => {
    const prefs = await userService.getPreferences(request.user.userId)
    return reply.send(prefs)
  })

  fastify.patch('/user/preferences', auth, async (request, reply) => {
    const body = preferencesUpdateBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid request' })

    const prefs = await userService.updatePreferences(request.user.userId, body.data)
    return reply.send(prefs)
  })

  fastify.get('/user/capabilities', auth, async (request, reply) => {
    const caps = await userService.getCapabilities(request.user.userId)
    return reply.send(caps)
  })
}
