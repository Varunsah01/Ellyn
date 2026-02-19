/**
 * @jest-environment node
 *
 * Integration tests for the email discovery flow.
 *
 * These tests exercise the full POST /api/generate-emails handler end-to-end,
 * covering domain resolution strategies (provided / known / cached / inferred),
 * daily verification quota enforcement, cost recording, and pattern-learning
 * metadata across free and pro plan tiers.
 */

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
  CACHE_TAGS: {
    mxVerification: 'mx-verification',
    emailVerification: 'email-address-verification',
  },
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
  return { QuotaExceededError, incrementEmailGeneration: jest.fn() }
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

jest.mock('@/lib/email-verification', () => {
  const real = jest.requireActual<typeof import('@/lib/email-verification')>(
    '@/lib/email-verification'
  )
  return { ...real, verifyDomainMxRecords: jest.fn() }
})

jest.mock('@/lib/pattern-learning', () => ({
  getLearnedPatterns: jest.fn().mockResolvedValue([]),
  applyLearnedBoosts: jest.fn().mockImplementation((p: unknown[]) => p),
}))

// Supabase browser client — configurable per-test for domain_cache scenarios
const mockSupabaseSingle = jest.fn()
const mockSupabaseUpsert = jest.fn()
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: mockSupabaseSingle,
      upsert: mockSupabaseUpsert,
    })),
  },
  isSupabaseConfigured: true,
}))

// Supabase service role — tracks fire-and-forget cost recording inserts
const mockServiceInsert = jest.fn().mockResolvedValue({ data: null, error: null })
jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({ insert: mockServiceInsert }),
  }),
  createClient: jest.fn(),
}))

// ── Imports ───────────────────────────────────────────────────────────────────
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/generate-emails/route'
import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { incrementEmailGeneration } from '@/lib/quota'
import { getDailyVerificationQuota } from '@/lib/verification-quota'
import {
  generateSmartEmailPatternsCached,
  getKnownDomain,
} from '@/lib/enhanced-email-patterns'
import { guessDomain } from '@/lib/email-patterns'
import { verifyDomainMxRecords } from '@/lib/email-verification'
import { invalidateCompanyDomainLookupCache } from '@/lib/cache/tags'

// ── Shared test helpers ───────────────────────────────────────────────────────

const FREE_USER = { id: 'free-user-01', email: 'free@example.com' } as const
const PRO_USER = { id: 'pro-user-01', email: 'pro@example.com' } as const

async function discoverEmails(body: Record<string, unknown>) {
  const res = await POST(
    new NextRequest('http://localhost:3000/api/generate-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
  return { res, body: await res.json() }
}

function makePatterns(count: number, domain = 'acme.com', baseConfidence = 75) {
  return Array.from({ length: count }, (_, i) => ({
    email: `alice${i === 0 ? '' : i}@${domain}`,
    pattern: i === 0 ? 'first.last' : `p${i}`,
    confidence: baseConfidence - i * 5,
    learned: false,
  }))
}

function validMxResult(domain = 'acme.com') {
  return {
    domain,
    isValid: true,
    hasMxRecords: true,
    mxRecords: ['aspmx.l.google.com'],
    emailProvider: 'google',
    error: undefined,
  }
}

function noMxResult(domain = 'acme.com') {
  return {
    domain,
    isValid: false,
    hasMxRecords: false,
    mxRecords: [],
    error: 'No MX records found',
  }
}

/** Returns a jest mock that creates a fresh Response per call (body can only be read once). */
function deliverableFetch() {
  return jest.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ deliverability: 'DELIVERABLE', quality_score: 0.95 }),
        { status: 200 }
      )
    )
  )
}

type QuotaResult = {
  allowed: boolean
  used: number
  limit: number
  planType: 'free' | 'pro'
  resetAt: string
}

function freeQuota(used = 3): QuotaResult {
  return { allowed: used < 10, used, limit: 10, planType: 'free', resetAt: tomorrow() }
}

function proQuota(used = 20): QuotaResult {
  return { allowed: used < 100, used, limit: 100, planType: 'pro', resetAt: tomorrow() }
}

function tomorrow() {
  return new Date(Date.now() + 86_400_000).toISOString()
}

const BASE_REQUEST = {
  firstName: 'Alice',
  lastName: 'Wong',
  companyName: 'Acme',
  companyDomain: 'acme.com',
} as const

// ── Shared beforeEach wiring ──────────────────────────────────────────────────

