import "server-only";

import {
  type BillingCycle,
  type PricingRegion,
  normalizePricingRegion,
} from "@/lib/pricing-config";

const STRIPE_PRO_PRICE_IDS: Record<PricingRegion, Record<BillingCycle, string>> = {
  IN: {
    monthly: process.env.STRIPE_PRICE_PRO_IN_MONTHLY ?? "",
    yearly: process.env.STRIPE_PRICE_PRO_IN_YEARLY ?? "",
  },
  GLOBAL: {
    monthly: process.env.STRIPE_PRICE_PRO_GLOBAL_MONTHLY ?? "",
    yearly: process.env.STRIPE_PRICE_PRO_GLOBAL_YEARLY ?? "",
  },
};

export function getValidatedProStripePriceId(
  region: PricingRegion,
  billingCycle: BillingCycle,
) {
  const safeRegion = normalizePricingRegion(region);
  const priceId = STRIPE_PRO_PRICE_IDS[safeRegion][billingCycle];

  if (!priceId) {
    throw new Error(
      `Missing Stripe price configuration for region=${safeRegion}, cycle=${billingCycle}`,
    );
  }

  return priceId;
}
