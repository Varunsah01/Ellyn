import {
  calculateSimilarity,
  extractDomain,
  heuristicGuessDomain,
  isLikelyInvalidDomain,
  normalizeCompanyName,
  normalizeDomain,
  validateDomainWithMX,
} from '@/lib/domain-utils'
import { recordExternalApiUsage, timeOperation } from '@/lib/monitoring/performance'

export type DomainSource =
  | 'cache'
  | 'linkedin-company-page'
  | 'clearbit'
  | 'brandfetch'
  | 'google-search'
  | 'heuristic'
  | 'known-db'

export interface DomainResult {
  domain: string
  source: DomainSource
  confidence: number
  websiteUrl?: string
  metadata?: {
    companyName?: string
    logo?: string
    provider?: string
    validated?: boolean
    timestamp?: number
  }
}

export interface ResolveDomainParams {
  companyName: string
  companyPageUrl?: string
  skipCache?: boolean
  skipMXValidation?: boolean
}

const DOMAIN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const LINKEDIN_FETCH_TIMEOUT_MS = 5000
const API_FETCH_TIMEOUT_MS = 3000

const SEARCH_DOMAIN_BLOCKLIST = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'wikipedia.org',
  'youtube.com',
  'crunchbase.com',
]

// In-memory cache for fast domain lookups (runtime-local).
const domainCache = new Map<string, DomainResult>()

/**
 * Main orchestrator for layered domain resolution.
 */
export async function resolveDomain(params: ResolveDomainParams): Promise<DomainResult> {
  const originalName = String(params.companyName || '').trim()
  if (!originalName) {
    throw new Error('companyName is required')
  }

  const normalizedName = normalizeCompanyName(originalName) || originalName.toLowerCase().trim()
  const cacheKey = normalizedName.replace(/\s+/g, '-')

  console.log('[Domain] Starting resolution', {
    companyName: originalName,
    normalizedName,
    hasCompanyPageUrl: Boolean(params.companyPageUrl),
    skipCache: Boolean(params.skipCache),
    skipMXValidation: Boolean(params.skipMXValidation),
  })

  // Layer 0: Cache
  if (!params.skipCache) {
    const cached = await getDomainFromCache(cacheKey)
    if (cached) {
      console.log('[Domain] Layer 0 cache hit', { cacheKey, domain: cached.domain })
      return {
        ...cached,
        source: 'cache',
      }
    }
    console.log('[Domain] Layer 0 cache miss', { cacheKey })
  } else {
    console.log('[Domain] Layer 0 cache skipped')
  }

  // Layer 1: LinkedIn company page
  if (params.companyPageUrl) {
    try {
      const linkedinResult = await extractDomainFromLinkedIn(params.companyPageUrl)
      if (linkedinResult) {
        const validated = await applyMxValidationIfNeeded(linkedinResult, Boolean(params.skipMXValidation))
        if (validated) {
          await saveDomainToCache(cacheKey, validated)
          return validated
        }
      }
    } catch (error) {
      console.error('[LinkedIn] Layer 1 failed:', sanitizeError(error))
    }
  } else {
    console.log('[LinkedIn] Layer 1 skipped (no companyPageUrl)')
  }

  // Layer 2: Clearbit
  try {
    const clearbit = await resolveDomainFromClearbit(originalName, normalizedName)
    if (clearbit) {
      const validated = await applyMxValidationIfNeeded(clearbit, Boolean(params.skipMXValidation))
      if (validated) {
        await saveDomainToCache(cacheKey, validated)
        return validated
      }
    }
  } catch (error) {
    console.error('[Clearbit] Layer 2 failed:', sanitizeError(error))
  }

  // Layer 3: Brandfetch
  try {
    const brandfetch = await resolveDomainFromBrandfetch(normalizedName)
    if (brandfetch) {
      const validated = await applyMxValidationIfNeeded(brandfetch, Boolean(params.skipMXValidation))
      if (validated) {
        await saveDomainToCache(cacheKey, validated)
        return validated
      }
    }
  } catch (error) {
    console.error('[Brandfetch] Layer 3 failed:', sanitizeError(error))
  }

  // Layer 4: Google Search
  const hasGoogleSearchConfig = Boolean(
    process.env.GOOGLE_CUSTOM_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID
  )
  if (hasGoogleSearchConfig) {
    try {
      const google = await resolveDomainFromGoogle(originalName)
      if (google) {
        const validated = await applyMxValidationIfNeeded(google, Boolean(params.skipMXValidation))
        if (validated) {
          await saveDomainToCache(cacheKey, validated)
          return validated
        }
      }
    } catch (error) {
      console.error('[Google Search] Layer 4 failed:', sanitizeError(error))
    }
  } else {
    console.log('[Google Search] Layer 4 skipped (missing GOOGLE_CUSTOM_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID)')
  }

  // Layer 5: Heuristic fallback
  console.log('[Domain] Layer 5 heuristic fallback')
  const heuristicDomain = normalizeDomain(heuristicGuessDomain(normalizedName || originalName))
  if (!heuristicDomain) {
    throw new Error('Failed to build heuristic fallback domain')
  }

  const heuristicInvalid = isLikelyInvalidDomain(heuristicDomain)
  if (heuristicInvalid) {
    return {
      domain: heuristicDomain,
      source: 'heuristic',
      confidence: 0.3,
      metadata: {
        validated: false,
      },
    }
  }

  const mxResult = await validateDomainWithMX(heuristicDomain)
  const heuristicResult: DomainResult = {
    domain: heuristicDomain,
    source: 'heuristic',
    confidence: mxResult.valid ? 0.6 : 0.3,
    metadata: {
      provider: mxResult.provider,
      validated: mxResult.valid,
    },
  }

  if (mxResult.valid) {
    await saveDomainToCache(cacheKey, heuristicResult)
  }

  return heuristicResult
}

