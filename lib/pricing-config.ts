export const PRICING_REGION = {
  IN: "IN",
  GLOBAL: "GLOBAL",
} as const;

export type PricingRegion = (typeof PRICING_REGION)[keyof typeof PRICING_REGION];

export const BILLING_CYCLE = {
  monthly: "monthly",
  yearly: "yearly",
} as const;

export type BillingCycle = keyof typeof BILLING_CYCLE;

export const DEFAULT_PRICING_REGION: PricingRegion = PRICING_REGION.GLOBAL;

export const PRICING_REGION_HEADER_KEYS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-country-code",
  "x-appengine-country",
  "cloudfront-viewer-country",
  "x-geo-country",
] as const;

export const FREE_PLAN_FEATURES = [
  "25 email generations per month",
  "15 AI draft generations per month",
  "Basic outreach tracking",
  "Limited contact storage",
  "Manual sync",
  "No credit card required",
] as const;

export const PRO_PLAN_FEATURES = [
  "Unlimited outreach (Fair use policy applies)",
  "Up to 1,500 email generations per month",
  "Unlimited AI draft generations",
  "Full outreach tracking dashboard",
  "Advanced contact management",
  "Unlimited contact storage",
  "Priority sync",
  "Data export",
  "Early access to new features",
] as const;

const FREE_PRICING_BY_REGION = {
  IN: {
    amountLabel: "₹0",
    periodLabel: "",
  },
  GLOBAL: {
    amountLabel: "$0",
    periodLabel: "",
  },
} as const;

const PRO_PRICING_BY_REGION = {
  IN: {
    monthly: {
      amountLabel: "₹349",
      periodLabel: "/month",
      savingsLabel: "",
    },
    yearly: {
      amountLabel: "₹2,999",
      periodLabel: "/year",
      savingsLabel: "Save 28%",
    },
  },
  GLOBAL: {
    monthly: {
      amountLabel: "$12",
      periodLabel: "/month",
      savingsLabel: "",
    },
    yearly: {
      amountLabel: "$99",
      periodLabel: "/year",
      savingsLabel: "Save 31%",
    },
  },
} as const;

/**
 * Normalize pricing region.
 * @param {unknown} region - Region input.
 * @returns {PricingRegion} Computed PricingRegion.
 * @example
 * normalizePricingRegion({})
 */
export function normalizePricingRegion(region: unknown): PricingRegion {
  if (region === PRICING_REGION.IN) {
    return PRICING_REGION.IN;
  }

  return DEFAULT_PRICING_REGION;
}

/**
 * Resolve pricing region from country.
 * @param {string | null} countryCode - Country code input.
 * @returns {PricingRegion} Computed PricingRegion.
 * @example
 * resolvePricingRegionFromCountry('countryCode')
 */
export function resolvePricingRegionFromCountry(
  countryCode?: string | null,
): PricingRegion {
  const normalizedCountryCode = countryCode?.trim().toUpperCase();
  if (normalizedCountryCode === "IN") {
    return PRICING_REGION.IN;
  }

  return DEFAULT_PRICING_REGION;
}

/**
 * Get free display price.
 * @param {PricingRegion} region - Region input.
 * @returns {unknown} Computed unknown.
 * @example
 * getFreeDisplayPrice({})
 */
export function getFreeDisplayPrice(region: PricingRegion) {
  return FREE_PRICING_BY_REGION[region];
}

/**
 * Get pro display price.
 * @param {PricingRegion} region - Region input.
 * @param {BillingCycle} billingCycle - Billing cycle input.
 * @returns {unknown} Computed unknown.
 * @example
 * getProDisplayPrice({}, {})
 */
export function getProDisplayPrice(
  region: PricingRegion,
  billingCycle: BillingCycle,
) {
  return PRO_PRICING_BY_REGION[region][billingCycle];
}

/**
 * Get yearly savings label.
 * @param {PricingRegion} region - Region input.
 * @returns {unknown} Computed unknown.
 * @example
 * getYearlySavingsLabel({})
 */
export function getYearlySavingsLabel(region: PricingRegion) {
  return PRO_PRICING_BY_REGION[region].yearly.savingsLabel;
}

/**
 * Get pricing region display label.
 * @param {PricingRegion} region - Region input.
 * @returns {unknown} Computed unknown.
 * @example
 * getPricingRegionDisplayLabel({})
 */
export function getPricingRegionDisplayLabel(region: PricingRegion) {
  if (region === PRICING_REGION.IN) {
    return "India";
  }

  return "Rest of World";
}