function wireDefaults(user = FREE_USER, quota = freeQuota()) {
  ;(getAuthenticatedUser as jest.Mock).mockResolvedValue(user)
  ;(incrementEmailGeneration as jest.Mock).mockResolvedValue(undefined)
  ;(getDailyVerificationQuota as jest.Mock).mockResolvedValue(quota)
  ;(getKnownDomain as jest.Mock).mockResolvedValue(null)
  ;(guessDomain as jest.Mock).mockResolvedValue(null)
  ;(verifyDomainMxRecords as jest.Mock).mockResolvedValue(validMxResult())
  ;(generateSmartEmailPatternsCached as jest.Mock).mockResolvedValue(makePatterns(3))
  mockSupabaseSingle.mockResolvedValue({ data: null, error: null })
  mockSupabaseUpsert.mockResolvedValue({ data: null, error: null })
  global.fetch = deliverableFetch()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('email discovery — domain resolution strategies', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wireDefaults()
  })

  test('companyDomain provided → domainSource=provided, guessDomain not called', async () => {
    const { res, body } = await discoverEmails(BASE_REQUEST)

    expect(res.status).toBe(200)
    expect(body.domain).toBe('acme.com')
    expect(body.domainSource).toBe('provided')
    expect(guessDomain).not.toHaveBeenCalled()
  })

  test('no companyDomain, getKnownDomain returns domain → domainSource=known', async () => {
    ;(getKnownDomain as jest.Mock).mockResolvedValue('acme.com')

    const { res, body } = await discoverEmails({
      firstName: 'Alice',
      lastName: 'Wong',
      companyName: 'Acme Corp',
      // no companyDomain
    })

    expect(res.status).toBe(200)
    expect(body.domain).toBe('acme.com')
    expect(body.domainSource).toBe('known')
  })

  test('domain_cache hit within 7 days → domainSource=cache, cache domain used', async () => {
    // The cache lookup only runs when domainSource==='inferred', so guessDomain must
    // return a domain first (the cache then overrides it with the cached value).
    ;(guessDomain as jest.Mock).mockResolvedValue('acme-guessed.com')

    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    mockSupabaseSingle.mockResolvedValueOnce({
      data: { domain: 'acme.com', last_verified: recentDate },
      error: null,
    })

    const { res, body } = await discoverEmails({
      firstName: 'Alice',
      lastName: 'Wong',
      companyName: 'Acme',
      // no companyDomain → inferred → cache check runs
    })

    expect(res.status).toBe(200)
    expect(body.domain).toBe('acme.com')          // cache value wins over guessed domain
    expect(body.domainSource).toBe('cache')
  })

  test('stale cache entry (> 7 days) is ignored, guessed domain is kept', async () => {
    // guessDomain returns initial guess; stale cache entry should not override it
    ;(guessDomain as jest.Mock).mockResolvedValue('acme.com')

    const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    mockSupabaseSingle.mockResolvedValueOnce({
      data: { domain: 'old-acme.com', last_verified: staleDate },
      error: null,
    })

    const { res, body } = await discoverEmails({
      firstName: 'Alice',
      lastName: 'Wong',
      companyName: 'Acme',
    })

    expect(res.status).toBe(200)
    expect(body.domain).toBe('acme.com')       // guessed domain kept, stale cache ignored
    expect(body.domainSource).toBe('inferred')
  })

  test('verified domain is upserted to domain_cache and cache tag invalidated', async () => {
    const { res } = await discoverEmails(BASE_REQUEST)

    expect(res.status).toBe(200)
    expect(mockSupabaseUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'acme',
        domain: 'acme.com',
        verified: true,
      }),
      expect.objectContaining({ onConflict: 'company_name' })
    )
    expect(invalidateCompanyDomainLookupCache).toHaveBeenCalledWith('Acme')
  })

  test('domain already sourced from cache → NOT written to domain_cache again', async () => {
    // Need guessDomain to succeed so the route reaches the cache lookup step
    ;(guessDomain as jest.Mock).mockResolvedValue('acme-guess.com')

    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    mockSupabaseSingle.mockResolvedValueOnce({
      data: { domain: 'acme.com', last_verified: recentDate },
      error: null,
    })

    const { res } = await discoverEmails({
      firstName: 'Alice',
      lastName: 'Wong',
      companyName: 'Acme',
    })

    expect(res.status).toBe(200)
    expect(mockSupabaseUpsert).not.toHaveBeenCalled()
  })

  test('failed MX verification → domain NOT written to cache', async () => {
    ;(verifyDomainMxRecords as jest.Mock).mockResolvedValue(noMxResult('bad-domain.xyz'))

    const { res } = await discoverEmails({
      firstName: 'Alice',
      lastName: 'Wong',
      companyName: 'Bad Corp',
      companyDomain: 'bad-domain.xyz',
    })

    expect(res.status).toBe(200)
    expect(mockSupabaseUpsert).not.toHaveBeenCalled()
  })
})

