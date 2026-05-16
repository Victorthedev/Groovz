import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as service from './blend.service.js'
import { prisma } from '../../shared/utils/prisma.js'

const tasteProfileBody = z.object({
  energyCentroid: z.number().min(0).max(1),
  tempoCentroid: z.number().min(0).max(1),
  genreAffinities: z.record(z.string(), z.number()),
  tags: z.array(z.string()),
})

export async function registerBlendRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] }

  // Create a blend session (host)
  fastify.post('/blend', auth, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { email: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const session = await service.createBlendSession(request.user.userId, user.email)
    return reply.status(201).send(session)
  })

  // Get session state (public — participants use this to poll)
  fastify.get('/blend/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const session = await service.getBlendSession(sessionId)
    if (!session) return reply.status(404).send({ error: 'Session not found or expired' })

    // Strip internal userId from participants for privacy
    const sanitised = {
      ...session,
      participants: session.participants.map(p => ({
        id: p.id,
        displayName: p.displayName,
        isAnonymous: p.isAnonymous,
        hasProfile: p.hasProfile,
      })),
    }
    return reply.send(sanitised)
  })

  // Join as authenticated user
  fastify.post('/blend/:sessionId/join', auth, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { email: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const result = await service.joinSession(sessionId, request.user.userId, user.email)
    return reply.send(result)
  })

  // Join anonymously
  fastify.post('/blend/:sessionId/join-anon', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const result = await service.joinSessionAnonymous(sessionId)
    return reply.send(result)
  })

  // Submit taste profile (cold start or anonymous)
  fastify.post('/blend/:sessionId/taste', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const body = z.object({
      participantId: z.string().uuid(),
      isAnonymous: z.boolean(),
      profile: tasteProfileBody,
    }).safeParse(request.body)

    if (!body.success) return reply.status(400).send({ error: 'Invalid profile data' })

    await service.submitTasteProfile(
      sessionId,
      body.data.participantId,
      body.data.profile,
      body.data.isAnonymous,
    )

    return reply.status(204).send()
  })

  // Host triggers generation
  fastify.post('/blend/:sessionId/generate', auth, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    await service.generateBlend(sessionId, request.user.userId)
    return reply.status(202).send({ message: 'Generating' })
  })
}