/**
 * Fetches LinkedIn company page HTML and attempts website/domain extraction.
 */
export async function extractDomainFromLinkedIn(companyPageUrl: string): Promise<DomainResult | null> {
  const normalizedUrl = normalizeLinkedInCompanyUrl(companyPageUrl)
  if (!normalizedUrl) {
    console.log('[LinkedIn] Invalid company page URL input')
    return null
  }

  console.log('[LinkedIn] Fetching company page', { companyPageUrl: normalizedUrl })
  const startedAt = Date.now()
  let response: Response
  try {
    response = await timeOperation(
      'external.linkedin.company-page.fetch',
      async () => await fetch(normalizedUrl, {
        method: 'GET',
        credentials: 'include',
        signal: AbortSignal.timeout(LINKEDIN_FETCH_TIMEOUT_MS),
        cache: 'no-store',
      }),
      {
        slowThresholdMs: 500,
        context: {
          source: 'linkedin-company-page',
        },
      }
    )
  } catch (error) {
    const statusCode = Number((error as { status?: number })?.status)
    recordExternalApiUsage({
      service: 'linkedin',
      operation: 'company-page-fetch',
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      statusCode: Number.isFinite(statusCode) ? statusCode : 500,
      success: false,
    })
    throw error
  }

  recordExternalApiUsage({
    service: 'linkedin',
    operation: 'company-page-fetch',
    costUsd: 0,
    durationMs: Date.now() - startedAt,
    statusCode: response.status,
    success: response.ok,
  })

  if (!response.ok) {
    console.log('[LinkedIn] Company page fetch failed', { status: response.status })
    return null
  }

  const html = await response.text()
  const parsed = parseLinkedInCompanyPage(html)
  if (!parsed) {
    console.log('[LinkedIn] Could not parse external website from company page HTML')
    return null
  }

  return {
    domain: parsed.domain,
    source: 'linkedin-company-page',
    confidence: parsed.confidence,
    websiteUrl: parsed.websiteUrl,
    metadata: {
      validated: false,
    },
  }
}

/**
 * Layer 2 resolver via Clearbit autocomplete API.
 */
