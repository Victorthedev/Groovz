import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Region } from '@prisma/client'
import * as authService from './auth.service.js'
import { signTokens } from './tokens.js'

const signupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  region: z.nativeEnum(Region),
})

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
})

const refreshBody = z.object({
  refreshToken: z.string(),
})

export async function registerAuthRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/signup', async (request, reply) => {
    const body = signupBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid request' })

    const user = await authService.signup(body.data)
    const tokens = signTokens(user.id, user.email, fastify)
    return reply.status(201).send(tokens)
  })

  fastify.post('/auth/login', async (request, reply) => {
    const body = loginBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid request' })

    const user = await authService.login(body.data.email, body.data.password)
    const tokens = signTokens(user.id, user.email, fastify)
    return reply.send(tokens)
  })

  fastify.post('/auth/refresh', async (request, reply) => {
    const body = refreshBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid request' })

    let payload: { userId: string; email: string; type: string }
    try {
      payload = fastify.jwt.verify(body.data.refreshToken)
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }

    if (payload.type !== 'refresh') {
      return reply.status(401).send({ error: 'Invalid token type' })
    }

    const tokens = signTokens(payload.userId, payload.email, fastify)
    return reply.send(tokens)
  })

  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await authService.getMe(request.user.userId)
      return reply.send(user)
    },
  )
}
