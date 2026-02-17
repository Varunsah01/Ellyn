import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type RateLimitScope = 'ip' | 'user'

type RateLimitRule = {
  key: 'auth' | 'contacts' | 'leads' | 'generate-emails'
  scope: RateLimitScope
  limit: number
  window: `${number} ${'m' | 'h'}`
  windowMs: number
  matcher: RegExp
}

type RateLimitInput = {
  pathname: string
  ip: string
  userId?: string | null
}

export type RateLimitResult = {
  applied: boolean
  key: string | null
  scope: RateLimitScope | null
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter: number
  policy: string | null
}

type MemoryBucket = Map<string, number[]>

const RATE_LIMIT_RULES: RateLimitRule[] = [
  {
    key: 'auth',
    scope: 'ip',
    limit: 5,
    window: '15 m',
    windowMs: 15 * 60 * 1000,
    matcher: /^\/api(?:\/v\d+)?\/auth(?:\/|$)/i,
  },
  {
    key: 'contacts',
    scope: 'user',
    limit: 100,
    window: '1 h',
    windowMs: 60 * 60 * 1000,
    matcher: /^\/api(?:\/v\d+)?\/contacts(?:\/|$)/i,
  },
  {
    key: 'leads',
    scope: 'user',
    limit: 100,
    window: '1 h',
    windowMs: 60 * 60 * 1000,
    matcher: /^\/api(?:\/v\d+)?\/leads(?:\/|$)/i,
  },
  {
    key: 'generate-emails',
    scope: 'user',
    limit: 20,
    window: '1 h',
    windowMs: 60 * 60 * 1000,
    matcher: /^\/api(?:\/v\d+)?\/generate-emails(?:\/|$)/i,
  },
]

let redisClient: Redis | null | undefined
let ratelimiters: Map<RateLimitRule['key'], Ratelimit> | null | undefined

function getMemoryStore(): MemoryBucket {
  const globalStore = globalThis as typeof globalThis & {
    __ellynRateLimitStore?: MemoryBucket
  }

  if (!globalStore.__ellynRateLimitStore) {
    globalStore.__ellynRateLimitStore = new Map<string, number[]>()
  }

  return globalStore.__ellynRateLimitStore
}

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (!url || !token) {
    redisClient = null
    return redisClient
  }

  redisClient = new Redis({ url, token })
  return redisClient
}

function getUpstashLimiter(rule: RateLimitRule): Ratelimit | null {
  const redis = getRedisClient()
  if (!redis) return null

  if (!ratelimiters) {
    ratelimiters = new Map<RateLimitRule['key'], Ratelimit>()
  }

  const existing = ratelimiters.get(rule.key)
  if (existing) return existing

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
    prefix: `ellyn:ratelimit:${rule.key}`,
    analytics: true,
  })

  ratelimiters.set(rule.key, limiter)
  return limiter
}

function resolveRule(pathname: string): RateLimitRule | null {
  for (const rule of RATE_LIMIT_RULES) {
    if (rule.matcher.test(pathname)) {
      return rule
    }
  }
  return null
}

function resolveIdentifier(rule: RateLimitRule, input: RateLimitInput): string {
  const fallbackIp = input.ip || 'unknown'
  if (rule.scope === 'user') {
    if (input.userId && input.userId.trim().length > 0) {
      return `user:${input.userId.trim()}`
    }
    return `ip:${fallbackIp}`
  }
  return `ip:${fallbackIp}`
}

function resolvePolicy(rule: RateLimitRule): string {
  return `${rule.limit};w=${Math.floor(rule.windowMs / 1000)}`
}

function runMemoryRateLimit(rule: RateLimitRule, identifier: string): RateLimitResult {
  const store = getMemoryStore()
  const now = Date.now()
  const key = `${rule.key}:${identifier}`

  const existing = store.get(key) ?? []
  const fresh = existing.filter((timestamp) => now - timestamp < rule.windowMs)

  const allowed = fresh.length < rule.limit
  if (allowed) {
    fresh.push(now)
  }

  if (fresh.length === 0) {
    store.delete(key)
  } else {
    store.set(key, fresh)
  }

  const remaining = Math.max(0, rule.limit - fresh.length)
  const oldest = fresh[0] ?? now
  const resetMs = oldest + rule.windowMs
  const retryAfter = allowed ? 0 : Math.max(1, Math.ceil((resetMs - now) / 1000))

  return {
    applied: true,
    key: rule.key,
    scope: rule.scope,
    success: allowed,
    limit: rule.limit,
    remaining,
    reset: Math.ceil(resetMs / 1000),
    retryAfter,
    policy: resolvePolicy(rule),
  }
}

async function runUpstashRateLimit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(rule)
  if (!limiter) {
    return runMemoryRateLimit(rule, identifier)
  }

  const result = await limiter.limit(identifier)

  return {
    applied: true,
    key: rule.key,
    scope: rule.scope,
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: Math.ceil(result.reset / 1000),
    retryAfter: result.success ? 0 : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    policy: resolvePolicy(rule),
  }
}

/**
 * Check rate limit.
 * @param {RateLimitInput} input - Input input.
 * @returns {Promise<RateLimitResult>} Computed Promise<RateLimitResult>.
 * @throws {Error} If the operation fails.
 * @example
 * checkRateLimit({})
 */
export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const rule = resolveRule(input.pathname)
  if (!rule) {
    return {
      applied: false,
      key: null,
      scope: null,
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
      retryAfter: 0,
      policy: null,
    }
  }

  const identifier = resolveIdentifier(rule, input)

  try {
    return await runUpstashRateLimit(rule, identifier)
  } catch (error) {
    console.error('[RateLimit] Upstash failed, falling back to memory store:', {
      key: rule.key,
      error: error instanceof Error ? error.message : String(error),
    })
    return runMemoryRateLimit(rule, identifier)
  }
}