export async function resolveDomainFromClearbit(
  originalName: string,
  normalizedName: string
): Promise<DomainResult | null> {
  const query = normalizeCompanyName(normalizedName || originalName)
  if (!query) return null

  const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`
  console.log('[Clearbit] Querying autocomplete', { query })

  const payload = await requestJson(url, API_FETCH_TIMEOUT_MS)
  if (!Array.isArray(payload)) {
    return null
  }

  type ClearbitSuggestion = {
    name?: string
    domain?: string
    logo?: string
  }

  let best: {
    suggestion: ClearbitSuggestion
    score: number
  } | null = null

  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue
    const suggestion = entry as ClearbitSuggestion
    const candidateDomain = normalizeDomain(String(suggestion.domain || ''))
    if (!candidateDomain || isLikelyInvalidDomain(candidateDomain)) continue

    const score = Math.max(
      calculateSimilarity(originalName, String(suggestion.name || '')),
      calculateSimilarity(normalizedName, String(suggestion.name || ''))
    )

    if (!best || score > best.score) {
      best = { suggestion, score }
    }
  }

  if (!best || best.score < 0.7) {
    console.log('[Clearbit] No sufficiently similar company match found', {
      bestScore: best?.score || 0,
    })
    return null
  }

  const resolved = normalizeDomain(String(best.suggestion.domain || ''))
  if (!resolved) return null

  return {
    domain: resolved,
    source: 'clearbit',
    confidence: Math.max(0, Math.min(1, best.score * 0.9)),
    metadata: {
      companyName: String(best.suggestion.name || ''),
      logo: String(best.suggestion.logo || ''),
      validated: false,
    },
  }
}

/**
 * Layer 3 resolver via Brandfetch search API.
 */
export async function resolveDomainFromBrandfetch(normalizedName: string): Promise<DomainResult | null> {
  const query = normalizeCompanyName(normalizedName)
  if (!query) return null

  const url = `https://api.brandfetch.io/v2/search/${encodeURIComponent(query)}`
  console.log('[Brandfetch] Querying search API', { query })

  const payload = await requestJson(url, API_FETCH_TIMEOUT_MS)
  const domain = extractBrandfetchDomain(payload)
  if (!domain) {
    return null
  }

  return {
    domain,
    source: 'brandfetch',
    confidence: 0.82,
    metadata: {
      companyName: query,
      validated: false,
    },
  }
}

/**
 * Layer 4 resolver via Google Custom Search.
 */
export async function resolveDomainFromGoogle(companyName: string): Promise<DomainResult | null> {
  const apiKey = String(process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '').trim()
  const cx = String(process.env.GOOGLE_SEARCH_ENGINE_ID || '').trim()
  if (!apiKey || !cx) {
    return null
  }

  const search1 = await searchGoogle(
    `site:linkedin.com/company "${companyName}"`,
    apiKey,
    cx
  )

  for (const item of search1) {
    const snippet = String(item.snippet || '')
    const websiteMatch = snippet.match(/Website:\s*(https?:\/\/[^\s]+)/i)
    if (!websiteMatch?.[1]) continue

    const domain = extractDomain(websiteMatch[1])
    if (!domain || isBlockedSearchDomain(domain)) continue

    console.log('[Google Search] Resolved from LinkedIn-style snippet', { domain })
    return {
      domain,
      source: 'google-search',
      confidence: 0.85,
      websiteUrl: websiteMatch[1],
      metadata: {
        companyName,
        validated: false,
      },
    }
  }

  const search2 = await searchGoogle(`"${companyName}" official website`, apiKey, cx)
  for (const item of search2) {
    const directDomain = extractDomain(String(item.link || ''))
    if (!directDomain || isBlockedSearchDomain(directDomain)) continue

    console.log('[Google Search] Resolved from top web result', { domain: directDomain })
    return {
      domain: directDomain,
      source: 'google-search',
      confidence: 0.75,
      websiteUrl: String(item.link || ''),
      metadata: {
        companyName,
        validated: false,
      },
    }
  }

  return null
}

/**
 * In-memory cache getter with 30-day TTL.
 */
