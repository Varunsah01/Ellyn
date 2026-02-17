import { NextRequest, NextResponse } from 'next/server'

import { checkRateLimit, type RateLimitResult } from '@/lib/rate-limit'

export type RateLimitMiddlewareResult = {
  response: NextResponse | null
  headers: Headers
  result: RateLimitResult
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}

function extractBearerToken(headers: Headers): string | null {
  const raw = headers.get('authorization')
  if (!raw) return null

  const match = raw.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return null

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

function parseJwtSubject(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payloadPart = parts[1]
    if (!payloadPart) return null

    const payload = payloadPart
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payloadPart.length / 4) * 4, '=')

    const decoded = JSON.parse(atob(payload)) as { sub?: unknown }
    return typeof decoded.sub === 'string' && decoded.sub.trim().length > 0
      ? decoded.sub.trim()
      : null
  } catch {
    return null
  }
}

export function extractUserIdFromRequest(request: NextRequest): string | null {
  const token = extractBearerToken(request.headers)
  if (!token) return null
  return parseJwtSubject(token)
}

function buildRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers()
  if (!result.applied) return headers

  headers.set('X-RateLimit-Limit', String(result.limit))
  headers.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining)))
  headers.set('X-RateLimit-Reset', String(result.reset))

  if (result.policy) {
    headers.set('X-RateLimit-Policy', result.policy)
  }

  if (!result.success && result.retryAfter > 0) {
    headers.set('Retry-After', String(result.retryAfter))
  }

  return headers
}

export function applyRateLimitHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => {
    response.headers.set(key, value)
  })
}

export async function enforceRateLimit(
  request: NextRequest,
  options?: { userId?: string | null }
): Promise<RateLimitMiddlewareResult> {
  const resolvedUserId = options?.userId ?? extractUserIdFromRequest(request)
  const result = await checkRateLimit({
    pathname: request.nextUrl.pathname,
    userId: resolvedUserId,
    ip: getClientIp(request),
  })

  const headers = buildRateLimitHeaders(result)

  if (!result.applied || result.success) {
    return {
      response: null,
      headers,
      result,
    }
  }

  const response = NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    },
    { status: 429 }
  )

  applyRateLimitHeaders(response, headers)

  return {
    response,
    headers,
    result,
  }
}
