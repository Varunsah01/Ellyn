/**
 * @jest-environment node
 */

jest.mock('@/lib/enhanced-email-patterns', () => ({
  getKnownDomain: jest.fn(),
}))

jest.mock('@/lib/llm-client', () => ({
  callLLM: jest.fn(),
}))

jest.mock('@/lib/monitoring/performance', () => ({
  recordExternalApiUsage: jest.fn(),
  timeOperation: jest.fn(async (_label: string, fn: () => Promise<unknown>) => fn()),
}))

import { buildBrandfetchSearchUrl } from '@/lib/domain-resolution-service'

describe('buildBrandfetchSearchUrl', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test('includes the Brandfetch client id query parameter', () => {
    process.env.BRANDFETCH_CLIENT_ID = 'client_123'

    const url = buildBrandfetchSearchUrl('Acme Inc')

    expect(url).toBe('https://api.brandfetch.io/v2/search/acme?c=client_123')
  })

  test('returns null when the Brandfetch client id is missing', () => {
    delete process.env.BRANDFETCH_CLIENT_ID

    expect(buildBrandfetchSearchUrl('Acme Inc')).toBeNull()
  })
})
