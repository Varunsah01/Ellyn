import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

import { isMissingDbObjectError, roundTo, sanitizeErrorForLog } from '../_helpers'

type TrackLookupBody = {
  profileUrl?: string
  domain: string
  email: string
  pattern: string
  confidence?: number
  source: string
  cacheHit?: boolean
  cost?: number
  duration?: number
  success?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const body = await parseBody(request)

    const domain = normalizeDomain(body.domain)
    const email = normalizeEmail(body.email)
    const pattern = normalizeText(body.pattern)
    const source = normalizeText(body.source)
    const profileUrl = normalizeOptionalText(body.profileUrl)

    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'Invalid domain' },
        { status: 400 }
      )
    }

    if (!email || !isLikelyEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email' },
        { status: 400 }
      )
    }

    if (!pattern) {
      return NextResponse.json(
        { success: false, error: 'Invalid pattern' },
        { status: 400 }
      )
    }

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Invalid source' },
        { status: 400 }
      )
    }

    const confidence = toConfidence(body.confidence)
    const costUsd = roundTo(Math.max(0, Number(body.cost || 0)), 6)
    const durationMs = toDuration(body.duration)
    const success = body.success !== false
    const cacheHit = body.cacheHit === true

    const serviceClient = await createServiceRoleClient()
    const { data, error } = await serviceClient
      .from('email_lookups')
      .insert({
        user_id: user.id,
        profile_url: profileUrl,
        domain,
        email,
        pattern,
        confidence,
        source,
        cache_hit: cacheHit,
        cost_usd: costUsd,
        duration_ms: durationMs,
        success,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('[analytics/track-lookup] Insert failed:', {
        code: error.code,
        message: error.message,
      })
      return NextResponse.json(
        { success: false, error: 'Failed to track lookup' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data?.id || null,
        createdAt: data?.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Invalid JSON body') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }
    if (isMissingDbObjectError(error)) {
      return NextResponse.json(
        { success: false, error: 'Analytics schema is missing. Run migration 004_analytics_tracking.sql.' },
        { status: 503 }
      )
    }

    console.error('[analytics/track-lookup] Internal error:', sanitizeErrorForLog(error))
    return NextResponse.json(
      { success: false, error: 'Failed to track lookup' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

async function parseBody(request: NextRequest): Promise<TrackLookupBody> {
  try {
    const body = (await request.json()) as Partial<TrackLookupBody>
    return {
      profileUrl: typeof body.profileUrl === 'string' ? body.profileUrl : '',
      domain: typeof body.domain === 'string' ? body.domain : '',
      email: typeof body.email === 'string' ? body.email : '',
      pattern: typeof body.pattern === 'string' ? body.pattern : '',
      confidence: toFiniteNumber(body.confidence),
      source: typeof body.source === 'string' ? body.source : '',
      cacheHit: body.cacheHit === true,
      cost: toFiniteNumber(body.cost),
      duration: toFiniteNumber(body.duration),
      success: body.success !== false,
    }
  } catch {
    throw new Error('Invalid JSON body')
  }
}

function normalizeDomain(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
}

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase()
}

function normalizeText(value: string): string {
  return String(value || '').trim()
}

function normalizeOptionalText(value: string | undefined): string | null {
  const normalized = String(value || '').trim()
  return normalized.length > 0 ? normalized : null
}

function toFiniteNumber(value: unknown): number | undefined {
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function toConfidence(value: number | undefined): number | null {
  if (!Number.isFinite(value)) return null
  return roundTo(Math.max(0, Math.min(1, Number(value))), 2)
}

function toDuration(value: number | undefined): number | null {
  if (!Number.isFinite(value)) return null
  const normalized = Math.max(0, Math.round(Number(value)))
  return Number.isFinite(normalized) ? normalized : null
}

function isLikelyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
