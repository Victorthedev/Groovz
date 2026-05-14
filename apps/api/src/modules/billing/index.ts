import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { registerBillingRoutes, registerWebhookRoutes } from './billing.routes.js'

async function billingPlugin(fastify: FastifyInstance) {
  // Authenticated routes — use the inherited authenticate decorator
  await registerBillingRoutes(fastify)

  // Webhook routes — scoped sub-plugin with raw body parser (no auth header from Stripe/keeper)
  fastify.register(registerWebhookRoutes)
}

export default fp(billingPlugin, { name: 'billing', dependencies: ['auth'] })
