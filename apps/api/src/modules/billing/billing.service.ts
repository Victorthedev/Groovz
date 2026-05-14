import { prisma } from '../../shared/utils/prisma.js'
import { REGION_PRICES } from './pricing.js'

// Paid tier limits (§9)
const PAID_CAPABILITIES = {
  plan: 'paid' as const,
  maxPlaylistDurationMinutes: 240,   // 4 hours
  maxPlaylistsPerMonth: 9999,        // effectively unlimited
  canUseRouteFeature: true,          // v3 — capability set now, feature gates on v3 release
  canUseWhatsapp: true,              // v2 — capability set now, feature gates on v2 release
}

// Free tier limits (§9)
const FREE_CAPABILITIES = {
  plan: 'free' as const,
  maxPlaylistDurationMinutes: 120,
  maxPlaylistsPerMonth: 10,
  canUseRouteFeature: false,
  canUseWhatsapp: false,
}

export async function upgradeToPaid(userId: string): Promise<void> {
  await prisma.userCapabilities.update({
    where: { userId },
    data: PAID_CAPABILITIES,
  })
}

export async function downgradeToFree(userId: string): Promise<void> {
  await prisma.userCapabilities.update({
    where: { userId },
    data: FREE_CAPABILITIES,
  })
}

export async function getBillingStatus(userId: string) {
  const [user, subscription, cryptoSubscription, capabilities] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { region: true } }).catch(() => null),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.cryptoSubscription.findUnique({ where: { userId } }),
    prisma.userCapabilities.findUnique({ where: { userId } }),
  ])

  // Resolve the display price for this user's region — frontend renders this,
  // never derives or enforces pricing itself (§9, §15)
  const regionPrice = user?.region ? REGION_PRICES[user.region] : undefined
  const pricing = regionPrice
    ? { label: regionPrice.label, currency: regionPrice.currency }
    : null

  return {
    plan: capabilities?.plan ?? 'free',
    pricing,
    stripe: subscription
      ? { status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd }
      : null,
    crypto: cryptoSubscription
      ? { status: cryptoSubscription.status, nextChargeAt: cryptoSubscription.nextChargeAt }
      : null,
  }
}
