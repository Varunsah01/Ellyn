import { heuristicGuessDomain, normalizeCompanyName, normalizeDomain } from '@/lib/domain-utils'
import { createLogger, sanitizeLogFields } from '@/lib/logger'

export interface MxVerifyResult {
  domain: string
  hasMx: boolean
  error?: string
  source: 'dns' | 'cached'
}

export interface ResolvedDomainResult {
  originalDomain: string
  resolvedDomain: string
  hasMx: boolean
  usedHeuristic: boolean
  warnings: string[]
}

export interface EmailCandidate {
  email: string
  confidence: number
  notes?: string[]
}

export interface ApiErrorClassification {
  isRecoverable: boolean
  code: string
  message: string
}

type PipelineLogLevel = 'debug' | 'info' | 'warn' | 'error'

type PipelineLogFields = Record<string, unknown>

interface PipelineLogger {
  log: (level: PipelineLogLevel, event: string, fields?: PipelineLogFields) => void
  metric: (name: string, fields?: PipelineLogFields) => void
}

export interface MxCacheStore {
  get: (domain: string) => Promise<MxVerifyResult | null>
  set: (domain: string, value: MxVerifyResult, ttlSeconds: number) => Promise<void>
}

type MxResolver = (domain: string, signal: AbortSignal) => Promise<string[]>

interface ResolveDomainPolicy {
  allowHeuristicFallback: boolean
}

export interface EmailFinderPipelineOptions {
  apiBaseUrl?: string
  authToken?: string
  timeoutMs?: number
  cacheTtlSeconds?: number
  defaultResolvePolicy?: Partial<ResolveDomainPolicy>
  fetchFn?: typeof fetch
  mxResolver?: MxResolver
  cacheStore?: MxCacheStore | null
  logger?: PipelineLogger
}

interface PipelineErrorOptions {
  code: string
  message: string
  isRecoverable: boolean
  status?: number
}

type MutableError = Error & {
  code?: string
  status?: number
  isRecoverable?: boolean
}

type ResolveApiPayload = {
  domain: string
  source: string
  usedLegacy: boolean
  warnings: string[]
}

const DEFAULT_TIMEOUT_MS = 3_000
const DEFAULT_CACHE_TTL_SECONDS = 10 * 60

const DEFAULT_RESOLVE_POLICY: ResolveDomainPolicy = {
  allowHeuristicFallback: false,
}

const REDIS_CACHE_PREFIX = 'cache:mx-verification:pipeline:'

let defaultRedisCachePromise: Promise<MxCacheStore | null> | null = null

const pipelineLog = createLogger('EmailFinder')

const defaultLogger: PipelineLogger = {
  log: (level, event, fields = {}) => {
    const payload = sanitizeLogFields({
      event,
      ...fields,
    })

    if (level === 'error') {
      pipelineLog.error(event, payload)
      return
    }

    if (level === 'warn') {
      pipelineLog.warn(event, payload)
      return
    }

    if (level === 'info') {
      pipelineLog.info(event, payload)
      return
    }

    pipelineLog.debug(event, payload)
  },
  metric: (name, fields = {}) => {
    pipelineLog.info('metric', sanitizeLogFields({ metric: name, ...fields }))
  },
}

export function createPolyfillSignal(ms: number): AbortSignal {
  const timeoutMs = normalizeTimeoutMs(ms)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timeoutId)
    },
    { once: true }
  )

  return controller.signal
}

export const createPollyfillSignal = createPolyfillSignal

export function createTimeoutSignal(ms: number): AbortSignal {
  const timeoutMs = normalizeTimeoutMs(ms)
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }
  return createPolyfillSignal(timeoutMs)
}

