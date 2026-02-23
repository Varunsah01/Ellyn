import 'server-only'

import { type BillingCycle, type PricingRegion, getDodoProductId } from '@/lib/pricing-config'

/**
 * Get validated Dodo product id.
 * Note: billing cycle is used by the checkout API payload, not product ID resolution.
 */
export function getValidatedProProductId(
  region: PricingRegion,
  billingCycle: BillingCycle
): string {
  return getDodoProductId(region, billingCycle)
}
