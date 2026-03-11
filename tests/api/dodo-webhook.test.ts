/**
 * @jest-environment node
 */

jest.mock('@/lib/dodo', () => ({
  getDodoClient: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { NextRequest } from 'next/server'

import { POST } from '@/app/api/v1/dodo/webhook/route'
import { getDodoClient } from '@/lib/dodo'
import { createServiceRoleClient } from '@/lib/supabase/server'

type SupabaseMockOptions = {
  profile?: { id: string; plan_type: string | null } | null
  webhookInsertError?: { message: string } | null
  ensureQuotaError?: { message: string } | null
  profileUpdateError?: { message: string } | null
  quotaUpdateError?: { message: string } | null
}

function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const calls = {
    profileUpdates: [] as Array<Record<string, unknown>>,
    quotaUpdates: [] as Array<Record<string, unknown>>,
    webhookEvents: [] as Array<Record<string, unknown>>,
    quotaInserts: [] as Array<Record<string, unknown>>,
    rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  }

  const profile = options.profile ?? { id: 'user-1', plan_type: 'free' }

  const client = {
    rpc: jest.fn(async (name: string, args: Record<string, unknown>) => {
      calls.rpcCalls.push({ name, args })
      if (name === 'ensure_user_quota') {
        return { error: options.ensureQuotaError ?? null }
      }
      return { error: null }
    }),
    from: jest.fn((table: string) => {
      if (table === 'dodo_webhook_events') {
        return {
          insert: jest.fn(async (payload: Record<string, unknown>) => {
            calls.webhookEvents.push(payload)
            return { error: options.webhookInsertError ?? null }
          }),
        }
      }

      if (table === 'user_profiles') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({
                data: profile,
                error: null,
              })),
            })),
          })),
          update: jest.fn((payload: Record<string, unknown>) => {
            calls.profileUpdates.push(payload)
            return {
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => ({
                    data: options.profileUpdateError ? null : { id: profile?.id ?? 'user-1' },
                    error: options.profileUpdateError ?? null,
                  })),
                })),
              })),
            }
          }),
        }
      }

      if (table === 'user_quotas') {
        return {
          insert: jest.fn(async (payload: Record<string, unknown>) => {
            calls.quotaInserts.push(payload)
            return { error: null }
          }),
          update: jest.fn((payload: Record<string, unknown>) => {
            calls.quotaUpdates.push(payload)
            return {
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  maybeSingle: jest.fn(async () => ({
                    data: options.quotaUpdateError ? null : { user_id: profile?.id ?? 'user-1' },
                    error: options.quotaUpdateError ?? null,
                  })),
                })),
              })),
            }
          }),
        }
      }

      throw new Error(`Unexpected table access: ${table}`)
    }),
  }

  return { client, calls }
}

function makeWebhookRequest() {
  return new NextRequest('http://localhost/api/v1/dodo/webhook', {
    method: 'POST',
    headers: {
      'webhook-id': 'evt_1',
      'webhook-signature': 'sig_1',
      'webhook-timestamp': '1234567890',
    },
    body: JSON.stringify({ ok: true }),
  })
}

describe('Dodo webhook remediation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      DODO_PAYMENTS_WEBHOOK_KEY: 'whsec_test',
      DODO_STARTER_PRODUCT_ID_MONTHLY: 'starter-prod',
      DODO_PRO_PRODUCT_ID_MONTHLY: 'pro-prod',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test('known product ids activate only the mapped plan', async () => {
    const { client, calls } = createSupabaseMock()

    ;(createServiceRoleClient as jest.Mock).mockResolvedValue(client)
    ;(getDodoClient as jest.Mock).mockReturnValue({
      webhooks: {
        unwrap: jest.fn(() => ({
          type: 'subscription.activated',
          data: {
            id: 'sub_1',
            customer_id: 'cus_1',
            product_id: 'starter-prod',
            metadata: { user_id: 'user-1' },
          },
        })),
      },
    })

    const response = await POST(makeWebhookRequest())

    expect(response.status).toBe(200)
    expect(calls.profileUpdates[0]).toMatchObject({
      plan_type: 'starter',
      subscription_status: 'active',
      dodo_product_id: 'starter-prod',
    })
    expect(calls.quotaUpdates[0]).toMatchObject({
      email_lookups_limit: 500,
      ai_draft_generations_limit: 150,
    })
  })

  test('missing product ids fail closed without upgrading the user', async () => {
    const { client, calls } = createSupabaseMock()

    ;(createServiceRoleClient as jest.Mock).mockResolvedValue(client)
    ;(getDodoClient as jest.Mock).mockReturnValue({
      webhooks: {
        unwrap: jest.fn(() => ({
          type: 'subscription.activated',
          data: {
            id: 'sub_1',
            customer_id: 'cus_1',
            metadata: { user_id: 'user-1' },
          },
        })),
      },
    })

    const response = await POST(makeWebhookRequest())

    expect(response.status).toBe(400)
    expect(calls.profileUpdates).toHaveLength(0)
    expect(calls.quotaUpdates).toHaveLength(0)
  })

  test('unknown product ids fail closed without upgrading the user', async () => {
    const { client, calls } = createSupabaseMock()

    ;(createServiceRoleClient as jest.Mock).mockResolvedValue(client)
    ;(getDodoClient as jest.Mock).mockReturnValue({
      webhooks: {
        unwrap: jest.fn(() => ({
          type: 'subscription.renewed',
          data: {
            id: 'sub_1',
            customer_id: 'cus_1',
            product_id: 'mystery-prod',
            metadata: { user_id: 'user-1' },
          },
        })),
      },
    })

    const response = await POST(makeWebhookRequest())

    expect(response.status).toBe(400)
    expect(calls.profileUpdates).toHaveLength(0)
    expect(calls.quotaUpdates).toHaveLength(0)
  })

  test('database update failures are surfaced instead of silently succeeding', async () => {
    const { client } = createSupabaseMock({
      profileUpdateError: { message: 'profile update failed' },
    })

    ;(createServiceRoleClient as jest.Mock).mockResolvedValue(client)
    ;(getDodoClient as jest.Mock).mockReturnValue({
      webhooks: {
        unwrap: jest.fn(() => ({
          type: 'subscription.active',
          data: {
            id: 'sub_1',
            customer_id: 'cus_1',
            product_id: 'pro-prod',
            metadata: { user_id: 'user-1' },
          },
        })),
      },
    })

    const response = await POST(makeWebhookRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatch(/failed to process webhook/i)
  })
})
