/**
 * @jest-environment node
 *
 * Tests for the email verification flow:
 *   - Pure scoring functions (calculateDeliverabilityConfidence, calculateEnhancedConfidence, validateEmailFormat)
 *   - POST /api/generate-emails route (auth, quota, Abstract API, result shape)
 */

// ── Real implementations pulled before module is mocked ──────────────────────
// jest.requireActual bypasses the mock registry for the named module only.
// Transitive deps (cache/redis) still use their mocks, which is fine because
// the pure functions we test are synchronous and never touch the cache.
const realEmailVerification = jest.requireActual<
  typeof import('@/lib/email-verification')
>('@/lib/email-verification')

// ── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('@vercel/kv', () => ({
  kv: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
  createClient: jest.fn(() => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() })),
}))

jest.mock('@/lib/cache/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  buildCacheKey: jest.fn((...args: unknown[]) => (args.flat() as string[]).join(':')),
  normalizeCacheToken: jest.fn((s: unknown) => String(s).toLowerCase()),
  getOrSet: jest.fn(async ({ fetcher }: { fetcher: () => Promise<unknown> }) => fetcher()),
  clearByTag: jest.fn().mockResolvedValue(0),
}))

jest.mock('@/lib/cache/tags', () => ({
  CACHE_TAGS: { mxVerification: 'mx-verification', emailVerification: 'email-address-verification' },
  mxVerificationDomainTag: jest.fn((d: string) => `mx-verification:domain:${d}`),
  emailPatternDomainTag: jest.fn((d: string) => `email-patterns:domain:${d}`),
  companyDomainLookupTag: jest.fn((c: string) => `domain-lookup:company:${c}`),
  invalidateCompanyDomainLookupCache: jest.fn().mockResolvedValue(0),
  invalidateEmailPatternCache: jest.fn().mockResolvedValue(0),
  invalidateMxVerificationCache: jest.fn().mockResolvedValue(0),
}))

jest.mock('@sentry/nextjs', () => ({ setUser: jest.fn() }))

jest.mock('@/lib/auth/helpers', () => ({
  getAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/quota', () => {
  class QuotaExceededError extends Error {
    feature: string
    used: number
    limit: number
    plan_type: string

    constructor(feature: string, used: number, limit: number, plan_type: string) {
      super(`Quota exceeded for ${feature}: ${used}/${limit} (plan: ${plan_type})`)
      this.name = 'QuotaExceededError'
      this.feature = feature
      this.used = used
      this.limit = limit
      this.plan_type = plan_type
    }
  }

  return {
    QuotaExceededError,
    incrementEmailGeneration: jest.fn(),
  }
})

jest.mock('@/lib/verification-quota', () => ({
  getDailyVerificationQuota: jest.fn(),
  DAILY_VERIFICATION_LIMITS: { free: 10, pro: 100 },
}))

jest.mock('@/lib/enhanced-email-patterns', () => ({
  generateSmartEmailPatternsCached: jest.fn(),
  estimateCompanySize: jest.fn().mockReturnValue('medium'),
  getKnownDomain: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/email-patterns', () => ({
  guessDomain: jest.fn().mockResolvedValue(null),
}))

// Partially mock email-verification: keep all pure functions real, mock only
// the async verifyDomainMxRecords which makes DNS calls.
jest.mock('@/lib/email-verification', () => {
  const real = jest.requireActual<typeof import('@/lib/email-verification')>(
    '@/lib/email-verification'
  )
  return {
    ...real,
    verifyDomainMxRecords: jest.fn(),
  }
})

jest.mock('@/lib/pattern-learning', () => ({
  getLearnedPatterns: jest.fn().mockResolvedValue([]),
  applyLearnedBoosts: jest.fn().mockImplementation(
    (patterns: unknown[]) => patterns
  ),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
  isSupabaseConfigured: true,
}))

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
  createClient: jest.fn(),
}))

// ── Route + mocked lib imports (after mock declarations) ─────────────────────
import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/generate-emails/route'
import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { incrementEmailGeneration } from '@/lib/quota'
import { getDailyVerificationQuota } from '@/lib/verification-quota'
import {
  generateSmartEmailPatternsCached,
  getKnownDomain,
} from '@/lib/enhanced-email-patterns'
import { guessDomain } from '@/lib/email-patterns'
import { verifyDomainMxRecords } from '@/lib/email-verification'

// ── Test helpers ─────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-abc', email: 'tester@example.com' } as const

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/generate-emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const DEFAULT_BODY = {
  firstName: 'Jane',
  lastName: 'Doe',
  companyName: 'Acme',
  companyDomain: 'acme.com',
} as const