export function classifyApiError(error: Error): ApiErrorClassification {
  const typedError = error as MutableError
  const status = Number(typedError.status)
  const code = String(typedError.code || '').trim().toUpperCase()
  const message = String(typedError.message || '').trim()
  const messageLower = message.toLowerCase()

  if (code === 'NO_MX_RECORDS' || messageLower.includes('no mail exchange') || messageLower.includes('no mx')) {
    return {
      isRecoverable: false,
      code: 'NO_MX_RECORDS',
      message: message || 'Domain has no mail exchange (MX) records.',
    }
  }

  if (
    code === 'DNS_TIMEOUT' ||
    code === 'ABORT_ERR' ||
    messageLower.includes('timed out') ||
    messageLower.includes('timeout') ||
    messageLower.includes('abort')
  ) {
    return {
      isRecoverable: true,
      code: 'DNS_TIMEOUT',
      message: 'DNS lookup timed out. Try again.',
    }
  }

  if (code === 'INVALID_DOMAIN' || messageLower.includes('invalid domain')) {
    return {
      isRecoverable: false,
      code: 'INVALID_DOMAIN',
      message: message || 'Invalid domain value.',
    }
  }

  if (code === 'NETWORK_FAILURE' || messageLower.includes('failed to fetch') || messageLower.includes('network')) {
    return {
      isRecoverable: true,
      code: 'NETWORK_FAILURE',
      message: 'Network request failed. Try again.',
    }
  }

  if (status === 405) {
    return {
      isRecoverable: true,
      code: 'METHOD_NOT_ALLOWED',
      message: 'API method is not allowed in this environment.',
    }
  }

  if (status >= 500 && status <= 599) {
    return {
      isRecoverable: true,
      code: 'SERVER_FAILURE',
      message: 'Server temporarily unavailable. Try again.',
    }
  }

  if (typedError.isRecoverable === true) {
    return {
      isRecoverable: true,
      code: code || 'RECOVERABLE_ERROR',
      message: message || 'Recoverable error.',
    }
  }

  return {
    isRecoverable: false,
    code: code || 'UNKNOWN_FAILURE',
    message: message || 'Unexpected error.',
  }
}

export function createInMemoryMxCache(): MxCacheStore {
  const entries = new Map<string, { expiresAt: number; result: MxVerifyResult }>()

  return {
    get: async (domain) => {
      const key = normalizeDomain(domain)
      if (!key) return null

      const cached = entries.get(key)
      if (!cached) return null

      if (Date.now() >= cached.expiresAt) {
        entries.delete(key)
        return null
      }

      return {
        ...cached.result,
        domain: key,
        source: 'cached',
      }
    },
    set: async (domain, value, ttlSeconds) => {
      const key = normalizeDomain(domain)
      if (!key) return

      entries.set(key, {
        expiresAt: Date.now() + Math.max(1, Math.trunc(ttlSeconds)) * 1000,
        result: {
          domain: key,
          hasMx: value.hasMx === true,
          error: value.error,
          source: 'cached',
        },
      })
    },
  }
}

export async function createRedisMxCache(logger: PipelineLogger = defaultLogger): Promise<MxCacheStore | null> {
  type RedisClient = {
    get: <T = unknown>(key: string) => Promise<T | null>
    set: (key: string, value: unknown, options?: { ex?: number }) => Promise<unknown>
  }

  try {
    const moduleRef = await import('@vercel/kv')
    const createClient = (moduleRef as { createClient?: (options: { url: string; token: string; automaticDeserialization?: boolean }) => RedisClient }).createClient
    const fallbackKv = (moduleRef as { kv?: RedisClient }).kv

    const url = getEnv('KV_REST_API_URL') || getEnv('UPSTASH_REDIS_REST_URL')
    const token = getEnv('KV_REST_API_TOKEN') || getEnv('UPSTASH_REDIS_REST_TOKEN')

    let redis: RedisClient | null = null

    if (url && token && typeof createClient === 'function') {
      redis = createClient({
        url,
        token,
        automaticDeserialization: true,
      })
    } else if (fallbackKv) {
      redis = fallbackKv
    }

    if (!redis) {
      logger.metric('mx.cache.redis_unavailable', {
        reason: 'missing_credentials',
      })
      logger.log('warn', 'mx_cache_redis_unavailable', {
        reason: 'missing_credentials',
      })
      return null
    }

    return {
      get: async (domain) => {
        const normalized = normalizeDomain(domain)
        if (!normalized) return null
        const cacheKey = `${REDIS_CACHE_PREFIX}${normalized}`

        try {
          const hit = await redis.get<MxVerifyResult>(cacheKey)
          if (!hit) return null

          return {
            domain: normalized,
            hasMx: hit.hasMx === true,
            error: typeof hit.error === 'string' ? hit.error : undefined,
            source: 'cached',
          }
        } catch (error) {
          logger.metric('mx.cache.get_error', {
            domain: normalized,
            error: compactError(error),
          })
          logger.log('warn', 'mx_cache_get_failed', {
            domain: normalized,
            error: compactError(error),
          })
          throw error
        }
      },
      set: async (domain, value, ttlSeconds) => {
        const normalized = normalizeDomain(domain)
        if (!normalized) return

        const cacheKey = `${REDIS_CACHE_PREFIX}${normalized}`
        const ttl = Math.max(1, Math.trunc(ttlSeconds))

        try {
          await redis.set(cacheKey, {
            domain: normalized,
            hasMx: value.hasMx === true,
            error: value.error,
            source: 'cached',
          }, { ex: ttl })
        } catch (error) {
          logger.metric('mx.cache.set_error', {
            domain: normalized,
            error: compactError(error),
          })
          logger.log('warn', 'mx_cache_set_failed', {
            domain: normalized,
            error: compactError(error),
          })
          throw error
        }
      },
    }
  } catch (error) {
    logger.metric('mx.cache.redis_unavailable', {
      reason: 'module_load_failed',
      error: compactError(error),
    })
    logger.log('warn', 'mx_cache_redis_init_failed', {
      reason: 'module_load_failed',
      error: compactError(error),
    })
    return null
  }
}

