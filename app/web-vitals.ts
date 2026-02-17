import type { NextWebVitalsMetric } from 'next/app'

type TrackedWebVitalName = 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'

export type WebVitalMetricPayload = {
  name: TrackedWebVitalName
  id: string
  value: number
  delta: number
  rating: string
  path: string
  timestamp: number
}

type ExtendedWebVitalsMetric = NextWebVitalsMetric & {
  delta?: number
  rating?: string
}

const TRACKED_WEB_VITALS = new Set<TrackedWebVitalName>(['CLS', 'FID', 'FCP', 'LCP', 'TTFB'])
const PERFORMANCE_METRICS_ENDPOINT = '/api/analytics/performance'
const CSRF_COOKIE_NAME = 'csrf_token'

function getCsrfTokenFromCookies(): string {
  if (typeof document === 'undefined') return ''

  const tokens = document.cookie.split(';')
  for (const token of tokens) {
    const [key, ...rest] = token.trim().split('=')
    if (key !== CSRF_COOKIE_NAME) continue
    return decodeURIComponent(rest.join('=') || '')
  }

  return ''
}

function getCurrentPath(): string {
  if (typeof window === 'undefined' || !window.location) {
    return '/'
  }

  const { pathname, search } = window.location
  return `${pathname}${search || ''}`
}

function toPayload(metric: NextWebVitalsMetric): WebVitalMetricPayload | null {
  const metricWithExtras = metric as ExtendedWebVitalsMetric
  const name = String(metric.name || '') as TrackedWebVitalName
  if (!TRACKED_WEB_VITALS.has(name)) {
    return null
  }

  return {
    name,
    id: String(metric.id || ''),
    value: Number(metric.value || 0),
    delta: Number(metricWithExtras.delta || 0),
    rating: String(metricWithExtras.rating || 'unknown'),
    path: getCurrentPath(),
    timestamp: Date.now(),
  }
}

export async function sendWebVitalMetric(payload: WebVitalMetricPayload): Promise<void> {
  const csrfToken = getCsrfTokenFromCookies()
  const requestPayload = csrfToken
    ? {
        ...payload,
        _csrf: csrfToken,
      }
    : payload
  const body = JSON.stringify(requestPayload)

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    const sent = navigator.sendBeacon(PERFORMANCE_METRICS_ENDPOINT, blob)
    if (sent) return
  }

  await fetch(PERFORMANCE_METRICS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    keepalive: true,
  })
}

/**
 * Normalize and forward supported Web Vitals to server-side analytics.
 */
export function trackWebVital(metric: NextWebVitalsMetric): void {
  const payload = toPayload(metric)
  if (!payload) return

  void sendWebVitalMetric(payload).catch((error: unknown) => {
    console.warn('[WebVitals] Failed to send metric', {
      name: payload.name,
      path: payload.path,
      error: error instanceof Error ? error.message : String(error),
    })
  })
}
