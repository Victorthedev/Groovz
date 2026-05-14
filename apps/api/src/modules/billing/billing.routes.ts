import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createCheckoutSession, handleStripeWebhook } from './stripe.service.js'
import { getCryptoSubscribeInfo, handleCryptoWebhook } from './crypto.service.js'
import { getBillingStatus } from './billing.service.js'
import { prisma } from '../../shared/utils/prisma.js'

const WEB_BASE = () => process.env.WEB_BASE_URL ?? 'http://localhost:3000'

export async function registerBillingRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] }

  // ── Stripe checkout ─────────────────────────────────────────────────────────

  fastify.post('/billing/stripe/checkout', auth, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { email: true, region: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const url = await createCheckoutSession(
      request.user.userId,
      user.region,
      user.email,
      `${WEB_BASE()}/billing/success`,
      `${WEB_BASE()}/billing/cancel`,
    )

    return reply.send({ url })
  })

  // ── Billing status ───────────────────────────────────────────────────────────

  fastify.get('/billing/status', auth, async (request, reply) => {
    const status = await getBillingStatus(request.user.userId)
    return reply.send(status)
  })

  // ── Crypto subscribe ─────────────────────────────────────────────────────────

  fastify.post('/billing/crypto/subscribe', auth, async (_request, reply) => {
    return reply.send(getCryptoSubscribeInfo())
  })
}

// ─── Webhook routes — separate scope with raw body parser ─────────────────────
// Stripe requires the exact raw body bytes for signature verification.
// This scoped sub-plugin overrides the JSON content type parser to return
// the raw Buffer instead of parsed JSON, only for webhook routes.

export async function registerWebhookRoutes(fastify: FastifyInstance) {
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  )

  fastify.post('/billing/stripe/webhook', async (request, reply) => {
    const signature = request.headers['stripe-signature']
    if (!signature || typeof signature !== 'string') {
      return reply.status(400).send({ error: 'Missing stripe-signature header' })
    }

    await handleStripeWebhook(request.body as Buffer, signature)
    return reply.status(200).send({ received: true })
  })

  fastify.post('/billing/crypto/webhook', async (request, reply) => {
    const raw = request.body as Buffer
    let payload: unknown
    try {
      payload = JSON.parse(raw.toString())
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON' })
    }

    const schema = z.object({
      userId: z.string(),
      walletAddress: z.string(),
      contractAddress: z.string(),
      network: z.enum(['base', 'polygon']),
      event: z.enum(['charged', 'expired']),
      signature: z.string(),
      chargedAt: z.string(),
    })

    const parsed = schema.safeParse(payload)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid payload' })

    await handleCryptoWebhook(parsed.data)
    return reply.status(200).send({ received: true })
  })
}