async function getDefaultRedisCache(logger: PipelineLogger): Promise<MxCacheStore | null> {
  if (!defaultRedisCachePromise) {
    defaultRedisCachePromise = createRedisMxCache(logger)
  }
  return defaultRedisCachePromise
}

function createPipelineError(options: PipelineErrorOptions): Error {
  const error = new Error(options.message) as MutableError
  error.code = options.code
  error.isRecoverable = options.isRecoverable
  if (typeof options.status === 'number') {
    error.status = options.status
  }
  return error
}

function compactError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}

function getEnv(name: string): string {
  if (typeof process === 'undefined' || !process.env) {
    return ''
  }

  return String(process.env[name] || '').trim()
}

function normalizeTimeoutMs(value: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_TIMEOUT_MS
  }
  return Math.trunc(numeric)
}

function ensureDomain(value: string): string {
  const normalized = normalizeDomain(value)
  if (!normalized) {
    throw createPipelineError({
      code: 'INVALID_DOMAIN',
      message: `Invalid domain value "${value}".`,
      isRecoverable: false,
    })
  }
  return normalized
}

function normalizeApiBaseUrl(value: string | undefined): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

async function parseJsonSafe(response: Response): Promise<unknown | null> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function isLikelyNoMxError(error: unknown): boolean {
  const typed = error as { code?: string; message?: string }
  const code = String(typed?.code || '').toUpperCase()
  const message = String(typed?.message || '').toLowerCase()

  if (code === 'ENODATA' || code === 'ENOTFOUND' || code === 'NO_MX_RECORDS') {
    return true
  }

  return message.includes('no mx') || message.includes('no data')
}

function isTimeoutLikeError(error: unknown): boolean {
  const typed = error as { code?: string; name?: string; message?: string }
  const code = String(typed?.code || '').toUpperCase()
  const name = String(typed?.name || '').toUpperCase()
  const message = String(typed?.message || '').toLowerCase()

  if (code === 'ETIMEOUT' || code === 'DNS_TIMEOUT' || code === 'ABORT_ERR') {
    return true
  }
  if (name === 'ABORTERROR' || name === 'TIMEOUTERROR') {
    return true
  }
  return message.includes('timeout') || message.includes('timed out') || message.includes('abort')
}

async function resolveMxViaNodeDns(domain: string, timeoutMs: number): Promise<string[] | null> {
  if (typeof window !== 'undefined') {
    return null
  }

  try {
    const dnsModule = await import('dns/promises')
    const records = await Promise.race([
      dnsModule.resolveMx(domain),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(createPipelineError({
            code: 'DNS_TIMEOUT',
            message: `DNS lookup timed out for ${domain}.`,
            isRecoverable: true,
          }))
        }, timeoutMs)
      }),
    ])

    return records
      .sort((a, b) => a.priority - b.priority)
      .map((entry) => String(entry.exchange || '').trim().toLowerCase())
      .filter(Boolean)
  } catch {
    return null
  }
}

