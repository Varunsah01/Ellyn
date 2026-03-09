/**
 * @jest-environment node
 */

jest.mock('@/lib/auth/helpers', () => ({
  getAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/monitoring/sentry', () => ({
  captureApiException: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}))

import { NextRequest } from 'next/server'

import { GET } from '@/app/api/analytics/route'
import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

type QueryResult = {
  data?: unknown
  count?: number | null
  error?: unknown
}

type QueryQueues = Record<string, QueryResult[]>

type QueryBuilder = PromiseLike<QueryResult> & {
  select: jest.Mock
  eq: jest.Mock
  gte: jest.Mock
  lte: jest.Mock
  not: jest.Mock
  order: jest.Mock
  limit: jest.Mock
  single: jest.Mock<Promise<QueryResult>, []>
  maybeSingle: jest.Mock<Promise<QueryResult>, []>
}

function createQueryBuilder(queue: QueryResult[]) {
  const builder = {} as QueryBuilder

  builder.select = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.gte = jest.fn(() => builder)
  builder.lte = jest.fn(() => builder)
  builder.not = jest.fn(() => builder)
  builder.order = jest.fn(() => builder)
  builder.limit = jest.fn(() => builder)
  builder.single = jest.fn(async () => queue.shift() ?? { data: null, error: null })
  builder.maybeSingle = jest.fn(async () => queue.shift() ?? { data: null, error: null })
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(queue.shift() ?? { data: null, count: null, error: null }).then(
      onFulfilled,
      onRejected
    )

  return builder
}

function createMockSupabaseClient(queues: QueryQueues) {
  return {
    from: jest.fn((table: string) => createQueryBuilder(queues[table] ?? [])),
  }
}

describe('Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'test-user',
      email: 'test@example.com',
    })
  })

  test('returns 400 for an invalid metric', async () => {
    ;(createServiceRoleClient as jest.Mock).mockResolvedValue(createMockSupabaseClient({}))

    const request = new NextRequest('http://localhost:3000/api/analytics?metric=invalid')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Invalid metric parameter' })
    expect(getAuthenticatedUser).toHaveBeenCalledTimes(1)
    expect(createServiceRoleClient).toHaveBeenCalledTimes(1)
  })

  test('returns overview metrics with the expected keys and values', async () => {
    ;(createServiceRoleClient as jest.Mock).mockResolvedValue(
      createMockSupabaseClient({
        contacts: [{ count: 5, error: null }],
        drafts: [{ count: 2, error: null }],
        outreach: [
          { count: 1, error: null },
          { data: [{ status: 'replied' }], error: null },
          {
            data: [{ status: 'replied', sent_at: '2026-03-05T10:00:00' }],
            error: null,
          },
          {
            data: [{ sent_at: '2026-03-05T10:00:00' }],
            error: null,
          },
        ],
        email_tracking_events: [
          {
            data: [{ event_type: 'sent' }, { event_type: 'replied' }],
            error: null,
          },
        ],
        sequences: [
          {
            data: [
              {
                id: 'seq-1',
                name: 'Warm Intro',
                status: 'active',
                created_at: '2026-03-01T00:00:00Z',
              },
            ],
            error: null,
          },
        ],
      })
    )

    const request = new NextRequest('http://localhost:3000/api/analytics?metric=overview')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      data: {
        totalContacts: 5,
        totalDrafts: 2,
        emailsSent: 1,
        replyRate: '100.0',
        bestPerformingSequence: 'Warm Intro',
        bestPerformingReplyRate: '100.0',
        mostActiveDay: 'Thursday',
        mostActiveHour: '10:00',
      },
      comparison: null,
    })
  })
})
