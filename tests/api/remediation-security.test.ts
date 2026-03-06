/**
 * @jest-environment node
 */

jest.mock('@/lib/auth/helpers', () => ({
  getAuthenticatedUserFromRequest: jest.fn(),
}))

jest.mock('@/lib/domain-resolution-service', () => ({
  resolveDomain: jest.fn(),
}))

jest.mock('@/lib/monitoring/sentry', () => ({
  captureApiException: jest.fn(),
  captureSlowApiRoute: jest.fn(),
  withApiRouteSpan: jest.fn(async (_name: string, handler: () => Promise<Response>) => handler()),
}))

jest.mock('@/lib/rate-limit', () => ({
  checkApiRateLimit: jest.fn(),
  rateLimitExceeded: jest.fn(
    () =>
      new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '1',
        },
      })
  ),
}))

jest.mock('@/lib/pattern-learning', () => ({
  recordPatternFeedback: jest.fn(),
}))

jest.mock('@/lib/cache/tags', () => ({
  invalidateEmailPatternCache: jest.fn().mockResolvedValue(0),
}))

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { NextRequest } from 'next/server'

import { POST as learningRecordPost } from '@/app/api/learning/record/route'
import { POST as patternFeedbackPost } from '@/app/api/pattern-feedback/route'
import { POST as resolveDomainV2Post } from '@/app/api/resolve-domain-v2/route'
import { POST as quotaRollbackPost } from '@/app/api/v1/quota/rollback/route'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { resolveDomain } from '@/lib/domain-resolution-service'
import { recordPatternFeedback } from '@/lib/pattern-learning'
import { createServiceRoleClient } from '@/lib/supabase/server'

describe('route remediation hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('POST /api/resolve-domain-v2 denies unauthenticated callers before resolution work', async () => {
    ;(getAuthenticatedUserFromRequest as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await resolveDomainV2Post(
      new NextRequest('http://localhost/api/resolve-domain-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: 'Acme' }),
      })
    )

    expect(response.status).toBe(401)
    expect(resolveDomain).not.toHaveBeenCalled()
  })

  test('POST /api/pattern-feedback denies unauthenticated mutation attempts', async () => {
    ;(getAuthenticatedUserFromRequest as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await patternFeedbackPost(
      new NextRequest('http://localhost/api/pattern-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'jane@acme.com',
          pattern: 'first.last',
          companyDomain: 'acme.com',
          worked: true,
        }),
      })
    )

    expect(response.status).toBe(401)
    expect(recordPatternFeedback).not.toHaveBeenCalled()
  })

  test('POST /api/learning/record is deprecated with 410 Gone', async () => {
    const response = await learningRecordPost()
    const body = await response.json()

    expect(response.status).toBe(410)
    expect(body.error).toMatch(/deprecated endpoint/i)
  })

  test('POST /api/v1/quota/rollback uses the rollback RPC for authenticated callers', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null })

    ;(getAuthenticatedUserFromRequest as jest.Mock).mockResolvedValue({
      id: 'user-123',
    })
    ;(createServiceRoleClient as jest.Mock).mockResolvedValue({
      rpc,
    })

    const response = await quotaRollbackPost(
      new NextRequest('http://localhost/api/v1/quota/rollback', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
        },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledWith('rollback_email_quota', {
      p_user_id: 'user-123',
    })
  })
})