export async function getDomainFromCache(key: string): Promise<DomainResult | null> {
  const cacheKey = String(key || '').trim()
  if (!cacheKey) return null

  const cached = domainCache.get(cacheKey)
  if (!cached) return null

  const age = Date.now() - Number(cached.metadata?.timestamp || 0)
  if (age > DOMAIN_CACHE_TTL_MS) {
    domainCache.delete(cacheKey)
    return null
  }

  return cached
}

/**
 * In-memory cache setter.
 */
export async function saveDomainToCache(key: string, result: DomainResult): Promise<void> {
  const cacheKey = String(key || '').trim()
  if (!cacheKey || !result?.domain) return

  const stored: DomainResult = {
    ...result,
    metadata: {
      ...(result.metadata || {}),
      timestamp: Date.now(),
    },
  }

  domainCache.set(cacheKey, stored)
}

async function applyMxValidationIfNeeded(
  result: DomainResult,
  skipMXValidation: boolean
): Promise<DomainResult | null> {
  if (skipMXValidation) {
    return {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        validated: false,
      },
    }
  }

  console.log('[MX] Validating domain', { domain: result.domain, source: result.source })
  const mx = await validateDomainWithMX(result.domain)
  if (!mx.valid) {
    console.log('[MX] Domain validation failed', { domain: result.domain, source: result.source })
    return null
  }

  console.log('[MX] Domain validated', { domain: result.domain, provider: mx.provider || 'other' })
  return {
    ...result,
    metadata: {
      ...(result.metadata || {}),
      provider: mx.provider || 'other',
      validated: true,
    },
  }
}

function normalizeLinkedInCompanyUrl(url: string): string | null {
  const raw = String(url || '').trim()
  if (!raw) return null

  try {
    const withProtocol = raw.startsWith('http') ? raw : `https://www.linkedin.com${raw}`
    const parsed = new URL(withProtocol)
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function parseLinkedInCompanyPage(
  html: string
): { domain: string; websiteUrl: string; source: string; confidence: number } | null {
  if (!html || typeof html !== 'string') return null

  const matches: Array<{ domain: string; websiteUrl: string; source: string; confidence: number }> = []

  const pushIfValid = (websiteUrl: string, source: string, confidence: number) => {
    if (!websiteUrl || /linkedin\.com/i.test(websiteUrl)) return
    const domain = extractDomain(websiteUrl)
    if (!domain || isLikelyInvalidDomain(domain)) return
    matches.push({
      domain,
      websiteUrl,
      source,
      confidence,
    })
  }

  try {
    const websiteAnchorRegex =
      /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*data-tracking-control-name="[^"]*website[^"]*"/gi
    for (const match of html.matchAll(websiteAnchorRegex)) {
      pushIfValid(String(match[1] || ''), 'website-anchor', 0.95)
    }
  } catch {
    // Continue with fallback parsing strategies.
  }

  try {
    const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]+?)<\/script>/gi
    for (const match of html.matchAll(jsonLdRegex)) {
      const raw = String(match[1] || '').trim()
      if (!raw) continue

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        continue
      }

      const nodes = Array.isArray(parsed) ? parsed : [parsed]
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        const obj = node as Record<string, unknown>
        const typeValue = String(obj['@type'] || '').toLowerCase()
        if (typeValue !== 'organization') continue
        pushIfValid(String(obj.url || ''), 'json-ld', 0.92)
      }
    }
  } catch {
    // Continue with fallback parsing strategies.
  }

  try {
    const ogRegex = /<meta property="og:url" content="(https?:\/\/[^"]+)"/i
    const ogMatch = html.match(ogRegex)
    if (ogMatch?.[1]) {
      pushIfValid(String(ogMatch[1]), 'open-graph', 0.85)
    }
  } catch {
    // Continue with fallback parsing strategies.
  }

  try {
    const canonicalRegex = /<link rel="canonical" href="(https?:\/\/[^"]+)"/i
    const canonicalMatch = html.match(canonicalRegex)
    if (canonicalMatch?.[1]) {
      pushIfValid(String(canonicalMatch[1]), 'canonical', 0.8)
    }
  } catch {
    // Final fallback finished.
  }

  if (matches.length === 0) return null
  matches.sort((a, b) => b.confidence - a.confidence)
  const topMatch = matches[0]
  return topMatch ?? null
}

