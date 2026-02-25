import { NextRequest, NextResponse } from 'next/server'

import { createClient as createServerClient } from '@/lib/supabase/server'

type Deliverability = 'DELIVERABLE' | 'UNDELIVERABLE' | 'CATCHALL' | 'UNKNOWN'

type ZeroBounceValidateResponse = {
  status?: unknown
  sub_status?: unknown
  free_email?: unknown
  mx_found?: unknown
  smtp_provider?: unknown
}

type VerificationResponse = {
  email: string
  deliverability: Deliverability
  confidence: number
  subStatus: string
  freeEmail: boolean
  mxFound: boolean
  smtpProvider: string | null
  source: 'zerobounce'
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toNormalizedEmail(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const raw = (body as { email?: unknown }).email
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  return false
}

function mapStatus(status: string): Pick<VerificationResponse, 'deliverability' | 'confidence'> {
  switch (status) {
    case 'valid':
      return { deliverability: 'DELIVERABLE', confidence: 0.95 }
    case 'invalid':
      return { deliverability: 'UNDELIVERABLE', confidence: 0.05 }
    case 'catch-all':
      return { deliverability: 'CATCHALL', confidence: 0.55 }
    case 'spamtrap':
    case 'abuse':
    case 'do_not_mail':
      return { deliverability: 'UNDELIVERABLE', confidence: 0.02 }
    case 'unknown':
      return { deliverability: 'UNKNOWN', confidence: 0.3 }
    default:
      return { deliverability: 'UNKNOWN', confidence: 0.3 }
  }
}

function buildUnknownApiError(email: string) {
  return {
    email,
    deliverability: 'UNKNOWN' as const,
    reason: 'api_error' as const,
    source: 'zerobounce' as const,
  }
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
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const apiKey = process.env.ZEROBOUNCE_API_KEY?.trim() || ''
    if (!apiKey) {
      return NextResponse.json(
        {
          deliverability: 'UNKNOWN',
          reason: 'not_configured',
          source: 'zerobounce',
        },
        { status: 200 }
      )
    }

    const params = new URLSearchParams({
      api_key: apiKey,
      email,
      ip_address: '',
    })

    let zbResponse: Response
    try {
      zbResponse = await fetch(`https://api.zerobounce.net/v2/validate?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      })
    } catch {
      return NextResponse.json(buildUnknownApiError(email), { status: 200 })
    }

    if (!zbResponse.ok) {
      return NextResponse.json(buildUnknownApiError(email), { status: 200 })
    }

    let payload: ZeroBounceValidateResponse
    try {
      payload = (await zbResponse.json()) as ZeroBounceValidateResponse
    } catch {
      return NextResponse.json(buildUnknownApiError(email), { status: 200 })
    }

    const mapped = mapStatus(toString(payload.status).trim().toLowerCase())
    const smtpProviderRaw = toString(payload.smtp_provider).trim()

    const result: VerificationResponse = {
      email,
      deliverability: mapped.deliverability,
      confidence: mapped.confidence,
      subStatus: toString(payload.sub_status),
      freeEmail: toBoolean(payload.free_email),
      mxFound: toBoolean(payload.mx_found),
      smtpProvider: smtpProviderRaw || null,
      source: 'zerobounce',
    }

    return NextResponse.json(result, { status: 200 })
  } catch {
    return NextResponse.json(buildUnknownApiError(email), { status: 200 })
  }
}