function makePatterns(count: number, baseConfidence = 75) {
  return Array.from({ length: count }, (_, i) => ({
    email: `jane.doe${i === 0 ? '' : i}@acme.com`,
    pattern: i === 0 ? 'first.last' : `pattern${i}`,
    confidence: baseConfidence - i * 5,
    learned: false,
  }))
}

function makeMxResult(overrides: Record<string, unknown> = {}) {
  return {
    domain: 'acme.com',
    isValid: true,
    hasMxRecords: true,
    mxRecords: ['aspmx.l.google.com'],
    emailProvider: 'google',
    error: undefined,
    ...overrides,
  }
}

/** Returns a jest mock implementation that creates a fresh Response per call. */
function fetchReturning(deliverability: string, qualityScore = 0.9) {
  return jest.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ deliverability, quality_score: qualityScore }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  )
}

// ── Section 1: Pure scoring function unit tests ───────────────────────────────

describe('calculateDeliverabilityConfidence', () => {
  const { calculateDeliverabilityConfidence } = realEmailVerification

  test('DELIVERABLE always returns 95 regardless of base or smtpScore', () => {
    expect(calculateDeliverabilityConfidence(40, 'DELIVERABLE', 0.0)).toBe(95)
    expect(calculateDeliverabilityConfidence(70, 'DELIVERABLE', 1.0)).toBe(95)
  })

  test('UNDELIVERABLE always returns 5 (hard-bounce floor)', () => {
    expect(calculateDeliverabilityConfidence(80, 'UNDELIVERABLE', 0.9)).toBe(5)
    expect(calculateDeliverabilityConfidence(10, 'UNDELIVERABLE', 0.0)).toBe(5)
  })

  test('RISKY with smtpScore=0 returns 35', () => {
    expect(calculateDeliverabilityConfidence(60, 'RISKY', 0)).toBe(35)
  })

  test('RISKY with smtpScore=1 returns 45', () => {
    expect(calculateDeliverabilityConfidence(60, 'RISKY', 1)).toBe(45)
  })

  test('RISKY with smtpScore=0.5 returns 40', () => {
    expect(calculateDeliverabilityConfidence(60, 'RISKY', 0.5)).toBe(40)
  })

  test('RISKY clamps smtpScore outside 0-1 range', () => {
    expect(calculateDeliverabilityConfidence(60, 'RISKY', -1)).toBe(35)
    expect(calculateDeliverabilityConfidence(60, 'RISKY', 5)).toBe(45)
  })

  test('UNKNOWN falls back to baseConfidence unchanged', () => {
    expect(calculateDeliverabilityConfidence(72, 'UNKNOWN', 0.5)).toBe(72)
    expect(calculateDeliverabilityConfidence(10, 'UNKNOWN', 0.9)).toBe(10)
  })
})

describe('calculateEnhancedConfidence', () => {
  const { calculateEnhancedConfidence } = realEmailVerification

  test('caps output at 85 for unverified (pattern-only) scores', () => {
    expect(calculateEnhancedConfidence(90, true, 'google', 'first.last', true)).toBe(85)
    expect(calculateEnhancedConfidence(100, true, undefined, 'first.last', true)).toBe(85)
  })

  test('floors output at 5', () => {
    // -40 format penalty on a 30-base: 30-40 = -10, floored to 5
    expect(calculateEnhancedConfidence(30, true, undefined, 'first.last', false)).toBe(5)
  })

  test('applies -15 penalty when domain is unresolvable, floored at 10', () => {
    expect(calculateEnhancedConfidence(20, false, undefined, 'first.last', true)).toBe(10)
    expect(calculateEnhancedConfidence(50, false, undefined, 'first.last', true)).toBe(35)
  })

  test('applies -40 penalty for invalid email format', () => {
    const result = calculateEnhancedConfidence(60, true, undefined, 'first.last', false)
    expect(result).toBe(20) // 60 - 40 = 20
  })

  test('Google Workspace boosts first.last by +15', () => {
    const withGoogle = calculateEnhancedConfidence(60, true, 'google', 'first.last', true)
    const noProvider = calculateEnhancedConfidence(60, true, undefined, 'first.last', true)
    expect(withGoogle).toBe(Math.min(85, noProvider + 15))
  })

  test('Microsoft 365 boosts first pattern by +10', () => {
    const withMs = calculateEnhancedConfidence(60, true, 'microsoft', 'first', true)
    const noProvider = calculateEnhancedConfidence(60, true, undefined, 'first', true)
    expect(withMs).toBe(Math.min(85, noProvider + 10))
  })

  test('unknown provider applies no bonus', () => {
    const result = calculateEnhancedConfidence(60, true, undefined, 'first.last', true)
    expect(result).toBe(60)
  })
})

