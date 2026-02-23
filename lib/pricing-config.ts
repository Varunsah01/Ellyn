export const PRICING_REGION = {
  IN: "IN",
  GLOBAL: "GLOBAL",
} as const;

export type PricingRegion = (typeof PRICING_REGION)[keyof typeof PRICING_REGION];

export const BILLING_CYCLE = {
  monthly: "monthly",
  quarterly: "quarterly",
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

const FREE_PRICING_GLOBAL = {
  amountLabel: "$0",
  periodLabel: "",
} as const;

const PRO_PRICING_GLOBAL = {
  monthly: {
    amountLabel: "$12",
    periodLabel: "/month",
    savingsLabel: "",
  },
  quarterly: {
    amountLabel: "$24.99",
    periodLabel: "/quarter",
    savingsLabel: "Save 31%",
  },
  yearly: {
    amountLabel: "$99",
    periodLabel: "/year",
    savingsLabel: "Save 31%",
  },
} as const;

/**
 * Normalize pricing region.
 * India pricing is currently disabled and all users are mapped to GLOBAL.
 */
export function normalizePricingRegion(region: unknown): PricingRegion {
  void region;
  return DEFAULT_PRICING_REGION;
}

/**
 * Resolve pricing region from country.
 * India pricing is currently disabled and all users are mapped to GLOBAL.
 */
export function resolvePricingRegionFromCountry(
  countryCode?: string | null,
): PricingRegion {
  void countryCode;
  return DEFAULT_PRICING_REGION;
}

/**
 * Get free display price.
 */
export function getFreeDisplayPrice(region: PricingRegion) {
  void region;
  return FREE_PRICING_GLOBAL;
}

/**
 * Get pro display price.
 */
export function getProDisplayPrice(
  region: PricingRegion,
  billingCycle: BillingCycle,
) {
  void region;
  return PRO_PRICING_GLOBAL[billingCycle];
}

/**
 * Get quarterly savings label.
 */
export function getQuarterlySavingsLabel(region: PricingRegion) {
  void region;
  return PRO_PRICING_GLOBAL.quarterly.savingsLabel;
}

/**
 * Get yearly savings label.
 */
export function getYearlySavingsLabel(region: PricingRegion) {
  void region;
  return PRO_PRICING_GLOBAL.yearly.savingsLabel;
}

/**
 * Get pricing region display label.
 */
export function getPricingRegionDisplayLabel(region: PricingRegion) {
  void region;
  return "Global";
}

/**
 * Get Dodo Payments product ID for the given billing cycle.
 * Priority is cycle-specific global IDs, then legacy global ID fallback.
 */
export function getDodoProductId(
  region: PricingRegion,
  billingCycle: BillingCycle = "monthly",
): string {
  void region;

  const envCandidatesByCycle: Record<BillingCycle, readonly string[]> = {
    monthly: [
      "DODO_PRO_PRODUCT_ID_GLOBAL_MONTHLY",
      "DODO_PRO_PRODUCT_ID_MONTHLY",
      "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID_MONTHLY",
      "DODO_PRO_PRODUCT_ID_GLOBAL",
      "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID",
      "DODO_PRO_PRODUCT_ID_IN",
    ],
    quarterly: [
      "DODO_PRO_PRODUCT_ID_GLOBAL_QUARTERLY",
      "DODO_PRO_PRODUCT_ID_QUARTERLY",
      "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID_QUARTERLY",
      "DODO_PRO_PRODUCT_ID_GLOBAL",
      "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID",
      "DODO_PRO_PRODUCT_ID_IN",
    ],
    yearly: [
      "DODO_PRO_PRODUCT_ID_GLOBAL_YEARLY",
      "DODO_PRO_PRODUCT_ID_YEARLY",
      "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID_YEARLY",
      "DODO_PRO_PRODUCT_ID_GLOBAL",
      "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID",
      "DODO_PRO_PRODUCT_ID_IN",
    ],
  };

  for (const envKey of envCandidatesByCycle[billingCycle]) {
    const value = process.env[envKey];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  throw new Error(
    `Missing Dodo product ID env vars for "${billingCycle}". Expected one of: ${envCandidatesByCycle[billingCycle].join(", ")}`,
  );
}
