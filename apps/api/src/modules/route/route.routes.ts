import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { generateLoopRoute, generateDirectedRoute } from './route.service.js'

const latLng = z.object({ lat: z.number(), lng: z.number() })

const bodySchema = z.discriminatedUnion('mode', [
  z.object({
    mode:                 z.literal('loop'),
    start:                latLng,
    activity:             z.enum(['drive', 'cycle', 'walk', 'jog']),
    targetDurationMinutes:z.number().int().min(10).max(480),
    toleranceMinutes:     z.number().int().min(0).max(30).optional(),
  }),
  z.object({
    mode:       z.literal('directed'),
    start:      latLng,
    destination:latLng,
    activity:   z.enum(['drive', 'cycle', 'walk', 'jog']),
  }),
])

export async function registerRouteRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.post('/routes/generate', auth, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() })
    }

    const body = parsed.data

    const result = body.mode === 'loop'
      ? await generateLoopRoute(body.start, body.activity, body.targetDurationMinutes, body.toleranceMinutes)
      : await generateDirectedRoute(body.start, body.destination, body.activity)

    return reply.status(200).send(result)
  })
}
