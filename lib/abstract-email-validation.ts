/**
 * Abstract API email validation helper.
 *
 * Server-side only - do not import in client components.
 * Never throws; returns UNKNOWN on any failure so callers can degrade gracefully.
 */

export type EmailValidationDeliverability = 'DELIVERABLE' | 'UNDELIVERABLE' | 'CATCHALL' | 'UNKNOWN'

type AbstractBooleanField = {
  value?: unknown
  text?: unknown
}

type AbstractValidationApiResponse = {
  email?: unknown
  autocorrect?: unknown
  deliverability?: unknown
  quality_score?: unknown
  is_valid_format?: unknown
  is_free_email?: unknown
  is_disposable_email?: unknown
  is_role_email?: unknown
  is_catchall_email?: unknown
  is_mx_found?: unknown
  is_smtp_valid?: unknown
  error?: unknown
  message?: unknown
}

export interface AbstractValidationResult {
  email: string
  isValid: boolean
  isDisposable: boolean
  isFreeEmail: boolean
  isRoleEmail: boolean
  isValidFormat: boolean
  isCatchall: boolean | null
  isMxFound: boolean | null
  isSmtpValid: boolean | null
  deliverability: EmailValidationDeliverability
  qualityScore: number
  confidence: number
  confidenceBoost: number
  autocorrect: string | null
  source: 'abstract'
}

export type AbstractValidationRequestResult =
  | {
      ok: true
      payload: AbstractValidationApiResponse
      result: AbstractValidationResult
    }
  | {
      ok: false
      reason: 'not_configured' | 'network_error' | 'upstream_error' | 'parse_error'
      result: AbstractValidationResult
      upstreamStatus?: number
      upstreamPayload?: unknown
    }

function toString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toBooleanField(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }

  if (value && typeof value === 'object') {
    return toBooleanField((value as AbstractBooleanField).value)
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    if (normalized === 'unknown' || normalized === 'null' || normalized === '') return null
  }

  return null
}

function toQualityScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value > 1 ? value / 100 : value))
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed))
    }
  }

  return null
}

function toConfidenceBoost(deliverability: EmailValidationDeliverability): number {
  switch (deliverability) {
    case 'DELIVERABLE':
      return 0.25
    case 'CATCHALL':
      return 0.08
    default:
      return 0
  }
}

