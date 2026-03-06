/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}))

import {
  QuotaExceededError,
  incrementAIDraftGeneration,
  incrementEmailGeneration,
} from '@/lib/quota'
import { createServiceRoleClient } from '@/lib/supabase/server'

type QuotaRow = {
  email_lookups_used: number
  email_lookups_limit: number
  ai_draft_generations_used: number
  ai_draft_generations_limit: number
  reset_date: string
  period_start: string
  period_end: string
  user_profiles: { plan_type: string }
}

function createQuotaClient(options: {
  emailDecision?: { allowed: boolean; remaining: number; reset_date: string }
  aiDecision?: { allowed: boolean; remaining: number; reset_date: string }
  quotaRow?: QuotaRow
}) {
  const quotaRow: QuotaRow =
    options.quotaRow ??
    {
      email_lookups_used: 50,
      email_lookups_limit: 50,
      ai_draft_generations_used: 3,
      ai_draft_generations_limit: 150,
      reset_date: '2026-03-31T00:00:00.000Z',
      period_start: '2026-03-01T00:00:00.000Z',
      period_end: '2026-03-31T00:00:00.000Z',
      user_profiles: { plan_type: 'free' },
    }

  const rpc = jest.fn(async (name: string) => {
    if (name === 'ensure_user_quota') {
      return { error: null }
    }

    if (name === 'check_and_increment_quota') {
      return { data: options.emailDecision ?? { allowed: true, remaining: 0, reset_date: quotaRow.reset_date }, error: null }
    }

    if (name === 'check_and_increment_ai_draft') {
      return { data: options.aiDecision ?? { allowed: true, remaining: 147, reset_date: quotaRow.reset_date }, error: null }
    }

    throw new Error(`Unexpected RPC: ${name}`)
  })

  const maybeSingle = jest.fn(async () => ({
    data: quotaRow,
    error: null,
  }))

  const client = {
    rpc,
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle,
        })),
      })),
    })),
  }

  return { client, rpc }
}

describe('quota RPC usage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('email quota denial comes from the atomic RPC path', async () => {
    const { client, rpc } = createQuotaClient({
      emailDecision: {
        allowed: false,
        remaining: 0,
        reset_date: '2026-03-31T00:00:00.000Z',
      },
    })

    ;(createServiceRoleClient as jest.Mock).mockResolvedValue(client)

    await expect(incrementEmailGeneration('user-1')).rejects.toEqual(
      expect.objectContaining<Partial<QuotaExceededError>>({
        name: 'QuotaExceededError',
        feature: 'email_generation',
        used: 50,
        limit: 50,
        plan_type: 'free',
      })
    )
    expect(rpc).toHaveBeenCalledWith('check_and_increment_quota', {
      p_user_id: 'user-1',
      p_quota_type: 'email_lookups',
    })
  })

  test('AI draft quota uses the dedicated atomic draft RPC', async () => {
    const { client, rpc } = createQuotaClient({
      quotaRow: {
        email_lookups_used: 1,
        email_lookups_limit: 500,
        ai_draft_generations_used: 4,
        ai_draft_generations_limit: 150,
        reset_date: '2026-03-31T00:00:00.000Z',
        period_start: '2026-03-01T00:00:00.000Z',
        period_end: '2026-03-31T00:00:00.000Z',
        user_profiles: { plan_type: 'starter' },
      },
    })

    ;(createServiceRoleClient as jest.Mock).mockResolvedValue(client)

    const result = await incrementAIDraftGeneration('user-1')

    expect(result).toEqual({
      used: 4,
      limit: 150,
      plan_type: 'starter',
    })
    expect(rpc).toHaveBeenCalledWith('check_and_increment_ai_draft', {
      p_user_id: 'user-1',
    })
  })
})
