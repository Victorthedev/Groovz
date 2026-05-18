import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Region } from '@prisma/client'
import * as authService from './auth.service.js'
import { signAccessToken, signRefreshToken, REFRESH_COOKIE, REFRESH_COOKIE_OPTS } from './tokens.js'

const signupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  region: z.nativeEnum(Region),
})

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
})


export async function registerAuthRoutes(fastify: FastifyInstance) {
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: 60_000 } } }

  fastify.post('/auth/signup', authLimit, async (request, reply) => {
    const body = signupBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid request' })

    const user = await authService.signup(body.data)
    reply.setCookie(REFRESH_COOKIE, signRefreshToken(user.id, user.email, fastify), REFRESH_COOKIE_OPTS)
    return reply.status(201).send({ accessToken: signAccessToken(user.id, user.email, fastify) })
  })

  fastify.post('/auth/login', authLimit, async (request, reply) => {
    const body = loginBody.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid request' })

    const user = await authService.login(body.data.email, body.data.password)
    reply.setCookie(REFRESH_COOKIE, signRefreshToken(user.id, user.email, fastify), REFRESH_COOKIE_OPTS)
    return reply.send({ accessToken: signAccessToken(user.id, user.email, fastify) })
  })

  fastify.post('/auth/refresh', async (request, reply) => {
    const raw = request.cookies?.[REFRESH_COOKIE]
    if (!raw) return reply.status(401).send({ error: 'No refresh token' })

    let payload: { userId: string; email: string; type: string }
    try {
      payload = fastify.jwt.verify(raw)
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }

    if (payload.type !== 'refresh') {
      return reply.status(401).send({ error: 'Invalid token type' })
    }

    // Rotate the refresh token on every use
    reply.setCookie(REFRESH_COOKIE, signRefreshToken(payload.userId, payload.email, fastify), REFRESH_COOKIE_OPTS)
    return reply.send({ accessToken: signAccessToken(payload.userId, payload.email, fastify) })
  })

  fastify.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie(REFRESH_COOKIE, { path: '/' })
    return reply.status(204).send()
  })

  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await authService.getMe(request.user.userId)
      return reply.send(user)
    },
  )

  fastify.delete(
    '/auth/account',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await authService.deleteAccount(request.user.userId)
      reply.clearCookie(REFRESH_COOKIE, { path: '/' })
      return reply.status(204).send()
    },
  )
}
