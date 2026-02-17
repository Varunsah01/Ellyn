import * as Sentry from '@sentry/nextjs'
import { monitorApiRoute } from '@/lib/monitoring/performance'

type Primitive = string | number | boolean

type MonitoringContext = {
  route?: string
  method?: string
  userId?: string | null
  tags?: Record<string, Primitive>
  extras?: Record<string, unknown>
}

function resolveApiRouteContext(
  name: string,
  attributes: Record<string, Primitive>
): { route: string; method: string } {
  const routeFromAttributes = typeof attributes['api.route'] === 'string'
    ? String(attributes['api.route']).trim()
    : ''
  const methodFromAttributes = typeof attributes['api.method'] === 'string'
    ? String(attributes['api.method']).trim().toUpperCase()
    : ''

  const match = String(name || '')
    .trim()
    .match(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(.+)$/i)

  const method = methodFromAttributes || (match?.[1] ? String(match[1]).toUpperCase() : 'GET')
  const route = routeFromAttributes || (match?.[2] ? String(match[2]).trim() : '')

  return {
    route: route || '/api/unknown',
    method: method || 'GET',
  }
}

/**
 * Captures an exception with sanitized route/user metadata.
 */
export function captureApiException(error: unknown, context: MonitoringContext = {}): string {
  const normalizedError = error instanceof Error ? error : new Error(String(error))

  return Sentry.withScope((scope) => {
    if (context.route) scope.setTag('route', context.route)
    if (context.method) scope.setTag('method', context.method.toUpperCase())
    if (context.userId) scope.setUser({ id: context.userId })
    if (context.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, String(value))
      }
    }
    if (context.extras) {
      for (const [key, value] of Object.entries(context.extras)) {
        scope.setExtra(key, value)
      }
    }

    return Sentry.captureException(normalizedError)
  })
}

/**
 * Wraps API operations in a tracing span for latency visibility.
 */
export function withApiRouteSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes: Record<string, Primitive> = {}
): Promise<T> {
  const context = resolveApiRouteContext(name, attributes)
  return monitorApiRoute(context.route, context.method, () =>
    Sentry.startSpan(
      {
        op: 'http.server',
        name,
        attributes,
      },
      fn
    )
  )
}

/**
 * Emits a warning breadcrumb/event when a route crosses a latency threshold.
 */
export function captureSlowApiRoute(
  route: string,
  durationMs: number,
  options: { thresholdMs?: number; method?: string } = {}
): void {
  const thresholdMs = options.thresholdMs ?? 1500
  if (durationMs < thresholdMs) return

  Sentry.withScope((scope) => {
    scope.setLevel('warning')
    scope.setTag('route', route)
    if (options.method) scope.setTag('method', options.method.toUpperCase())
    scope.setExtra('duration_ms', durationMs)
    scope.setExtra('threshold_ms', thresholdMs)
    Sentry.captureMessage(`Slow API route detected: ${route}`)
  })
}