describe('validateEmailFormat', () => {
  const { validateEmailFormat } = realEmailVerification

  test.each([
    'jane.doe@acme.com',
    'j.doe+tag@sub.acme.co.uk',
    'user123@example.io',
  ])('accepts valid address: %s', (email) => {
    expect(validateEmailFormat(email)).toBe(true)
  })

  test.each([
    'not-an-email',
    '@domain.com',
    'user@',
    '',
    'user @domain.com',
  ])('rejects invalid address: %s', (email) => {
    expect(validateEmailFormat(email)).toBe(false)
  })
})

// ── Section 2: POST /api/generate-emails route tests ─────────────────────────

describe('POST /api/generate-emails', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default: authenticated user, quota allowed
    ;(getAuthenticatedUser as jest.Mock).mockResolvedValue(MOCK_USER)
    ;(incrementEmailGeneration as jest.Mock).mockResolvedValue(undefined)
    ;(getDailyVerificationQuota as jest.Mock).mockResolvedValue({
      allowed: true,
      used: 3,
      limit: 10,
      planType: 'free',
      resetAt: new Date(Date.now() + 86_400_000).toISOString(),
    })

    // Default: domain lookup misses, MX valid with Google
    ;(getKnownDomain as jest.Mock).mockResolvedValue(null)
    ;(guessDomain as jest.Mock).mockResolvedValue(null)
    ;(verifyDomainMxRecords as jest.Mock).mockResolvedValue(makeMxResult())

    // Default: 5 patterns generated
    ;(generateSmartEmailPatternsCached as jest.Mock).mockResolvedValue(makePatterns(5))

    // Default: Abstract API says DELIVERABLE
    global.fetch = fetchReturning('DELIVERABLE', 0.95)
  })

  // ── Auth & quota ────────────────────────────────────────────────────────────

  test('returns 401 when request is not authenticated', async () => {
    ;(getAuthenticatedUser as jest.Mock).mockRejectedValueOnce(
      new Error('Unauthorized')
    )
    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  test('returns 402 with quota_exceeded when email generation limit is hit', async () => {
    const { QuotaExceededError } = jest.requireMock('@/lib/quota') as {
      QuotaExceededError: new (f: string, u: number, l: number, p: string) => Error
    }
    ;(incrementEmailGeneration as jest.Mock).mockRejectedValueOnce(
      new QuotaExceededError('email_generation', 25, 25, 'free')
    )

    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(402)
    expect(body.error).toBe('quota_exceeded')
    expect(body.feature).toBe('email_generation')
    expect(body.used).toBe(25)
    expect(body.limit).toBe(25)
    expect(body.plan_type).toBe('free')
    expect(body.upgrade_url).toBe('/dashboard/upgrade')
  })

  // ── Input validation ────────────────────────────────────────────────────────

  test('returns 400 for missing required fields', async () => {
    const res = await POST(makePostRequest({ firstName: 'Jane' })) // missing lastName + companyName
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/validation failed/i)
  })

  test('returns 400 when domain cannot be determined', async () => {
    ;(getKnownDomain as jest.Mock).mockResolvedValue(null)
    ;(guessDomain as jest.Mock).mockResolvedValue(null)

    const res = await POST(
      makePostRequest({ firstName: 'Jane', lastName: 'Doe', companyName: 'UnknownCorp' })
      // no companyDomain provided
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/domain/i)
  })

  // ── Happy path: Abstract API results ────────────────────────────────────────

  test('top email has confidence=95 and status=verified when API returns DELIVERABLE', async () => {
    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    // The highest-confidence input is verified first → should be 95
    const topEmail = body.emails[0]
    expect(topEmail.confidence).toBe(95)
    expect(topEmail.verificationStatus).toBe('verified')
  })

  test('first email has confidence=5 and status=invalid when API returns UNDELIVERABLE', async () => {
    // First call UNDELIVERABLE, rest DELIVERABLE — each call gets a fresh Response
    global.fetch = jest.fn()
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify({ deliverability: 'UNDELIVERABLE', quality_score: 0.0 }), { status: 200 }))
      )
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ deliverability: 'DELIVERABLE', quality_score: 0.9 }), { status: 200 }))
      )

    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)

    // Find the email that was ranked #1 in confidence input (now confidence=5)
    const topInputEmail = makePatterns(5)[0]!.email
    const hit = body.emails.find((e: { email: string }) => e.email === topInputEmail)
    expect(hit).toBeDefined()
    expect(hit.confidence).toBe(5)
    expect(hit.verificationStatus).toBe('invalid')
  })

  test('email stays unverified (not invalid) when API returns RISKY', async () => {
    global.fetch = fetchReturning('RISKY', 0.5)

    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    // No email should be marked invalid (RISKY ≠ confirmed bad)
    const invalidEmails = body.emails.filter(
      (e: { verificationStatus: string }) => e.verificationStatus === 'invalid'
    )
    expect(invalidEmails.length).toBe(0)

    // The 3 emails that were verified by Abstract API should be in the RISKY
    // confidence band (35-45). After re-sort, RISKY emails rank below unverified
    // ones (which keep their base score of 75), so we filter by confidence range.
    const riskyEmails = body.emails.filter(
      (e: { confidence: number; verificationStatus: string }) =>
        e.verificationStatus === 'unverified' &&
        e.confidence >= 35 && e.confidence <= 45
    )
    expect(riskyEmails).toHaveLength(3)
  })

  test('email stays unverified with original confidence when API times out', async () => {
    // Use a plain Error with name overridden — DOMException.name is read-only
    const timeout = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    global.fetch = jest.fn().mockRejectedValue(timeout)

    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    body.emails.forEach((e: { verificationStatus: string }) => {
      expect(e.verificationStatus).toBe('unverified')
    })
  })

  test('email stays unverified when Abstract API returns non-200', async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve(new Response('Service Unavailable', { status: 503 }))
    )

    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    body.emails.forEach((e: { verificationStatus: string }) => {
      expect(e.verificationStatus).toBe('unverified')
    })
  })

  // ── Top-N limiting ──────────────────────────────────────────────────────────

  test('only verifies the top 3 emails even when 10 patterns are generated', async () => {
    ;(generateSmartEmailPatternsCached as jest.Mock).mockResolvedValue(makePatterns(10))

    const res = await POST(makePostRequest(DEFAULT_BODY))

    expect(res.status).toBe(200)
    // Exactly 3 Abstract API calls should be made
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  test('returns all patterns even when fewer than 3 are generated', async () => {
    ;(generateSmartEmailPatternsCached as jest.Mock).mockResolvedValue(makePatterns(2))

    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.emails).toHaveLength(2)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  // ── Result ordering ─────────────────────────────────────────────────────────

  test('response emails are sorted by confidence descending', async () => {
    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    const confidences = body.emails.map((e: { confidence: number }) => e.confidence)
    const sorted = [...confidences].sort((a: number, b: number) => b - a)
    expect(confidences).toEqual(sorted)
  })

  // ── Skip-verification scenarios ─────────────────────────────────────────────

  test('skips Abstract API verification when domain has no MX records', async () => {
    ;(verifyDomainMxRecords as jest.Mock).mockResolvedValue(
      makeMxResult({ isValid: false, hasMxRecords: false, mxRecords: [], error: 'No MX records found' })
    )

    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(global.fetch).not.toHaveBeenCalled()
    body.emails.forEach((e: { verificationStatus: string }) => {
      expect(e.verificationStatus).toBe('unverified')
    })
  })

  test('skips Abstract API when daily verification quota is exhausted', async () => {
    ;(getDailyVerificationQuota as jest.Mock).mockResolvedValue({
      allowed: false,
      used: 10,
      limit: 10,
      planType: 'free',
      resetAt: new Date(Date.now() + 86_400_000).toISOString(),
    })

    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    // Route still succeeds — quota exhaustion is a soft skip, not an error
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // ── Response shape ──────────────────────────────────────────────────────────

  test('response includes all expected top-level fields', async () => {
    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      domain: 'acme.com',
      domainSource: 'provided',
      companySize: expect.any(String),
      verification: expect.objectContaining({
        verified: true,
        hasMxRecords: true,
        emailProvider: 'google',
      }),
      learning: {
        hasLearnedPatterns: false,
        learnedPatternCount: 0,
      },
      emails: expect.any(Array),
      metadata: expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Doe',
        companyName: 'Acme',
        // role is omitted from JSON when undefined
      }),
    })
  })

  test('each email entry has required fields', async () => {
    const res = await POST(makePostRequest(DEFAULT_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    body.emails.forEach((entry: Record<string, unknown>) => {
      expect(entry).toHaveProperty('email')
      expect(entry).toHaveProperty('pattern')
      expect(entry).toHaveProperty('confidence')
      expect(entry).toHaveProperty('verificationStatus')
      expect(entry).toHaveProperty('verification')
      expect(typeof entry.confidence).toBe('number')
    })
  })

  test('domainSource is "known" when getKnownDomain returns a domain', async () => {
    ;(getKnownDomain as jest.Mock).mockResolvedValue('acme.com')

    const res = await POST(
      makePostRequest({ firstName: 'Jane', lastName: 'Doe', companyName: 'Acme' })
      // no companyDomain — should use known domain
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.domainSource).toBe('known')
  })

  // ── GET method ──────────────────────────────────────────────────────────────

  test('GET returns 405 Method Not Allowed', async () => {
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(405)
    expect(body.error).toMatch(/method not allowed/i)
  })
})
