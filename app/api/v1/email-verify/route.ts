import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import {
  requestAbstractValidation,
  type EmailValidationDeliverability,
} from '@/lib/abstract-email-validation'

type Deliverability = EmailValidationDeliverability

type VerificationResponse = {
  email: string
  deliverability: Deliverability
  confidence: number
  qualityScore: number
  subStatus: string
  freeEmail: boolean
  mxFound: boolean
  smtpProvider: null
  autocorrect: string | null
  isValidFormat: boolean
  isDisposable: boolean
  isRoleEmail: boolean
  isCatchall: boolean | null
  smtpValid: boolean | null
  source: 'abstract'
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

function extractErrorMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const nestedError = (value as { error?: unknown }).error
  const errors = Array.isArray((value as { errors?: unknown }).errors)
    ? ((value as { errors?: unknown[] }).errors ?? [])
    : []

  return (
    toString((value as { message?: unknown }).message) ||
    extractErrorMessage(nestedError) ||
    extractErrorMessage(errors[0]) ||
    toString((value as { detail?: unknown }).detail)
  ).trim()
}

function buildUnknownApiError(email: string) {
  return {
    email,
    deliverability: 'UNKNOWN' as const,
    reason: 'api_error' as const,
    source: 'abstract' as const,
  }
}

function buildUpstreamApiError(
  email: string,
  upstreamStatus: number,
  upstreamPayload: unknown
): {
  email: string
  deliverability: 'UNKNOWN'
  reason: string
  source: 'abstract'
  upstreamStatus: number
  upstreamCode: string
} {
  const upstreamCode = extractErrorMessage(upstreamPayload).trim()
  const normalizedCode = upstreamCode.toLowerCase()

  let reason = 'api_error'
  if (
    normalizedCode.includes('api key') ||
    normalizedCode.includes('invalid key') ||
    normalizedCode.includes('key not found') ||
    normalizedCode.includes('missing key')
  ) {
    reason = 'invalid_api_key'
  } else if (upstreamStatus === 429 || normalizedCode.includes('rate')) {
    reason = 'rate_limited'
  } else if ([401, 402, 403].includes(upstreamStatus)) {
    reason = 'upstream_auth_error'
  } else if (upstreamStatus >= 500) {
    reason = 'upstream_unavailable'
  }

  return {
    email,
    deliverability: 'UNKNOWN',
    reason,
    source: 'abstract',
    upstreamStatus,
    upstreamCode,
  }
}

export async function POST(request: NextRequest) {
  let email = ''

  try {
    try {
      await getAuthenticatedUserFromRequest(request)
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
      } else {
        throw error
      }
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

    const validation = await requestAbstractValidation(email)

    if (!validation.ok) {
      if (validation.reason === 'not_configured') {
        return NextResponse.json(
          {
            deliverability: 'UNKNOWN',
            reason: 'not_configured',
            source: 'abstract',
          },
          { status: 200 }
        )
      }

      if (validation.reason === 'network_error') {
        return NextResponse.json(
          {
            ...buildUnknownApiError(email),
            reason: 'network_error',
          },
          { status: 200 }
        )
      }

      if (validation.reason === 'upstream_error') {
        return NextResponse.json(
          buildUpstreamApiError(
            email,
            validation.upstreamStatus ?? 0,
            validation.upstreamPayload
          ),
          { status: 200 }
        )
      }

      return NextResponse.json(buildUnknownApiError(email), { status: 200 })
    }

    const result = validation.result

    const response: VerificationResponse = {
      email,
      deliverability: result.deliverability,
      confidence: result.confidence,
      qualityScore: result.qualityScore,
      subStatus: result.isCatchall === true ? 'catch-all' : '',
      freeEmail: result.isFreeEmail,
      mxFound: result.isMxFound === true,
      smtpProvider: null,
      autocorrect: result.autocorrect,
      isValidFormat: result.isValidFormat,
      isDisposable: result.isDisposable,
      isRoleEmail: result.isRoleEmail,
      isCatchall: result.isCatchall,
      smtpValid: result.isSmtpValid,
      source: 'abstract',
    }

    return NextResponse.json(response, { status: 200 })
  } catch {
    return NextResponse.json(buildUnknownApiError(email), { status: 200 })
  }
}
