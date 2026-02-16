export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterMs: number
}

type CounterState = {
  count: number
  resetAt: number
}

const hourlyCounters = new Map<string, CounterState>()
const monthlyCounters = new Map<string, CounterState>()

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Simple in-memory AI rate limiting. This is lightweight protection and
 * should be replaced with persistent storage (Redis/DB) for multi-instance deployments.
 */
export function checkAiRateLimit(identifier: string, hourlyLimit = 100, monthlyLimit = 500): RateLimitResult {
  const now = Date.now()

  const hourlyResult = incrementCounter(hourlyCounters, `${identifier}:hour`, now, hourlyLimit, HOUR_MS)
  if (!hourlyResult.allowed) {
    return hourlyResult
  }

  const daysUntilMonthReset = getDaysUntilMonthEnd()
  const monthlyWindowMs = Math.max(DAY_MS, daysUntilMonthReset * DAY_MS)
  const monthlyResult = incrementCounter(monthlyCounters, `${identifier}:month`, now, monthlyLimit, monthlyWindowMs)

  if (!monthlyResult.allowed) {
    return monthlyResult
  }

  return {
    allowed: true,
    remaining: Math.min(hourlyResult.remaining, monthlyResult.remaining),
    resetAt: Math.min(hourlyResult.resetAt, monthlyResult.resetAt),
    retryAfterMs: 0,
  }
}

/**
 * Best-effort caller identifier from headers.
 */
export function getRateLimitIdentifier(request: Request): string {
  const userId = request.headers.get('x-user-id')?.trim()
  if (userId) {
    return `user:${userId}`
  }

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim()
    if (ip) {
      return `ip:${ip}`
    }
  }

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) {
    return `ip:${realIp}`
  }

  return 'anonymous'
}

function incrementCounter(
  map: Map<string, CounterState>,
  key: string,
  now: number,
  limit: number,
  windowMs: number
): RateLimitResult {
  const existing = map.get(key)

  if (!existing || now >= existing.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs })

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: now + windowMs,
      retryAfterMs: 0,
    }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    }
  }

  const next = {
    count: existing.count + 1,
    resetAt: existing.resetAt,
  }

  map.set(key, next)

  return {
    allowed: true,
    remaining: Math.max(0, limit - next.count),
    resetAt: next.resetAt,
    retryAfterMs: 0,
  }
}

function getDaysUntilMonthEnd(): number {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const end = Date.UTC(year, month + 1, 1, 0, 0, 0, 0)
  const diff = end - now.getTime()
  return Math.max(1, Math.ceil(diff / DAY_MS))
}
