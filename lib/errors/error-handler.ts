import { NextResponse } from 'next/server'

import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ExternalAPIError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/custom-errors'
import { captureApiException } from '@/lib/monitoring/sentry'

type ErrorContext = {
  route?: string
  method?: string
  userId?: string
  requestId?: string
  version?: string
  tags?: Record<string, unknown>
}

type SanitizedLogPayload = {
  name: string
  message: string
  stack?: string
  code?: string
  statusCode?: number
  metadata?: Record<string, unknown>
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error

  const message = getErrorMessage(error)

  if (message === 'Unauthorized' || /^auth(entication)?\s+(required|failed)/i.test(message)) {
    return new AuthenticationError('Authentication required', { cause: error })
  }

  if (/forbidden|not allowed|insufficient permissions?/i.test(message)) {
    return new AuthorizationError('Forbidden', { cause: error })
  }

  if (/rate limit|too many requests/i.test(message)) {
    return new RateLimitError('Too many requests', undefined, { cause: error })
  }

  if (/validation failed|invalid (json|payload|input|request)/i.test(message)) {
    return new ValidationError('Validation failed', { cause: error })
  }

  if (/supabase|database|sql|postgres|PGRST|42P01|PGRST202|42883/i.test(message)) {
    return new DatabaseError('Database operation failed', { cause: error })
  }

  if (/fetch failed|external api|provider|timeout|ETIMEDOUT|ECONNRESET/i.test(message)) {
    return new ExternalAPIError('External API request failed', undefined, { cause: error })
  }

  return new DatabaseError('Internal server error', { cause: error })
}

function sanitizeForClient(error: AppError): string {
  if (error.exposeMessage) {
    return error.message
  }

  if (error instanceof DatabaseError) {
    return 'Internal server error'
  }

  if (error instanceof ExternalAPIError) {
    return 'Upstream service temporarily unavailable'
  }

  return 'Internal server error'
}

function sanitizeForLogs(error: AppError): SanitizedLogPayload {
  const cause = (error as Error & { cause?: unknown }).cause
  const causeMessage =
    cause instanceof Error ? `${cause.name}: ${cause.message}` : cause ? String(cause) : undefined

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.errorCode,
    statusCode: error.statusCode,
    metadata: {
      ...(error.metadata || {}),
      ...(causeMessage ? { cause: causeMessage } : {}),
    },
  }
}

async function trackErrorInMonitoringService(error: AppError, context: ErrorContext) {
  const monitoringUrl = process.env.ERROR_MONITORING_WEBHOOK_URL?.trim()
  if (!monitoringUrl) return

  const body = {
    timestamp: new Date().toISOString(),
    severity: error.statusCode >= 500 ? 'error' : 'warning',
    error: sanitizeForLogs(error),
    context,
  }

  try {
    await fetch(monitoringUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch (monitoringError) {
    console.error('[ErrorHandler] Failed to report error to monitoring service', {
      monitoringError:
        monitoringError instanceof Error ? monitoringError.message : String(monitoringError),
    })
  }
}

/**
 * Sanitize api error payload.
 * @param {unknown} payload - Payload input.
 * @returns {unknown} Computed unknown.
 * @example
 * sanitizeApiErrorPayload({})
 */
export function sanitizeApiErrorPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload

  const asObj = payload as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(asObj)) {
    if (/details?|stack|trace|debug|internal/i.test(key)) continue
    sanitized[key] = value
  }

  return sanitized
}

/**
 * Handle api error.
 * @param {unknown} error - Error input.
 * @param {ErrorContext} context - Context input.
 * @returns {unknown} Computed unknown.
 * @throws {Error} If the operation fails.
 * @example
 * handleApiError({}, {})
 */
export async function handleApiError(error: unknown, context: ErrorContext = {}) {
  const appError = toAppError(error)
  const clientMessage = sanitizeForClient(appError)
  const version = context.version ?? '1'

  captureApiException(appError, {
    route: context.route,
    method: context.method,
    userId: context.userId,
    tags: {
      error_code: appError.errorCode,
      status_code: appError.statusCode,
    },
    extras: {
      requestId: context.requestId,
      tags: context.tags,
    },
  })

  console.error('[API Error]', {
    route: context.route || 'unknown',
    method: context.method || 'unknown',
    userId: context.userId || null,
    requestId: context.requestId || null,
    tags: context.tags || null,
    error: sanitizeForLogs(appError),
  })

  await trackErrorInMonitoringService(appError, context)

  const headers = new Headers({ 'X-API-Version': version })
  if (appError instanceof RateLimitError && typeof appError.retryAfterSeconds === 'number') {
    headers.set('Retry-After', String(Math.max(1, Math.trunc(appError.retryAfterSeconds))))
  }

  return NextResponse.json(
    {
      version,
      data: {
        success: false,
        error: clientMessage,
        code: appError.errorCode,
      },
      success: false,
      error: clientMessage,
      code: appError.errorCode,
    },
    {
      status: appError.statusCode,
      headers,
    }
  )
}