function mapDeliverability(params: {
  deliverability: unknown
  isValidFormat: boolean
  isCatchall: boolean | null
  isMxFound: boolean | null
  isSmtpValid: boolean | null
  qualityScore: number
}): Pick<AbstractValidationResult, 'deliverability' | 'confidence'> {
  const deliverability = toString(params.deliverability).trim().toLowerCase()

  if (params.isSmtpValid === true || deliverability === 'deliverable') {
    return {
      deliverability: 'DELIVERABLE',
      confidence: Math.max(params.qualityScore, 0.95),
    }
  }

  if (
    params.isValidFormat === false ||
    params.isMxFound === false ||
    params.isSmtpValid === false ||
    deliverability === 'undeliverable'
  ) {
    return {
      deliverability: 'UNDELIVERABLE',
      confidence: Math.min(params.qualityScore || 0.05, 0.15),
    }
  }

  if (params.isCatchall === true || deliverability === 'risky') {
    return {
      deliverability: 'CATCHALL',
      confidence: Math.max(params.qualityScore, 0.55),
    }
  }

  return {
    deliverability: 'UNKNOWN',
    confidence: params.qualityScore || 0.3,
  }
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

function buildUnknownResult(email: string): AbstractValidationResult {
  const normalizedEmail = normalizeEmail(email)

  return {
    email: normalizedEmail,
    isValid: false,
    isDisposable: false,
    isFreeEmail: false,
    isRoleEmail: false,
    isValidFormat: false,
    isCatchall: null,
    isMxFound: null,
    isSmtpValid: null,
    deliverability: 'UNKNOWN',
    qualityScore: 0,
    confidence: 0.3,
    confidenceBoost: 0,
    autocorrect: null,
    source: 'abstract',
  }
}

function hasValidationPayload(payload: AbstractValidationApiResponse): boolean {
  return (
    payload.deliverability !== undefined ||
    payload.quality_score !== undefined ||
    payload.is_valid_format !== undefined ||
    payload.is_smtp_valid !== undefined
  )
}

function getPayloadErrorText(payload: AbstractValidationApiResponse): string {
  const directError = payload.error

  if (typeof directError === 'string') {
    return directError.trim()
  }

  if (directError && typeof directError === 'object') {
    const message =
      toString((directError as { message?: unknown }).message) ||
      toString((directError as { error?: unknown }).error) ||
      toString((directError as { detail?: unknown }).detail)

    if (message) {
      return message.trim()
    }
  }

  return toString(payload.message).trim()
}

function mapPayload(email: string, payload: AbstractValidationApiResponse): AbstractValidationResult {
  const normalizedEmail = normalizeEmail(toString(payload.email) || email)
  const qualityScore = toQualityScore(payload.quality_score) ?? 0
  const isValidFormat = toBooleanField(payload.is_valid_format) !== false
  const isCatchall = toBooleanField(payload.is_catchall_email)
  const isMxFound = toBooleanField(payload.is_mx_found)
  const isSmtpValid = toBooleanField(payload.is_smtp_valid)
  const mapped = mapDeliverability({
    deliverability: payload.deliverability,
    isValidFormat,
    isCatchall,
    isMxFound,
    isSmtpValid,
    qualityScore,
  })

  return {
    email: normalizedEmail,
    isValid: mapped.deliverability === 'DELIVERABLE',
    isDisposable: toBooleanField(payload.is_disposable_email) === true,
    isFreeEmail: toBooleanField(payload.is_free_email) === true,
    isRoleEmail: toBooleanField(payload.is_role_email) === true,
    isValidFormat,
    isCatchall,
    isMxFound,
    isSmtpValid,
    deliverability: mapped.deliverability,
    qualityScore,
    confidence: Math.max(0, Math.min(1, mapped.confidence)),
    confidenceBoost: toConfidenceBoost(mapped.deliverability),
    autocorrect: toString(payload.autocorrect).trim() || null,
    source: 'abstract',
  }
}

export async function requestAbstractValidation(email: string): Promise<AbstractValidationRequestResult> {
  const normalizedEmail = normalizeEmail(email)
  const unknown = buildUnknownResult(normalizedEmail)
  const apiKey = process.env.ABSTRACT_EMAIL_VALIDATION_API_KEY?.trim()

  if (!apiKey) {
    return {
      ok: false,
      reason: 'not_configured',
      result: unknown,
    }
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    email: normalizedEmail,
  })

  let response: Response
  try {
    response = await fetch(`https://emailvalidation.abstractapi.com/v1/?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
  } catch (error) {
    console.warn('[Abstract Email Validation] Network error for', normalizedEmail, error instanceof Error ? error.message : error)
    return {
      ok: false,
      reason: 'network_error',
      result: unknown,
    }
  }

  if (!response.ok) {
    let upstreamPayload: unknown = null
    try {
      upstreamPayload = await response.json()
    } catch {
      upstreamPayload = null
    }

    return {
      ok: false,
      reason: 'upstream_error',
      result: unknown,
      upstreamStatus: response.status,
      upstreamPayload,
    }
  }

  let payload: AbstractValidationApiResponse
  try {
    payload = (await response.json()) as AbstractValidationApiResponse
  } catch {
    console.warn('[Abstract Email Validation] Failed to parse response for', normalizedEmail)
    return {
      ok: false,
      reason: 'parse_error',
      result: unknown,
    }
  }

  if (getPayloadErrorText(payload) && !hasValidationPayload(payload)) {
    return {
      ok: false,
      reason: 'upstream_error',
      result: unknown,
      upstreamStatus: response.status,
      upstreamPayload: payload,
    }
  }

  return {
    ok: true,
    payload,
    result: mapPayload(normalizedEmail, payload),
  }
}

export async function validateEmailAbstract(email: string): Promise<AbstractValidationResult> {
  const result = await requestAbstractValidation(email)
  return result.result
}

export async function verifyEmailAbstract(email: string): Promise<AbstractValidationResult> {
  return validateEmailAbstract(email)
}

export async function batchValidateEmails(
  emails: string[],
  maxConcurrent: number = 3
): Promise<Map<string, AbstractValidationResult>> {
  const uniqueEmails = Array.from(
    new Set(emails.map((email) => normalizeEmail(email)).filter(Boolean))
  )
  const results = new Map<string, AbstractValidationResult>()

  if (uniqueEmails.length === 0) {
    return results
  }

  const workerCount = Math.max(1, Math.min(maxConcurrent, uniqueEmails.length))
  let index = 0

  const worker = async () => {
    while (index < uniqueEmails.length) {
      const currentIndex = index
      index += 1
      const email = uniqueEmails[currentIndex]
      if (!email) continue
      results.set(email, await validateEmailAbstract(email))
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return results
}
