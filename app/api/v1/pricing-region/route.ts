import { NextRequest, NextResponse } from 'next/server'

import {
  PRICING_REGION_HEADER_KEYS,
  resolvePricingRegionFromCountry,
} from '@/lib/pricing-config'

export async function GET(request: NextRequest) {
  let countryCode: string | null = null

  for (const key of PRICING_REGION_HEADER_KEYS) {
    const val = request.headers.get(key)
    if (val) {
      countryCode = val
      break
    }
  }

  const region = resolvePricingRegionFromCountry(countryCode)
  return NextResponse.json({ region })
}
