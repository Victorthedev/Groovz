import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as service from './recommendation.service.js'
import { prisma } from '../../shared/utils/prisma.js'

const generateBody = z.object({
  type: z.enum(['seed', 'prompt', 'hybrid']),
  platform: z.enum(['spotify', 'deezer', 'audiomack', 'youtube_music']),
  seedDisplayId: z.string().optional(),
  prompt: z.string().max(500).optional(),
  contextCardId: z.string().optional(),
  deepCuts: z.boolean().optional(),
  intent: z.object({
    energy: z.enum(['low', 'medium', 'high']).optional(),
    tempo: z.enum(['slow', 'medium', 'fast']).optional(),
    mood: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    durationMinutes: z.number().int().min(1).max(480).optional(),
  }).optional(),
}).superRefine((val, ctx) => {
  if (val.type === 'seed' && !val.seedDisplayId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'seedDisplayId required for seed mode', path: ['seedDisplayId'] })
  }
  if ((val.type === 'prompt' || val.type === 'hybrid') && !val.prompt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'prompt required for prompt/hybrid mode', path: ['prompt'] })
  }
})

export async function registerRecommendationRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.post('/playlists/generate', auth, async (request, reply) => {
    const body = generateBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid request', details: body.error.flatten() })

    const { durationMinutes } = body.data.intent ?? {}
    if (durationMinutes && durationMinutes > 120) {
      // §5.1 hard duration rule — ask rather than silently cap
      return reply.status(400).send({
        error: 'Duration too long',
        message: 'Maximum is 120 minutes for a single playlist. Would you like a 2-hour playlist instead?',
        suggestedDurationMinutes: 120,
      })
    }

    const result = await service.startGeneration({
      userId: request.user.userId,
      ...body.data,
    })

    return reply.status(202).send(result)
  })

  fastify.get('/playlists/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string }
    const blueprint = await service.getBlueprint(id)
    if (!blueprint) return reply.status(404).send({ error: 'Blueprint not found or expired' })

    // Merge narrative from DB — generated after blueprint is stored in Redis
    const record = await prisma.playlistRecord.findUnique({
      where: { id },
      select: { narrative: true },
    })
    return reply.send({ ...blueprint, narrative: record?.narrative ?? null })
  })

  fastify.get('/playlists/history', auth, async (request, reply) => {
    const history = await service.getHistory(request.user.userId)
    return reply.send({ playlists: history })
  })
}
