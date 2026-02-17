import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_PRICING_REGION,
  PRICING_REGION_HEADER_KEYS,
  resolvePricingRegionFromCountry,
} from "@/lib/pricing-config";

export const dynamic = "force-dynamic";

function getCountryFromHeaders(request: NextRequest) {
  for (const headerKey of PRICING_REGION_HEADER_KEYS) {
    const country = request.headers.get(headerKey);
    if (country) {
      return country;
    }
  }

  return null;
}

/**
 * Handle GET requests for `/api/pricing-region`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/pricing-region request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/pricing-region
 * fetch('/api/pricing-region')
 */
export async function GET(request: NextRequest) {
  try {
    const headerCountry = getCountryFromHeaders(request);
    const geoCountry = request.geo?.country ?? null;
    const country = headerCountry ?? geoCountry;
    const region = resolvePricingRegionFromCountry(country);

    return NextResponse.json(
      { region },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error("Pricing region detection failed:", error);
    return NextResponse.json(
      { region: DEFAULT_PRICING_REGION },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
}
