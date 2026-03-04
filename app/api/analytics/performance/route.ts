import { NextRequest, NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/api/auth'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import {
  getPerformanceSnapshot,
  recordWebVitalMetric,
} from '@/lib/monitoring/performance'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

type WebVitalName = 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'

type IncomingWebVital = {
  name: WebVitalName
  id: string
  value: number
  delta: number
  rating: string
  path: string
}

const ALLOWED_WEB_VITALS = new Set<WebVitalName>(['CLS', 'FID', 'FCP', 'LCP', 'TTFB'])
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const dynamic = 'force-dynamic'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseWindowMs(raw: string | null): number | undefined {
  if (!raw) return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return undefined
  return Math.min(Math.floor(value), MAX_WINDOW_MS)
}

function parseWebVital(payload: unknown): IncomingWebVital | null {
  if (!isObject(payload)) return null

  const name = String(payload.name || '').trim().toUpperCase() as WebVitalName
  if (!ALLOWED_WEB_VITALS.has(name)) return null

  const id = String(payload.id || '').trim()
  const value = Number(payload.value)
  const delta = Number(payload.delta || 0)
  const rating = String(payload.rating || 'unknown').trim() || 'unknown'
  const path = String(payload.path || '/').trim() || '/'

  if (!Number.isFinite(value)) return null

  return {
    name,
    id,
    value,
    delta: Number.isFinite(delta) ? delta : 0,
    rating,
    path,
  }
}

function toMetricList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (isObject(payload) && Array.isArray(payload.metrics)) return payload.metrics
  return [payload]
}

/**
 * Handle POST requests for `/api/analytics/performance`.
 * Ingests Web Vitals metrics from browser sessions.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser()
    if (!auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = auth.user

    const rl = await checkApiRateLimit(`perf:${user.id}`, 60, 3600)
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const items = toMetricList(body)
    let accepted = 0

    for (const item of items) {
      const parsed = parseWebVital(item)
      if (!parsed) continue

      recordWebVitalMetric({
        name: parsed.name,
        id: parsed.id,
        value: parsed.value,
        delta: parsed.delta,
        rating: parsed.rating,
        path: parsed.path,
      })
      accepted += 1
    }

    if (accepted === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid web vitals metrics provided' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        accepted,
      },
      { status: 202 }
    )
  } catch (error) {
    console.error('[analytics/performance][POST] Internal error:', {
      message: error instanceof Error ? error.message : String(error),
    })
    captureApiException(error, { route: '/api/analytics/performance', method: 'POST' })
    return NextResponse.json(
      { success: false, error: 'Failed to ingest performance metrics' },
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests for `/api/analytics/performance`.
 * Returns a dashboard-ready performance snapshot.
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedUserFromRequest(request)

    const windowMs = parseWindowMs(request.nextUrl.searchParams.get('windowMs'))
    const snapshot = getPerformanceSnapshot(windowMs)

    return NextResponse.json({
      success: true,
      generatedAt: snapshot.generatedAt,
      data: snapshot,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[analytics/performance][GET] Internal error:', {
      message: error instanceof Error ? error.message : String(error),
    })
    captureApiException(error, { route: '/api/analytics/performance', method: 'GET' })
    return NextResponse.json(
      { success: false, error: 'Failed to load performance snapshot' },
      { status: 500 }
    )
  }
}