function extractBrandfetchDomain(payload: unknown): string | null {
  const candidates: unknown[] = []

  if (Array.isArray(payload)) {
    candidates.push(...payload)
  } else if (payload && typeof payload === 'object') {
    const asObj = payload as Record<string, unknown>
    if (Array.isArray(asObj.results)) candidates.push(...asObj.results)
    if (Array.isArray(asObj.companies)) candidates.push(...asObj.companies)
    candidates.push(asObj)
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const obj = candidate as Record<string, unknown>

    const fromDomain = normalizeDomain(String(obj.domain || ''))
    if (fromDomain && !isLikelyInvalidDomain(fromDomain)) {
      return fromDomain
    }

    const fromWebsite = extractDomain(String(obj.website || obj.url || ''))
    if (fromWebsite && !isLikelyInvalidDomain(fromWebsite)) {
      return fromWebsite
    }
  }

  return null
}

function isBlockedSearchDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain)
  if (!normalized) return true
  return SEARCH_DOMAIN_BLOCKLIST.some((blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`))
}

async function searchGoogle(
  query: string,
  apiKey: string,
  cx: string
): Promise<Array<{ link?: string; snippet?: string }>> {
  const endpoint = new URL('https://www.googleapis.com/customsearch/v1')
  endpoint.searchParams.set('key', apiKey)
  endpoint.searchParams.set('cx', cx)
  endpoint.searchParams.set('q', query)
  endpoint.searchParams.set('num', '5')

  const payload = await requestJson(endpoint.toString(), API_FETCH_TIMEOUT_MS)
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const items = (payload as { items?: unknown }).items
  if (!Array.isArray(items)) return []

  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = item as Record<string, unknown>
      return {
        link: typeof row.link === 'string' ? row.link : '',
        snippet: typeof row.snippet === 'string' ? row.snippet : '',
      }
    })
}

async function requestJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const startedAt = Date.now()
  const { service, operation, host } = classifyExternalRequest(url)
  try {
    const response = await timeOperation(
      `external.${service}.request`,
      async () => await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      }),
      {
        slowThresholdMs: 500,
        context: {
          service,
          operation,
          host,
        },
      }
    )

    if (!response.ok) {
      recordExternalApiUsage({
        service,
        operation,
        costUsd: 0,
        durationMs: Date.now() - startedAt,
        statusCode: response.status,
        success: false,
      })
      return null
    }

    const payload = (await response.json()) as unknown
    recordExternalApiUsage({
      service,
      operation,
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      statusCode: response.status,
      success: true,
    })

    return payload
  } catch (error) {
    const statusCode = Number((error as { status?: number })?.status)
    recordExternalApiUsage({
      service,
      operation,
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      statusCode: Number.isFinite(statusCode) ? statusCode : 500,
      success: false,
    })
    return null
  }
}

function classifyExternalRequest(url: string): {
  service: string
  operation: string
  host: string
} {
  let host = 'unknown'
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    host = 'unknown'
  }

  if (host.includes('clearbit.com')) {
    return { service: 'clearbit', operation: 'company-autocomplete', host }
  }
  if (host.includes('brandfetch.io')) {
    return { service: 'brandfetch', operation: 'company-search', host }
  }
  if (host.includes('googleapis.com')) {
    return { service: 'google-custom-search', operation: 'company-search', host }
  }
  if (host.includes('linkedin.com')) {
    return { service: 'linkedin', operation: 'company-page-fetch', host }
  }

  return { service: 'other', operation: 'http-request', host }
}

function sanitizeError(error: unknown): { message: string; name?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    }
  }
  return {
    message: String(error),
  }
}

/*
Example (manual) test:
const result = await resolveDomain({ companyName: "Microsoft Corporation", companyPageUrl: "https://www.linkedin.com/company/microsoft/" });
console.log(result);
*/