describe('email discovery — daily verification quota', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wireDefaults()
    ;(generateSmartEmailPatternsCached as jest.Mock).mockResolvedValue(makePatterns(5))
  })

  test('free user with quota remaining (3/10) → Abstract API called 3×', async () => {
    ;(getDailyVerificationQuota as jest.Mock).mockResolvedValue(freeQuota(3))

    const { res, body } = await discoverEmails(BASE_REQUEST)

    expect(res.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(3)   // TOP_N_TO_VERIFY = 3
    expect(body.emails[0].verificationStatus).toBe('verified')
  })

  test('free user with exhausted quota (10/10) → verification skipped, all emails unverified', async () => {
    ;(getDailyVerificationQuota as jest.Mock).mockResolvedValue(freeQuota(10))

    const { res, body } = await discoverEmails(BASE_REQUEST)

    expect(res.status).toBe(200)
    expect(global.fetch).not.toHaveBeenCalled()
    body.emails.forEach((e: { verificationStatus: string }) => {
      expect(e.verificationStatus).toBe('unverified')
    })
  })

  test('pro user with quota remaining (20/100) → Abstract API called 3×', async () => {
    ;(getAuthenticatedUser as jest.Mock).mockResolvedValue(PRO_USER)
    ;(getDailyVerificationQuota as jest.Mock).mockResolvedValue(proQuota(20))

    const { res, body } = await discoverEmails(BASE_REQUEST)

    expect(res.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(body.emails[0].verificationStatus).toBe('verified')
  })

  test('pro user with exhausted quota (100/100) → verification skipped', async () => {
    ;(getAuthenticatedUser as jest.Mock).mockResolvedValue(PRO_USER)
    ;(getDailyVerificationQuota as jest.Mock).mockResolvedValue(proQuota(100))

    const { res, body } = await discoverEmails(BASE_REQUEST)

    expect(res.status).toBe(200)
    expect(global.fetch).not.toHaveBeenCalled()
    body.emails.forEach((e: { verificationStatus: string }) => {
      expect(e.verificationStatus).toBe('unverified')
    })
  })

  test('quota check is skipped entirely when domain has no MX records', async () => {
    ;(verifyDomainMxRecords as jest.Mock).mockResolvedValue(noMxResult())

    const { res } = await discoverEmails(BASE_REQUEST)

    expect(res.status).toBe(200)
    // No MX → verification not attempted → getDailyVerificationQuota never called
    expect(getDailyVerificationQuota).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('email discovery — cost recording', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wireDefaults(FREE_USER, freeQuota(1))
    ;(generateSmartEmailPatternsCached as jest.Mock).mockResolvedValue(makePatterns(3))
  })

  test('records a cost entry per Abstract API call with correct metadata', async () => {
    const { res } = await discoverEmails(BASE_REQUEST)
    expect(res.status).toBe(200)

    // Fire-and-forget — give micro-tasks a moment to settle
    await new Promise((r) => setTimeout(r, 30))

    expect(mockServiceInsert).toHaveBeenCalledTimes(3)
    expect(mockServiceInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: FREE_USER.id,
        service: 'abstract',
        cost_usd: 0.001,
        metadata: expect.objectContaining({
          endpoint: 'verify-email',
          source: 'abstract',
          calledFrom: 'generate-emails',
        }),
      })
    )
  })

  test('no cost entries recorded when verification is skipped (no MX)', async () => {
    ;(verifyDomainMxRecords as jest.Mock).mockResolvedValue(noMxResult())

    const { res } = await discoverEmails(BASE_REQUEST)
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 30))
    expect(mockServiceInsert).not.toHaveBeenCalled()
  })
})

describe('email discovery — pattern learning metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wireDefaults()
  })

  test('hasLearnedPatterns=true when learned patterns exist for the domain', async () => {
    const { getLearnedPatterns, applyLearnedBoosts } = jest.requireMock(
      '@/lib/pattern-learning'
    ) as { getLearnedPatterns: jest.Mock; applyLearnedBoosts: jest.Mock }

    const patterns = makePatterns(3)
    ;(getLearnedPatterns as jest.Mock).mockResolvedValue([
      { pattern: 'first.last', boostScore: 0.2 },
    ])
    ;(generateSmartEmailPatternsCached as jest.Mock).mockResolvedValue(patterns)
    ;(applyLearnedBoosts as jest.Mock).mockReturnValue(
      patterns.map((p, i) => ({ ...p, learned: i === 0 }))
    )

    const { res, body } = await discoverEmails(BASE_REQUEST)

    expect(res.status).toBe(200)
    expect(body.learning.hasLearnedPatterns).toBe(true)
    expect(body.learning.learnedPatternCount).toBe(1)
  })

  test('hasLearnedPatterns=false when no learned patterns exist', async () => {
    const { getLearnedPatterns } = jest.requireMock(
      '@/lib/pattern-learning'
    ) as { getLearnedPatterns: jest.Mock }

    ;(getLearnedPatterns as jest.Mock).mockResolvedValue([])

    const { res, body } = await discoverEmails(BASE_REQUEST)

    expect(res.status).toBe(200)
    expect(body.learning.hasLearnedPatterns).toBe(false)
    expect(body.learning.learnedPatternCount).toBe(0)
  })
})
