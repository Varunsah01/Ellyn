import { NextRequest, NextResponse } from 'next/server'

import { get as getCache, getCacheMetrics, set as setCache } from '@/lib/cache/redis'
import { createClient as createServerClient } from '@/lib/supabase/server'

type Deliverability = 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN'

type VerifyResponse = {
  email: string
  deliverability: Deliverability
  qualityScore: number
  reason: string
}

const CACHE_TTL_SECONDS = 24 * 60 * 60
const ABSTRACT_TIMEOUT_MS = 10000

function toNormalizedEmail(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const raw = (body as { email?: unknown }).email
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeDeliverability(input: unknown): Deliverability {
  const value = String(input || '')
    .trim()
    .toUpperCase()

  if (value === 'DELIVERABLE') return 'DELIVERABLE'
  if (value === 'UNDELIVERABLE') return 'UNDELIVERABLE'
  if (value === 'RISKY') return 'RISKY'
  return 'UNKNOWN'
}

function normalizeQualityScore(input: unknown): number {
  const value = Number(input)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function unknownResult(email: string, reason: string): VerifyResponse {
  return {
    email,
    deliverability: 'UNKNOWN',
    qualityScore: 0,
    reason,
  }
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}

export async function POST(request: NextRequest) {
  let email = ''

  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown = null
    try {
      body = await request.json()
    } catch {
      body = null
    }

    email = toNormalizedEmail(body)
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const cacheKey = `abstract:verify:${email}`
    const redisAvailable = getCacheMetrics().redisConfigured === true
    if (redisAvailable) {
      try {
        const cached = await getCache<VerifyResponse>(cacheKey)
        if (cached && typeof cached === 'object' && String((cached as VerifyResponse).email || '')) {
          return NextResponse.json(cached, { status: 200 })
        }
      } catch {
        // Cache read failures should not block verification.
      }
    }

    const abstractApiKey = process.env.ABSTRACT_API_KEY?.trim() || ''
    if (!abstractApiKey) {
      return NextResponse.json(unknownResult(email, 'not_configured'), { status: 200 })
    }

    const endpoint =
      `https://emailvalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(abstractApiKey)}` +
      `&email=${encodeURIComponent(email)}`

    let abstractResponse: Response
    try {
      abstractResponse = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(ABSTRACT_TIMEOUT_MS),
        cache: 'no-store',
      })
    } catch {
      return NextResponse.json(unknownResult(email, 'api_error'), { status: 200 })
    }

    if (!abstractResponse.ok) {
      return NextResponse.json(unknownResult(email, 'api_error'), { status: 200 })
    }

    let payload: unknown = null
    try {
      payload = await abstractResponse.json()
    } catch {
      return NextResponse.json(unknownResult(email, 'api_error'), { status: 200 })
    }

    const payloadObject = toObject(payload)
    const validFormat = toObject(payloadObject.is_valid_format).value
    const disposable = toObject(payloadObject.is_disposable_email).value

    if (validFormat === false) {
      const result: VerifyResponse = {
        email,
        deliverability: 'UNDELIVERABLE',
        qualityScore: 0,
        reason: 'invalid_format',
      }
      if (redisAvailable) {
        try {
          await setCache(cacheKey, result, CACHE_TTL_SECONDS)
        } catch {
          // Cache write failures should not fail the request.
        }
      }
      return NextResponse.json(result, { status: 200 })
    }

    let deliverability = normalizeDeliverability(payloadObject.deliverability)
    let reason = typeof payloadObject.reason === 'string' ? payloadObject.reason.trim() : ''
    if (disposable === true) {
      deliverability = 'UNDELIVERABLE'
      reason = reason || 'disposable_email'
    }

    const result: VerifyResponse = {
      email,
      deliverability,
      qualityScore: normalizeQualityScore(payloadObject.quality_score),
      reason,
    }

    if (redisAvailable) {
      try {
        await setCache(cacheKey, result, CACHE_TTL_SECONDS)
      } catch {
        // Cache write failures should not fail the request.
      }
    }

    return NextResponse.json(result, { status: 200 })
  } catch {
    return NextResponse.json(unknownResult(email, 'api_error'), { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405 }
  )
}