async function resolveMxViaDnsOverHttps(
  domain: string,
  timeoutMs: number,
  fetchFn: typeof fetch
): Promise<string[]> {
  const endpoint = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`
  const response = await fetchFn(endpoint, {
    method: 'GET',
    cache: 'no-store',
    signal: createTimeoutSignal(timeoutMs),
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw createPipelineError({
      code: 'NETWORK_FAILURE',
      message: `DNS-over-HTTPS failed with status ${response.status}.`,
      isRecoverable: response.status >= 500,
      status: response.status,
    })
  }

  const payload = (await parseJsonSafe(response)) as
    | {
        Answer?: Array<{ type?: number; data?: string }>
      }
    | null

  const answers = Array.isArray(payload?.Answer) ? payload.Answer : []
  return answers
    .filter((entry) => Number(entry?.type) === 15 && typeof entry?.data === 'string')
    .map((entry) => String(entry.data || '').trim().toLowerCase())
    .filter(Boolean)
}

async function defaultMxResolver(domain: string, signal: AbortSignal, fetchFn: typeof fetch, timeoutMs: number): Promise<string[]> {
  if (signal.aborted) {
    throw createPipelineError({
      code: 'DNS_TIMEOUT',
      message: `DNS lookup timed out for ${domain}.`,
      isRecoverable: true,
    })
  }

  const nodeDnsResult = await resolveMxViaNodeDns(domain, timeoutMs)
  if (nodeDnsResult) {
    return nodeDnsResult
  }

  return resolveMxViaDnsOverHttps(domain, timeoutMs, fetchFn)
}

function buildResolveHeaders(authToken: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  return headers
}

async function resolveDomainFromApi(
  companyName: string,
  fetchFn: typeof fetch,
  apiBaseUrl: string,
  authToken: string,
  timeoutMs: number,
  logger: PipelineLogger
): Promise<ResolveApiPayload> {
  const warnings: string[] = []
  const body = JSON.stringify({
    companyName,
  })

  const callApi = async (path: string) => {
    const url = `${apiBaseUrl}${path}`
    const response = await fetchFn(url, {
      method: 'POST',
      headers: buildResolveHeaders(authToken),
      credentials: 'include',
      cache: 'no-store',
      signal: createTimeoutSignal(timeoutMs),
      body,
    })

    return {
      response,
      payload: await parseJsonSafe(response),
    }
  }

  const parseDomainFromPayload = (payload: unknown): { domain: string; source: string } | null => {
    const asObject = payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null

    if (!asObject) return null

    const result = asObject.result
    if (result && typeof result === 'object') {
      const nested = result as Record<string, unknown>
      const nestedDomain = normalizeDomain(String(nested.domain || ''))
      if (nestedDomain) {
        return {
          domain: nestedDomain,
          source: String(nested.source || 'resolve-domain-v2').trim() || 'resolve-domain-v2',
        }
      }
    }

    const topLevelDomain = normalizeDomain(String(asObject.domain || ''))
    if (!topLevelDomain) {
      return null
    }

    return {
      domain: topLevelDomain,
      source: String(asObject.source || 'resolve-domain').trim() || 'resolve-domain',
    }
  }

  try {
    const primary = await callApi('/api/v1/resolve-domain-v2')
    if (primary.response.status === 405 || primary.response.status === 404) {
      warnings.push(
        `Primary domain resolver returned ${primary.response.status}. Falling back to legacy /api/v1/resolve-domain.`
      )

      const legacy = await callApi('/api/v1/resolve-domain')
      if (!legacy.response.ok) {
        throw createPipelineError({
          code: 'RESOLVE_DOMAIN_FAILED',
          message: `Legacy domain resolver failed with status ${legacy.response.status}.`,
          isRecoverable: legacy.response.status >= 500,
          status: legacy.response.status,
        })
      }

      const legacyResolved = parseDomainFromPayload(legacy.payload)
      if (!legacyResolved) {
        throw createPipelineError({
          code: 'RESOLVE_DOMAIN_FAILED',
          message: 'Legacy domain resolver returned an invalid payload.',
          isRecoverable: false,
          status: legacy.response.status,
        })
      }

      warnings.push('Legacy response verification flags were ignored. MX was revalidated client-side.')

      return {
        domain: legacyResolved.domain,
        source: legacyResolved.source || 'resolve-domain-legacy',
        usedLegacy: true,
        warnings,
      }
    }

    if (!primary.response.ok) {
      throw createPipelineError({
        code: 'RESOLVE_DOMAIN_FAILED',
        message: `Primary domain resolver failed with status ${primary.response.status}.`,
        isRecoverable: primary.response.status >= 500,
        status: primary.response.status,
      })
    }

    const resolved = parseDomainFromPayload(primary.payload)
    if (!resolved) {
      throw createPipelineError({
        code: 'RESOLVE_DOMAIN_FAILED',
        message: 'Primary domain resolver returned an invalid payload.',
        isRecoverable: false,
        status: primary.response.status,
      })
    }

    return {
      domain: resolved.domain,
      source: resolved.source || 'resolve-domain-v2',
      usedLegacy: false,
      warnings,
    }
  } catch (error) {
    logger.log('warn', 'domain_resolution_api_failed', {
      companyName,
      error: compactError(error),
    })

    if (error instanceof Error) {
      throw error
    }

    throw createPipelineError({
      code: 'NETWORK_FAILURE',
      message: 'Domain resolution request failed.',
      isRecoverable: true,
    })
  }
}

export interface EmailFinderPipeline {
  verifyMxRecords: (domain: string) => Promise<MxVerifyResult>
  resolveDomainOrFail: (companyName: string, rawInputDomain?: string) => Promise<ResolvedDomainResult>
  resolveDomainOrFailWithPolicy: (
    companyName: string,
    rawInputDomain: string | undefined,
    policy: Partial<ResolveDomainPolicy>
  ) => Promise<ResolvedDomainResult>
  generateEmailCandidates: (
    domain: string,
    mode: 'primary' | 'heuristic'
  ) => Promise<EmailCandidate[]>
  classifyApiError: (error: Error) => ApiErrorClassification
}

/**
 * Creates the email-finder pipeline with injectable dependencies.
 *
 * Expected log format:
 * [EmailFinder] { scope, level, event, ...fields }
 * [EmailFinder][Metric] { scope, metric, ...fields }
 */
export function createEmailFinderPipeline(options: EmailFinderPipelineOptions = {}): EmailFinderPipeline {
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs || DEFAULT_TIMEOUT_MS)
  const cacheTtlSeconds = Math.max(1, Math.trunc(Number(options.cacheTtlSeconds || DEFAULT_CACHE_TTL_SECONDS)))
  const logger = options.logger || defaultLogger
  const authToken = String(options.authToken || '').trim()
  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl)
  const defaultPolicy: ResolveDomainPolicy = {
    ...DEFAULT_RESOLVE_POLICY,
    ...options.defaultResolvePolicy,
  }

  const getFetch = (): typeof fetch => {
    if (options.fetchFn) return options.fetchFn
    if (typeof fetch === 'function') return fetch

    throw createPipelineError({
      code: 'NETWORK_FAILURE',
      message: 'Fetch API is unavailable in this runtime.',
      isRecoverable: true,
    })
  }

  const resolveMxRecords = async (domain: string, signal: AbortSignal): Promise<string[]> => {
    if (options.mxResolver) {
      return options.mxResolver(domain, signal)
    }
    return defaultMxResolver(domain, signal, getFetch(), timeoutMs)
  }

  const getCacheStore = async (): Promise<MxCacheStore | null> => {
    if (options.cacheStore !== undefined) {
      return options.cacheStore
    }
    return getDefaultRedisCache(logger)
  }

  const verifyMxRecordsImpl = async (domain: string): Promise<MxVerifyResult> => {
    const normalizedDomain = ensureDomain(domain)
    const cacheStore = await getCacheStore()
    let cacheUnavailable = false

    if (cacheStore) {
      try {
        const cached = await cacheStore.get(normalizedDomain)
        if (cached) {
          logger.log('info', 'mx_verify_cache_hit', {
            domain: normalizedDomain,
            hasMx: cached.hasMx,
          })
          return {
            domain: normalizedDomain,
            hasMx: cached.hasMx === true,
            error: cached.error,
            source: 'cached',
          }
        }
      } catch (error) {
        cacheUnavailable = true
        logger.metric('mx.cache.unavailable', {
          domain: normalizedDomain,
          error: compactError(error),
        })
        logger.log('warn', 'mx_cache_unavailable_fallback_dns', {
          domain: normalizedDomain,
          error: compactError(error),
        })
      }
    }

    const timeoutSignal = createTimeoutSignal(timeoutMs)

    try {
      const mxRecords = await resolveMxRecords(normalizedDomain, timeoutSignal)
      const hasMx = mxRecords.length > 0

      const result: MxVerifyResult = {
        domain: normalizedDomain,
        hasMx,
        source: 'dns',
        ...(hasMx
          ? {}
          : {
              error: `Domain ${normalizedDomain} has no mail exchange (MX) records.`,
            }),
      }

      if (cacheStore && !cacheUnavailable) {
        try {
          await cacheStore.set(normalizedDomain, result, cacheTtlSeconds)
        } catch (error) {
          cacheUnavailable = true
          logger.metric('mx.cache.unavailable', {
            domain: normalizedDomain,
            error: compactError(error),
          })
          logger.log('warn', 'mx_cache_write_failed', {
            domain: normalizedDomain,
            error: compactError(error),
          })
        }
      }

      logger.log('info', 'mx_verify_dns_complete', {
        domain: normalizedDomain,
        hasMx,
        source: 'dns',
        mxRecords: mxRecords.length,
      })

      return result
    } catch (error) {
      let classifiedError: Error

      if (isLikelyNoMxError(error)) {
        classifiedError = createPipelineError({
          code: 'NO_MX_RECORDS',
          message: `Domain ${normalizedDomain} has no mail exchange (MX) records.`,
          isRecoverable: false,
        })
      } else if (isTimeoutLikeError(error)) {
        classifiedError = createPipelineError({
          code: 'DNS_TIMEOUT',
          message: `DNS lookup timed out for ${normalizedDomain}.`,
          isRecoverable: true,
        })
      } else if (error instanceof Error) {
        classifiedError = error
      } else {
        classifiedError = createPipelineError({
          code: 'NETWORK_FAILURE',
          message: 'Failed to verify MX records.',
          isRecoverable: true,
        })
      }

      const classification = classifyApiError(classifiedError)
      logger.log('warn', 'mx_verify_failed', {
        domain: normalizedDomain,
        code: classification.code,
        recoverable: classification.isRecoverable,
        error: compactError(error),
      })

      return {
        domain: normalizedDomain,
        hasMx: false,
        error: classification.message,
        source: 'dns',
      }
    }
  }

  const resolveDomainOrFailWithPolicy = async (
    companyName: string,
    rawInputDomain: string | undefined,
    policy: Partial<ResolveDomainPolicy>
  ): Promise<ResolvedDomainResult> => {
    const normalizedCompany = normalizeCompanyName(companyName || '')
    const cleanCompany = normalizedCompany || String(companyName || '').trim()
    if (!cleanCompany) {
      throw createPipelineError({
        code: 'INVALID_COMPANY',
        message: 'companyName is required.',
        isRecoverable: false,
      })
    }

    const effectivePolicy: ResolveDomainPolicy = {
      ...defaultPolicy,
      ...policy,
    }

    const warnings: string[] = []

    let primaryDomain = normalizeDomain(String(rawInputDomain || ''))
    if (!primaryDomain) {
      const resolved = await resolveDomainFromApi(
        cleanCompany,
        getFetch(),
        apiBaseUrl,
        authToken,
        timeoutMs,
        logger
      )
      primaryDomain = resolved.domain
      warnings.push(...resolved.warnings)
      if (resolved.usedLegacy) {
        warnings.push('Legacy domain fallback was used due API method mismatch.')
      }
    }

    if (!primaryDomain) {
      throw createPipelineError({
        code: 'RESOLVE_DOMAIN_FAILED',
        message: 'Unable to resolve company domain.',
        isRecoverable: false,
      })
    }

    const primaryMx = await verifyMxRecordsImpl(primaryDomain)
    if (primaryMx.hasMx) {
      return {
        originalDomain: primaryDomain,
        resolvedDomain: primaryDomain,
        hasMx: true,
        usedHeuristic: false,
        warnings,
      }
    }

    warnings.push(`Domain ${primaryDomain} has no mail exchange (MX) records.`)

    if (!effectivePolicy.allowHeuristicFallback) {
      return {
        originalDomain: primaryDomain,
        resolvedDomain: primaryDomain,
        hasMx: false,
        usedHeuristic: false,
        warnings,
      }
    }

    const guessedDomain = normalizeDomain(heuristicGuessDomain(cleanCompany))
    if (!guessedDomain) {
      warnings.push('Heuristic fallback was enabled, but no fallback domain could be generated.')
      return {
        originalDomain: primaryDomain,
        resolvedDomain: primaryDomain,
        hasMx: false,
        usedHeuristic: false,
        warnings,
      }
    }

    if (guessedDomain !== primaryDomain) {
      warnings.push(
        `Heuristic fallback enabled: fallback domain ${guessedDomain} differs from resolved domain ${primaryDomain}.`
      )
    } else {
      warnings.push('Heuristic fallback enabled, but fallback domain equals resolved domain.')
    }

    const heuristicMx = await verifyMxRecordsImpl(guessedDomain)
    if (heuristicMx.hasMx) {
      return {
        originalDomain: primaryDomain,
        resolvedDomain: guessedDomain,
        hasMx: true,
        usedHeuristic: true,
        warnings,
      }
    }

    warnings.push(`Fallback domain ${guessedDomain} has no mail exchange (MX) records.`)

    return {
      originalDomain: primaryDomain,
      resolvedDomain: primaryDomain,
      hasMx: false,
      usedHeuristic: false,
      warnings,
    }
  }

  const resolveDomainOrFail = async (companyName: string, rawInputDomain?: string) =>
    resolveDomainOrFailWithPolicy(companyName, rawInputDomain, {
      allowHeuristicFallback: false,
    })

  const generateEmailCandidates = async (
    domain: string,
    mode: 'primary' | 'heuristic'
  ): Promise<EmailCandidate[]> => {
    const normalizedDomain = ensureDomain(domain)
    const normalizedMode = mode === 'heuristic' ? 'heuristic' : 'primary'

    const templates = [
      {
        local: 'first.last',
        confidence: normalizedMode === 'primary' ? 0.64 : 0.36,
      },
      {
        local: 'firstlast',
        confidence: normalizedMode === 'primary' ? 0.52 : 0.29,
      },
      {
        local: 'flast',
        confidence: normalizedMode === 'primary' ? 0.44 : 0.23,
      },
      {
        local: 'first',
        confidence: normalizedMode === 'primary' ? 0.34 : 0.18,
      },
    ]

    const modeNote =
      normalizedMode === 'primary'
        ? 'Primary domain candidate. Validate deliverability before outreach.'
        : 'Heuristic domain candidate. Confidence intentionally reduced until verified.'

    return templates.map((template) => ({
      email: `${template.local}@${normalizedDomain}`,
      confidence: template.confidence,
      notes: [modeNote],
    }))
  }

  return {
    verifyMxRecords: verifyMxRecordsImpl,
    resolveDomainOrFail,
    resolveDomainOrFailWithPolicy,
    generateEmailCandidates,
    classifyApiError,
  }
}

const defaultPipeline = createEmailFinderPipeline()

export const verifyMxRecords = defaultPipeline.verifyMxRecords
export const resolveDomainOrFail = defaultPipeline.resolveDomainOrFail
export const resolveDomainOrFailWithPolicy = defaultPipeline.resolveDomainOrFailWithPolicy
export const generateEmailCandidates = defaultPipeline.generateEmailCandidates
