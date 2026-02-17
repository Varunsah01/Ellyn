import type { Event } from '@sentry/nextjs'

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|set-cookie|x-api-key|apikey|token|secret|password|passwd|session|jwt|bearer/i

const MAX_SANITIZE_DEPTH = 4

/**
 * Resolves Sentry environment from deployment/runtime variables.
 */
export function getSentryEnvironment(): string {
  return (
    process.env.SENTRY_ENVIRONMENT?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV?.trim() ||
    'development'
  )
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null || depth >= MAX_SANITIZE_DEPTH) return value

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1))
  }

  if (typeof value !== 'object') {
    return value
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, innerValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[redacted]'
      continue
    }
    sanitized[key] = sanitizeValue(innerValue, depth + 1)
  }

  return sanitized
}

function sanitizeHeaders(
  headers: Record<string, string> | Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!headers) return headers

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(headers)) {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : value
  }
  return sanitized
}

/**
 * Scrubs likely sensitive fields from Sentry events before upload.
 */
export function sanitizeSentryEvent<TEvent extends Event>(event: TEvent): TEvent {
  const sanitized = { ...event }

  if (sanitized.user) {
    sanitized.user = {
      ...sanitized.user,
      email: undefined,
      ip_address: undefined,
      username: undefined,
      name: undefined,
    }
  }

  if (sanitized.request) {
    sanitized.request = {
      ...sanitized.request,
      headers: sanitizeHeaders(sanitized.request.headers as Record<string, unknown> | undefined) as
        | Record<string, string>
        | undefined,
      cookies: undefined,
      data: sanitizeValue(sanitized.request.data),
      query_string: undefined,
    }
  }

  if (sanitized.extra) {
    sanitized.extra = sanitizeValue(sanitized.extra) as Record<string, unknown>
  }

  if (sanitized.contexts) {
    sanitized.contexts = sanitizeValue(sanitized.contexts) as Event['contexts']
  }

  return sanitized as TEvent
}
