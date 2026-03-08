/**
 * @jest-environment node
 */

jest.mock('@/lib/auth/helpers', () => ({
  getAuthenticatedUserFromRequest: jest.fn(),
}))

jest.mock('@/lib/quota', () => {
  class QuotaExceededError extends Error {
    feature: string
    used: number
    limit: number
    plan_type: string

    constructor(feature: string, used: number, limit: number, planType: string) {
      super(`Quota exceeded for ${feature}`)
      this.name = 'QuotaExceededError'
      this.feature = feature
      this.used = used
      this.limit = limit
      this.plan_type = planType
    }
  }

  return {
    QuotaExceededError,
    incrementEmailGeneration: jest.fn(),
    incrementAIDraftGeneration: jest.fn(),
  }
})

jest.mock('@/lib/rate-limit', () => ({
  checkApiRateLimit: jest.fn(),
  rateLimitExceeded: jest.fn(
    () =>
      new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
  ),
}))

jest.mock('@/lib/enhanced-email-patterns', () => ({
  estimateCompanySize: jest.fn(),
  generateSmartEmailPatternsCached: jest.fn(),
}))

jest.mock('@/lib/domain-resolution-service', () => ({
  resolveDomain: jest.fn(),
}))

jest.mock('@/lib/mx-verification', () => ({
  verifyDomainMX: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}))

jest.mock('@/lib/abstract-email-validation', () => ({
  verifyEmailAbstract: jest.fn(),
}))

jest.mock('@/lib/monitoring/sentry', () => ({
  captureApiException: jest.fn(),
}))

jest.mock('@/lib/ai/gemini', () => ({
  geminiGenerate: jest.fn(),
}))

jest.mock('@/lib/errors/error-handler', () => ({
  handleApiError: jest.fn(
    () =>
      new Response(JSON.stringify({ error: 'Handled error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
  ),
}))

jest.mock('@/lib/monitoring/performance', () => ({
  monitorApiRoute: jest.fn(
    async (_route: string, _method: string, handler: () => Promise<Response>) => handler()
  ),
}))

import { NextRequest } from 'next/server'

import { POST as enrichPost } from '@/app/api/enrich/route'
import { POST as draftEmailPost } from '@/app/api/v1/ai/draft-email/route'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { incrementAIDraftGeneration, incrementEmailGeneration } from '@/lib/quota'
import { checkApiRateLimit } from '@/lib/rate-limit'

describe('quota validation ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthenticatedUserFromRequest as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(checkApiRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    })
  })

  test('malformed enrich requests do not consume email quota', async () => {
    const response = await enrichPost(
      new NextRequest('http://localhost/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Jane',
        }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(checkApiRateLimit).not.toHaveBeenCalled()
    expect(incrementEmailGeneration).not.toHaveBeenCalled()
  })

  test('malformed AI draft requests do not consume draft quota', async () => {
    const response = await draftEmailPost(
      new NextRequest('http://localhost/api/v1/ai/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          use_case: 'job_seeker',
        }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(incrementAIDraftGeneration).not.toHaveBeenCalled()
  })
})
