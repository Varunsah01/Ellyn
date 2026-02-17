/** @jest-environment node */

import {
  createEmailFinderPipeline,
  createInMemoryMxCache,
  type EmailFinderPipelineOptions,
  type MxCacheStore,
} from '@/lib/email-finder'

type TestLogger = {
  logs: Array<{ level: string; event: string; fields?: Record<string, unknown> }>
  metrics: Array<{ name: string; fields?: Record<string, unknown> }>
  logger: NonNullable<EmailFinderPipelineOptions['logger']>
}

function createTestLogger(): TestLogger {
  const logs: Array<{ level: string; event: string; fields?: Record<string, unknown> }> = []
  const metrics: Array<{ name: string; fields?: Record<string, unknown> }> = []

  return {
    logs,
    metrics,
    logger: {
      log: (level, event, fields) => {
        logs.push({ level, event, fields })
      },
      metric: (name, fields) => {
        metrics.push({ name, fields })
      },
    },
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('email-finder pipeline', () => {
  test('verifies domain with MX and returns cache hit on second lookup', async () => {
    const mxResolver = jest.fn(async () => ['mx1.example.com'])
    const cacheStore = createInMemoryMxCache()
    const { logger } = createTestLogger()

    const pipeline = createEmailFinderPipeline({
      mxResolver,
      cacheStore,
      logger,
    })

    const first = await pipeline.verifyMxRecords('example.com')
    const second = await pipeline.verifyMxRecords('example.com')

    expect(first).toEqual({
      domain: 'example.com',
      hasMx: true,
      source: 'dns',
    })
    expect(second).toEqual({
      domain: 'example.com',
      hasMx: true,
      source: 'cached',
    })
    expect(mxResolver).toHaveBeenCalledTimes(1)
  })

  test('returns explicit NO_MX warning when domain has no MX', async () => {
    const mxResolver = jest.fn(async () => [])
    const { logger } = createTestLogger()
    const pipeline = createEmailFinderPipeline({
      mxResolver,
      logger,
      cacheStore: createInMemoryMxCache(),
    })

    const result = await pipeline.verifyMxRecords('acme-corp.io')

    expect(result.domain).toBe('acme-corp.io')
    expect(result.hasMx).toBe(false)
    expect(result.source).toBe('dns')
    expect(result.error).toBe('Domain acme-corp.io has no mail exchange (MX) records.')
  })

  test('handles 405 legacy fallback and still revalidates MX on client side', async () => {
    const fetchFn = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({ error: 'Method not allowed' }, 405))
      .mockResolvedValueOnce(
        jsonResponse({
          domain: 'legacy-no-mx.io',
          verification: {
            hasMxRecords: true,
          },
        })
      )

    const mxResolver = jest.fn(async () => [])
    const { logger } = createTestLogger()
    const pipeline = createEmailFinderPipeline({
      fetchFn,
      mxResolver,
      logger,
      apiBaseUrl: 'https://example.test',
      cacheStore: null,
    })

    const result = await pipeline.resolveDomainOrFail('Legacy No MX Inc')

    expect(result.originalDomain).toBe('legacy-no-mx.io')
    expect(result.resolvedDomain).toBe('legacy-no-mx.io')
    expect(result.hasMx).toBe(false)
    expect(result.usedHeuristic).toBe(false)
    expect(result.warnings).toContain('Legacy response verification flags were ignored. MX was revalidated client-side.')
    expect(result.warnings).toContain('Domain legacy-no-mx.io has no mail exchange (MX) records.')
  })

  test('heuristic fallback is explicit and toggled by policy', async () => {
    const buildFetch = () =>
      jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(
        jsonResponse({
          success: true,
          result: {
            domain: 'acme-corp.io',
            source: 'clearbit',
          },
        })
      )

    const mxResolver = jest.fn(async (domain: string) => {
      if (domain === 'acme-corp.io') return []
      if (domain === 'acmecorp.com') return ['mx1.acmecorp.com']
      return []
    })

    const pipelineNoFallback = createEmailFinderPipeline({
      fetchFn: buildFetch(),
      mxResolver,
      apiBaseUrl: 'https://example.test',
      cacheStore: createInMemoryMxCache(),
    })

    const noFallback = await pipelineNoFallback.resolveDomainOrFailWithPolicy('Acmecorp', undefined, {
      allowHeuristicFallback: false,
    })

    expect(noFallback.originalDomain).toBe('acme-corp.io')
    expect(noFallback.resolvedDomain).toBe('acme-corp.io')
    expect(noFallback.hasMx).toBe(false)
    expect(noFallback.usedHeuristic).toBe(false)

    const pipelineWithFallback = createEmailFinderPipeline({
      fetchFn: buildFetch(),
      mxResolver,
      apiBaseUrl: 'https://example.test',
      cacheStore: createInMemoryMxCache(),
    })

    const withFallback = await pipelineWithFallback.resolveDomainOrFailWithPolicy('Acmecorp', undefined, {
      allowHeuristicFallback: true,
    })

    expect(withFallback.originalDomain).toBe('acme-corp.io')
    expect(withFallback.resolvedDomain).toBe('acmecorp.com')
    expect(withFallback.hasMx).toBe(true)
    expect(withFallback.usedHeuristic).toBe(true)
    expect(withFallback.warnings.some((warning) => warning.includes('differs from resolved domain'))).toBe(true)
  })

  test('redis/cache unavailable logs metric and falls back to DNS without caching', async () => {
    const cacheStore: MxCacheStore = {
      get: jest.fn(async () => {
        throw new Error('redis unavailable')
      }),
      set: jest.fn(async () => undefined),
    }

    const mxResolver = jest.fn(async () => ['mx1.redis-fallback.test'])
    const testLogger = createTestLogger()

    const pipeline = createEmailFinderPipeline({
      mxResolver,
      cacheStore,
      logger: testLogger.logger,
    })

    const first = await pipeline.verifyMxRecords('redis-fallback.test')
    const second = await pipeline.verifyMxRecords('redis-fallback.test')

    expect(first.source).toBe('dns')
    expect(second.source).toBe('dns')
    expect(mxResolver).toHaveBeenCalledTimes(2)
    expect(testLogger.metrics.some((entry) => entry.name === 'mx.cache.unavailable')).toBe(true)
    expect(cacheStore.set).not.toHaveBeenCalled()
  })

  test('network timeout/abort is classified as DNS_TIMEOUT', async () => {
    const mxResolver = jest.fn(
      async (_domain: string, signal: AbortSignal) =>
        await new Promise<string[]>((_, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              const abortError = new Error('aborted')
              abortError.name = 'AbortError'
              reject(abortError)
            },
            { once: true }
          )
        })
    )

    const pipeline = createEmailFinderPipeline({
      timeoutMs: 15,
      mxResolver,
      cacheStore: null,
    })

    const result = await pipeline.verifyMxRecords('timeout-domain.test')

    expect(result.hasMx).toBe(false)
    expect(result.source).toBe('dns')
    expect(result.error).toBe('DNS lookup timed out. Try again.')
  })
})
