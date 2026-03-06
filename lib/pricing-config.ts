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
  "50 email credits per month",
  "Basic outreach tracking",
  "Limited contact storage",
  "Manual sync",
  "No credit card required",
] as const;

export const STARTER_PLAN_FEATURES = [
  "500 email credits per month",
  "AI Starter Access",
  "Full outreach tracking dashboard",
  "Advanced contact management",
  "Priority sync",
  "Data export",
] as const;

export const PRO_PLAN_FEATURES = [
  "1,500 email credits per month",
  "AI Drafting",
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

const STARTER_PRICING_GLOBAL = {
  monthly: {
    amountLabel: "$14.99",
    periodLabel: "/month",
    savingsLabel: "",
  },
  quarterly: {
    amountLabel: "$39.99",
    periodLabel: "/quarter",
    savingsLabel: "Save 11%",
  },
  yearly: {
    amountLabel: "$149",
    periodLabel: "/year",
    savingsLabel: "Save 17%",
  },
} as const;

const PRO_PRICING_GLOBAL = {
  monthly: {
    amountLabel: "$34.99",
    periodLabel: "/month",
    savingsLabel: "",
  },
  quarterly: {
    amountLabel: "$89.99",
    periodLabel: "/quarter",
    savingsLabel: "Save 14%",
  },
  yearly: {
    amountLabel: "$279",
    periodLabel: "/year",
    savingsLabel: "Save 33%",
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
 * Get starter display price.
 */
export function getStarterDisplayPrice(
  region: PricingRegion,
  billingCycle: BillingCycle,
) {
  void region;
  return STARTER_PRICING_GLOBAL[billingCycle];
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
 * Get starter quarterly savings label.
 */
export function getStarterQuarterlySavingsLabel(region: PricingRegion) {
  void region;
  return STARTER_PRICING_GLOBAL.quarterly.savingsLabel;
}

/**
 * Get starter yearly savings label.
 */
export function getStarterYearlySavingsLabel(region: PricingRegion) {
  void region;
  return STARTER_PRICING_GLOBAL.yearly.savingsLabel;
}

/**
 * Get quarterly savings label (Pro).
 */
export function getQuarterlySavingsLabel(region: PricingRegion) {
  void region;
  return PRO_PRICING_GLOBAL.quarterly.savingsLabel;
}

/**
 * Get yearly savings label (Pro).
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
 * Get Dodo Payments product ID for the given plan type and billing cycle.
 */
export function getDodoProductId(
  region: PricingRegion,
  billingCycle: BillingCycle = "monthly",
  planType: "starter" | "pro" = "pro",
): string {
  void region;

  if (planType === "starter") {
    const starterCandidates: Record<BillingCycle, readonly string[]> = {
      monthly: [
        "DODO_STARTER_PRODUCT_ID_GLOBAL_MONTHLY",
        "DODO_STARTER_PRODUCT_ID_MONTHLY",
      ],
      quarterly: [
        "DODO_STARTER_PRODUCT_ID_GLOBAL_QUARTERLY",
        "DODO_STARTER_PRODUCT_ID_QUARTERLY",
      ],
      yearly: [
        "DODO_STARTER_PRODUCT_ID_GLOBAL_YEARLY",
        "DODO_STARTER_PRODUCT_ID_YEARLY",
      ],
    };

    for (const envKey of starterCandidates[billingCycle]) {
      const value = process.env[envKey];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }

    throw new Error(
      `Missing Dodo product ID env vars for starter "${billingCycle}". Expected one of: ${starterCandidates[billingCycle].join(", ")}`,
    );
  }

  // Pro plan
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
    `Missing Dodo product ID env vars for pro "${billingCycle}". Expected one of: ${envCandidatesByCycle[billingCycle].join(", ")}`,
  );
}

function getKnownProductIdsForPlan(
  planType: "starter" | "pro"
): string[] {
  const envKeys =
    planType === "starter"
      ? [
          "DODO_STARTER_PRODUCT_ID_GLOBAL_MONTHLY",
          "DODO_STARTER_PRODUCT_ID_MONTHLY",
          "DODO_STARTER_PRODUCT_ID_GLOBAL_QUARTERLY",
          "DODO_STARTER_PRODUCT_ID_QUARTERLY",
          "DODO_STARTER_PRODUCT_ID_GLOBAL_YEARLY",
          "DODO_STARTER_PRODUCT_ID_YEARLY",
        ]
      : [
          "DODO_PRO_PRODUCT_ID_GLOBAL_MONTHLY",
          "DODO_PRO_PRODUCT_ID_MONTHLY",
          "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID_MONTHLY",
          "DODO_PRO_PRODUCT_ID_GLOBAL_QUARTERLY",
          "DODO_PRO_PRODUCT_ID_QUARTERLY",
          "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID_QUARTERLY",
          "DODO_PRO_PRODUCT_ID_GLOBAL_YEARLY",
          "DODO_PRO_PRODUCT_ID_YEARLY",
          "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID_YEARLY",
          "DODO_PRO_PRODUCT_ID_GLOBAL",
          "NEXT_PUBLIC_DODO_PRO_PRODUCT_ID",
          "DODO_PRO_PRODUCT_ID_IN",
        ];

  return envKeys
    .map((envKey) => process.env[envKey])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
}

/**
 * Resolve plan type from a Dodo product ID.
 * Unknown or missing IDs return null so callers can fail closed.
 */
export function resolvePlanTypeFromProductId(
  productId: string | null
): "starter" | "pro" | null {
  const normalized = typeof productId === "string" ? productId.trim() : "";
  if (!normalized) return null;

  if (getKnownProductIdsForPlan("starter").includes(normalized)) {
    return "starter";
  }

  if (getKnownProductIdsForPlan("pro").includes(normalized)) {
    return "pro";
  }

  return null;
}
