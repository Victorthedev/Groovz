// Region-based pricing — values are locked. Change only with explicit instruction. (§9)
// Frontend displays these labels; backend enforces them via this table. Never trust frontend pricing.

export interface RegionPrice {
  currency: string
  unitAmount: number   // smallest currency unit (kobo, pence, cents, etc.)
  stripePriceId: string
  label: string        // display only
}

export const REGION_PRICES: Record<string, RegionPrice> = {
  NG: {
    currency: 'ngn',
    unitAmount: 250000,                               // ₦2,500 = 250,000 kobo
    stripePriceId: process.env.STRIPE_PRICE_NG ?? '',
    label: '₦2,500/month',
  },
  UK: {
    currency: 'gbp',
    unitAmount: 399,                                  // £3.99
    stripePriceId: process.env.STRIPE_PRICE_UK ?? '',
    label: '£3.99/month',
  },
  EU: {
    currency: 'eur',
    unitAmount: 449,                                  // €4.49
    stripePriceId: process.env.STRIPE_PRICE_EU ?? '',
    label: '€4.49/month',
  },
  US: {
    currency: 'usd',
    unitAmount: 499,                                  // $4.99
    stripePriceId: process.env.STRIPE_PRICE_US ?? '',
    label: '$4.99/month',
  },
  CA: {
    currency: 'cad',
    unitAmount: 649,                                  // CA$6.49
    stripePriceId: process.env.STRIPE_PRICE_CA ?? '',
    label: 'CA$6.49/month',
  },
}

export function priceForRegion(region: string): RegionPrice {
  const price = REGION_PRICES[region]
  if (!price) throw Object.assign(new Error(`No pricing configured for region: ${region}`), { statusCode: 400 })
  return price
}
