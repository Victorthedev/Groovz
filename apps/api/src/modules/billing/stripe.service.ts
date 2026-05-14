import Stripe from 'stripe'
import { prisma } from '../../shared/utils/prisma.js'
import { priceForRegion } from './pricing.js'
import { upgradeToPaid, downgradeToFree } from './billing.service.js'

// stripe v22 requires the current API version literal
const API_VERSION = '2026-04-22.dahlia' as const

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key, { apiVersion: API_VERSION })
}

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured')
  return secret
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  userId: string,
  region: string,
  userEmail: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const stripe = getStripe()
  const price = priceForRegion(region)

  if (!price.stripePriceId) {
    throw Object.assign(
      new Error(`Stripe price not configured for region ${region} — add STRIPE_PRICE_${region} to env`),
      { statusCode: 500 },
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: price.stripePriceId, quantity: 1 }],
    customer_email: userEmail,
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { userId, region },
  })

  return session.url!
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<void> {
  const stripe = getStripe()

  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret())
  } catch {
    throw Object.assign(new Error('Invalid Stripe webhook signature'), { statusCode: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutComplete(stripe, event.data.object)
      break
    case 'customer.subscription.updated':
      await onSubscriptionUpdated(event.data.object)
      break
    case 'customer.subscription.deleted':
      await onSubscriptionDeleted(event.data.object)
      break
    case 'invoice.payment_succeeded':
      await onPaymentSucceeded(event.data.object)
      break
    case 'invoice.payment_failed':
      await onPaymentFailed(event.data.object)
      break
    // All other event types silently ignored
  }
}

// ─── Local shape types (avoid Stripe.* namespace — v22 compat) ───────────────

interface CheckoutSessionShape {
  customer: string | null
  subscription: string | null
  metadata: { userId?: string; region?: string } | null
}

interface SubscriptionShape {
  customer: string | null
  status: string
  current_period_end: number
  currency: string
  items: { data: Array<{ price: { id: string } }> }
}

interface InvoiceShape {
  customer: string | null
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function onCheckoutComplete(
  stripe: ReturnType<typeof getStripe>,
  obj: unknown,
): Promise<void> {
  const session = obj as CheckoutSessionShape
  const userId = session.metadata?.userId
  if (!userId) return

  const subscriptionId = session.subscription!
  const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as SubscriptionShape
  const priceId = sub.items.data[0]?.price.id ?? ''
  const region = session.metadata?.region ?? 'US'

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: session.customer!,
      stripePriceId: priceId,
      status: 'active',
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      region,
      currency: sub.currency,
    },
    update: {
      stripeCustomerId: session.customer!,
      stripePriceId: priceId,
      status: 'active',
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
  })

  await upgradeToPaid(userId)
}

async function onSubscriptionUpdated(obj: unknown): Promise<void> {
  const sub = obj as SubscriptionShape
  const record = await prisma.subscription.findFirst({
    where: { stripeCustomerId: sub.customer! },
  })
  if (!record) return

  const status = stripeStatusToOurs(sub.status)

  await prisma.subscription.update({
    where: { userId: record.userId },
    data: { status, currentPeriodEnd: new Date(sub.current_period_end * 1000) },
  })

  if (status === 'active') await upgradeToPaid(record.userId)
  if (status === 'cancelled') await downgradeToFree(record.userId)
}

async function onSubscriptionDeleted(obj: unknown): Promise<void> {
  const sub = obj as SubscriptionShape
  const record = await prisma.subscription.findFirst({
    where: { stripeCustomerId: sub.customer! },
  })
  if (!record) return

  await prisma.subscription.update({ where: { userId: record.userId }, data: { status: 'cancelled' } })
  await downgradeToFree(record.userId)
}

async function onPaymentSucceeded(obj: unknown): Promise<void> {
  const inv = obj as InvoiceShape
  if (!inv.customer) return
  await prisma.subscription.updateMany({
    where: { stripeCustomerId: inv.customer },
    data: { status: 'active' },
  })
}

async function onPaymentFailed(obj: unknown): Promise<void> {
  const inv = obj as InvoiceShape
  if (!inv.customer) return
  await prisma.subscription.updateMany({
    where: { stripeCustomerId: inv.customer },
    data: { status: 'past_due' },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripeStatusToOurs(status: string): 'active' | 'cancelled' | 'past_due' {
  if (status === 'active' || status === 'trialing') return 'active'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  return 'cancelled'
}
