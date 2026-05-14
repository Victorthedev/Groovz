import { createHmac } from 'crypto'
import { prisma } from '../../shared/utils/prisma.js'
import { upgradeToPaid, downgradeToFree } from './billing.service.js'

// v2 — crypto subscriptions go live in v2 (§13). Infrastructure is wired now;
// on-chain contract + Gelato keeper integration is deferred.

const MONTHLY_USDC_AMOUNT = 4.99  // USD equivalent; actual on-chain amount per network

export function getCryptoSubscribeInfo() {
  return {
    contractAddress: process.env.CRYPTO_CONTRACT_ADDRESS ?? '',
    network: 'base',    // Base L2 — low fees, EVM-compatible (§9)
    monthlyAmountUsdc: MONTHLY_USDC_AMOUNT,
    // Frontend uses this to prompt wallet approval:
    // approve(contractAddress, monthlyAmountUsdc * 12) for a 1-year allowance
  }
}

export interface CryptoWebhookPayload {
  userId: string
  walletAddress: string
  contractAddress: string
  network: 'base' | 'polygon'
  event: 'charged' | 'expired'
  signature: string   // HMAC-SHA256 of payload, signed by our keeper
  chargedAt: string   // ISO string
}

export async function handleCryptoWebhook(payload: CryptoWebhookPayload): Promise<void> {
  // TODO (v2): verify on-chain event signature from Gelato keeper
  // For now: verify the HMAC our keeper attaches to every webhook call
  verifyKeeperSignature(payload)

  if (payload.event === 'charged') {
    const nextChargeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // +30 days

    await prisma.cryptoSubscription.upsert({
      where: { userId: payload.userId },
      create: {
        userId: payload.userId,
        walletAddress: payload.walletAddress,
        contractAddress: payload.contractAddress,
        network: payload.network,
        status: 'active',
        lastChargedAt: new Date(payload.chargedAt),
        nextChargeAt,
      },
      update: {
        status: 'active',
        lastChargedAt: new Date(payload.chargedAt),
        nextChargeAt,
      },
    })

    await upgradeToPaid(payload.userId)
  }

  if (payload.event === 'expired') {
    await prisma.cryptoSubscription.updateMany({
      where: { userId: payload.userId },
      data: { status: 'expired' },
    })

    await downgradeToFree(payload.userId)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verifyKeeperSignature(payload: CryptoWebhookPayload): void {
  const secret = process.env.CRYPTO_WEBHOOK_SECRET
  if (!secret) throw Object.assign(new Error('CRYPTO_WEBHOOK_SECRET not configured'), { statusCode: 500 })

  const { signature, ...rest } = payload
  const expected = createHmac('sha256', secret)
    .update(JSON.stringify(rest))
    .digest('hex')

  if (signature !== expected) {
    throw Object.assign(new Error('Invalid crypto webhook signature'), { statusCode: 400 })
  }
}
