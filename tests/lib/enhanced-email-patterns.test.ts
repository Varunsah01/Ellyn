/**
 * @jest-environment node
 */

jest.mock('@/lib/cache/redis', () => ({
  buildCacheKey: jest.fn(),
  getOrSet: jest.fn(),
  normalizeCacheToken: jest.fn(),
}))

jest.mock('@/lib/cache/tags', () => ({
  CACHE_TAGS: {
    domainLookup: 'domain-lookup',
  },
  emailPatternDomainTag: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}))

import {
  generateSmartEmailPatterns,
  normalizeEmailLocalPart,
} from '@/lib/enhanced-email-patterns'

describe('enhanced email pattern sanitization', () => {
  test('normalizes multi-word and punctuated name parts into email-safe local parts', () => {
    expect(normalizeEmailLocalPart(" De La Cruz-Smith ")).toBe('delacruzsmith')
    expect(normalizeEmailLocalPart('Ana María')).toBe('anamaria')
  })

  test('generated patterns do not include spaces for multi-word last names', () => {
    const patterns = generateSmartEmailPatterns(
      'Ana María',
      'De La Cruz',
      {
        domain: 'acme.com',
        estimatedSize: 'medium',
      }
    )

    expect(patterns[0]?.email).toBe('anamaria.delacruz@acme.com')
    expect(patterns.every((pattern) => !pattern.email.includes(' '))).toBe(true)
  })
})
