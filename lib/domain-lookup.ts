/**
 * Free Domain Lookup Services
 * Uses Clearbit Logo API and Brandfetch API (both free)
 */

import { buildCacheKey, getOrSet } from '@/lib/cache/redis'
import { CACHE_TAGS, companyDomainLookupTag } from '@/lib/cache/tags'
import { recordExternalApiUsage, timeOperation } from '@/lib/monitoring/performance'
import {
  checkCircuit,
  withRetry,
  getServiceTimeout,
  classifyResponse,
  classifyFetchError,
  ApiCallError,
} from '@/lib/api-circuit-breaker'

const DOMAIN_LOOKUP_TTL_SECONDS = 7 * 24 * 60 * 60
const DOMAIN_LOOKUP_NULL_TTL_SECONDS = 60 * 60

function normalizeCompanyLookupInput(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(inc|llc|corp|corporation|ltd|limited|co|company)$/i, '')
    .trim()
}

function getDomainLookupTags(companyName: string): string[] {
  return [CACHE_TAGS.domainLookup, companyDomainLookupTag(companyName)]
}

export async function lookupCompanyDomain(companyName: string): Promise<string | null> {
  // Skip entirely if circuit is open — avoids cache-miss path + wasted latency
  if (!checkCircuit('clearbit')) {
    console.warn('[Domain Lookup] Clearbit circuit open — skipping')
    throw new ApiCallError('circuit_open', 'Clearbit circuit is open')
  }

  const normalizedName = normalizeCompanyLookupInput(companyName)
  if (!normalizedName) return null

  const key = buildCacheKey(['cache', 'domain-lookup', 'clearbit', normalizedName])
  return getOrSet<string | null>({
    key,
    ttlSeconds: DOMAIN_LOOKUP_TTL_SECONDS,
    tags: getDomainLookupTags(normalizedName),
    cacheNull: true,
    nullTtlSeconds: DOMAIN_LOOKUP_NULL_TTL_SECONDS,
    backgroundRefresh: {
      enabled: true,
      hotThreshold: 10,
      refreshAheadSeconds: 12 * 60 * 60,
      cooldownSeconds: 5 * 60,
    },
    fetcher: async () => {
      const startedAt = Date.now()
      try {
        const possibleDomain = `${normalizedName}.com`
        return await withRetry('clearbit', async () => {
          const response = await timeOperation(
            'clearbit.logo.head',
            async () => await fetch(`https://logo.clearbit.com/${possibleDomain}`, {
              method: 'HEAD',
              signal: AbortSignal.timeout(getServiceTimeout('clearbit')),
            }),
            {
              slowThresholdMs: 500,
              context: { provider: 'clearbit', source: 'domain-lookup' },
            }
          )

          if (!response.ok) {
            recordExternalApiUsage({
              service: 'clearbit',
              operation: 'logo-head',
              costUsd: 0,
              durationMs: Date.now() - startedAt,
              statusCode: response.status,
              success: false,
            })
            throw new ApiCallError(classifyResponse(response), `Clearbit ${response.status}`)
          }

          recordExternalApiUsage({
            service: 'clearbit',
            operation: 'logo-head',
            costUsd: 0,
            durationMs: Date.now() - startedAt,
            statusCode: response.status,
            success: true,
          })
          console.log('[Domain Lookup] Clearbit found:', possibleDomain)
          return possibleDomain
        })
      } catch (err) {
        const errorType = err instanceof ApiCallError ? err.errorType : classifyFetchError(err)
        recordExternalApiUsage({
          service: 'clearbit',
          operation: 'logo-head',
          costUsd: 0,
          durationMs: Date.now() - startedAt,
          statusCode: 500,
          success: false,
        })
        console.warn('[Domain Lookup] Clearbit failed:', errorType, err)
        return null
      }
    },
  })
}

/**
 * Brandfetch domain.
 * @param {string} companyName - Company name input.
 * @returns {Promise<string | null>} Computed Promise<string | null>.
 * @throws {Error} If the operation fails.
 * @example
 * brandfetchDomain('companyName')
 */
