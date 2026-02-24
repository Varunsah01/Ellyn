import { NextRequest, NextResponse } from 'next/server'

import type { SmtpProbeResult } from '@/lib/email-finder/smtp-types'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createClient as createServerClient } from '@/lib/supabase/server'

export type { SmtpDeliverability, SmtpProbeResult } from '@/lib/email-finder/smtp-types'

function buildUnknownResult(email: string, reason: string): SmtpProbeResult {
  return {
    email,
    deliverability: 'UNKNOWN',
    reason,
    skipped: true,
  }
}

function isBridgeTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'TimeoutError' || error.name === 'AbortError'
  }

  if (error instanceof Error) {
    return error.name === 'TimeoutError' || error.name === 'AbortError'
  }

  return false
}

function toNormalizedEmail(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const raw = (body as { email?: unknown }).email
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

export async function POST(request: NextRequest) {
  let email = ''

  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown = null
    try {
      body = await request.json()
    } catch {
      body = null
    }

    email = toNormalizedEmail(body)
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const serviceUrl = process.env.SMTP_PROBE_SERVICE_URL?.trim() || ''
    const serviceSecret = process.env.SMTP_PROBE_SECRET?.trim() || ''

    if (!serviceUrl || !serviceSecret) {
      return NextResponse.json(
        buildUnknownResult(email, 'smtp_service_not_configured'),
        { status: 200 }
      )
    }

    const endpoint = `${serviceUrl.replace(/\/+$/, '')}/probe`
    let probeResponse: Response

    try {
      probeResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email,
          secret: serviceSecret,
        }),
        signal: AbortSignal.timeout(13000),
        cache: 'no-store',
      })
    } catch (error) {
      if (isBridgeTimeoutError(error)) {
        return NextResponse.json(buildUnknownResult(email, 'bridge_timeout'), {
          status: 200,
        })
      }

      console.warn('[smtp-probe] bridge error:', error)
      if (typeof captureApiException === 'function') {
        captureApiException(error, { route: '/api/v1/smtp-probe', method: 'POST' })
      }

      return NextResponse.json(buildUnknownResult(email, 'bridge_exception'), {
        status: 200,
      })
    }

    if (!probeResponse.ok) {
      return NextResponse.json(
        buildUnknownResult(email, `service_error_${probeResponse.status}`),
        { status: 200 }
      )
    }

    try {
      const result = (await probeResponse.json()) as SmtpProbeResult
      return NextResponse.json(result, { status: 200 })
    } catch (error) {
      console.warn('[smtp-probe] bridge error:', error)
      if (typeof captureApiException === 'function') {
        captureApiException(error, { route: '/api/v1/smtp-probe', method: 'POST' })
      }
      return NextResponse.json(buildUnknownResult(email, 'bridge_exception'), {
        status: 200,
      })
    }
  } catch (error) {
    if (isBridgeTimeoutError(error)) {
      return NextResponse.json(buildUnknownResult(email, 'bridge_timeout'), {
        status: 200,
      })
    }

    console.warn('[smtp-probe] bridge error:', error)
    if (typeof captureApiException === 'function') {
      captureApiException(error, { route: '/api/v1/smtp-probe', method: 'POST' })
    }
    return NextResponse.json(buildUnknownResult(email, 'bridge_exception'), {
      status: 200,
    })
  }
}

export async function GET() {
  const serviceUrl = process.env.SMTP_PROBE_SERVICE_URL?.trim() || ''
  return NextResponse.json({ ok: true, smtpConfigured: !!serviceUrl && !!process.env.SMTP_PROBE_SECRET })
}