export async function brandfetchDomain(companyName: string): Promise<string | null> {
  // Skip entirely if circuit is open
  if (!checkCircuit('brandfetch')) {
    console.warn('[Domain Lookup] Brandfetch circuit open — skipping')
    throw new ApiCallError('circuit_open', 'Brandfetch circuit is open')
  }

  const normalizedName = normalizeCompanyLookupInput(companyName)
  if (!normalizedName) return null

  const key = buildCacheKey(['cache', 'domain-lookup', 'brandfetch', normalizedName])
  return getOrSet<string | null>({
    key,
    ttlSeconds: DOMAIN_LOOKUP_TTL_SECONDS,
    tags: getDomainLookupTags(normalizedName),
    cacheNull: true,
    nullTtlSeconds: DOMAIN_LOOKUP_NULL_TTL_SECONDS,
    backgroundRefresh: {
      enabled: true,
      hotThreshold: 10,
      refreshAheadSeconds: 12 * 60 * 60,
      cooldownSeconds: 5 * 60,
    },
    fetcher: async () => {
      const startedAt = Date.now()
      try {
        return await withRetry('brandfetch', async () => {
          const response = await timeOperation(
            'brandfetch.domain-search.fetch',
            async () => await fetch(
              `https://api.brandfetch.io/v2/search/${encodeURIComponent(companyName)}`,
              { signal: AbortSignal.timeout(getServiceTimeout('brandfetch')) }
            ),
            {
              slowThresholdMs: 500,
              context: { provider: 'brandfetch', source: 'domain-lookup' },
            }
          )

          if (!response.ok) {
            recordExternalApiUsage({
              service: 'brandfetch',
              operation: 'company-search',
              costUsd: 0,
              durationMs: Date.now() - startedAt,
              statusCode: response.status,
              success: false,
            })
            throw new ApiCallError(classifyResponse(response), `Brandfetch ${response.status}`)
          }

          const data = await response.json()
          recordExternalApiUsage({
            service: 'brandfetch',
            operation: 'company-search',
            costUsd: 0,
            durationMs: Date.now() - startedAt,
            statusCode: response.status,
            success: true,
          })

          if (Array.isArray(data) && data.length > 0 && data[0].domain) {
            console.log('[Domain Lookup] Brandfetch found:', data[0].domain)
            return data[0].domain
          }

          return null
        })
      } catch (err) {
        const errorType = err instanceof ApiCallError ? err.errorType : classifyFetchError(err)
        recordExternalApiUsage({
          service: 'brandfetch',
          operation: 'company-search',
          costUsd: 0,
          durationMs: Date.now() - startedAt,
          statusCode: 500,
          success: false,
        })
        console.warn('[Domain Lookup] Brandfetch failed:', errorType, err)
        return null
      }
    },
  })
}

/**
 * Google search domain.
 * @param {string} companyName - Company name input.
 * @returns {Promise<string | null>} Computed Promise<string | null>.
 * @throws {Error} If the operation fails.
 * @example
 * googleSearchDomain('companyName')
 */
export async function googleSearchDomain(companyName: string): Promise<string | null> {
  // Skip entirely if circuit is open
  if (!checkCircuit('google_search')) {
    console.warn('[Domain Lookup] Google Search circuit open — skipping')
    throw new ApiCallError('circuit_open', 'Google Search circuit is open')
  }

  const normalizedName = normalizeCompanyLookupInput(companyName)
  if (!normalizedName) return null

  const key = buildCacheKey(['cache', 'domain-lookup', 'google-search', normalizedName])
  return getOrSet<string | null>({
    key,
    ttlSeconds: DOMAIN_LOOKUP_TTL_SECONDS,
    tags: getDomainLookupTags(normalizedName),
    cacheNull: true,
    nullTtlSeconds: DOMAIN_LOOKUP_NULL_TTL_SECONDS,
    backgroundRefresh: {
      enabled: true,
      hotThreshold: 8,
      refreshAheadSeconds: 6 * 60 * 60,
      cooldownSeconds: 10 * 60,
    },
    fetcher: async () => {
      const API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY
      const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID

      // If no API key configured, skip.
      if (!API_KEY || !SEARCH_ENGINE_ID) {
        console.warn('[Domain Lookup] Google Search not configured')
        return null
      }

      const startedAt = Date.now()
      try {
        const query = `${companyName} official website`
        return await withRetry('google_search', async () => {
          const response = await timeOperation(
            'google.custom-search.fetch',
            async () => await fetch(
              `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`,
              { signal: AbortSignal.timeout(getServiceTimeout('google_search')) }
            ),
            {
              slowThresholdMs: 500,
              context: { provider: 'google-custom-search', source: 'domain-lookup' },
            }
          )

          if (!response.ok) {
            recordExternalApiUsage({
              service: 'google-custom-search',
              operation: 'company-search',
              costUsd: 0,
              durationMs: Date.now() - startedAt,
              statusCode: response.status,
              success: false,
            })
            console.warn('[Domain Lookup] Google Search API error:', response.status)
            throw new ApiCallError(classifyResponse(response), `Google Search ${response.status}`)
          }

          const data = await response.json()
          recordExternalApiUsage({
            service: 'google-custom-search',
            operation: 'company-search',
            costUsd: 0,
            durationMs: Date.now() - startedAt,
            statusCode: response.status,
            success: true,
          })

          if (data.items && data.items.length > 0) {
            const url = new URL(data.items[0].link)
            const domain = url.hostname.replace('www.', '')
            console.log('[Domain Lookup] Google Search found:', domain)
            return domain
          }

          return null
        })
      } catch (err) {
        const errorType = err instanceof ApiCallError ? err.errorType : classifyFetchError(err)
        recordExternalApiUsage({
          service: 'google-custom-search',
          operation: 'company-search',
          costUsd: 0,
          durationMs: Date.now() - startedAt,
          statusCode: 500,
          success: false,
        })
        console.warn('[Domain Lookup] Google Search failed:', errorType, err)
        return null
      }
    },
  })
}

/**
 * Heuristic domain guess using smart TLD resolution with MX verification.
 * Returns null if no domain with valid MX records can be found.
 */
export async function heuristicDomainGuess(companyName: string): Promise<string | null> {
  const { smartResolveDomain } = await import('@/lib/smart-tld-resolver')
  const result = await smartResolveDomain(companyName)
  return result?.domain ?? null
}
