/**
 * ZeroBounce email verification helper.
 *
 * Server-side only — do not import in client components.
 * Never throws; returns UNKNOWN on any failure so callers can degrade gracefully.
 *
 * Cost: ~$0.0002 per check.
 * Timeout: 15s per request.
 */

export type ZeroBounceDeliverability = 'DELIVERABLE' | 'UNDELIVERABLE' | 'CATCHALL' | 'UNKNOWN'

export interface ZeroBounceResult {
  email: string
  deliverability: ZeroBounceDeliverability
  confidence: number
  source: 'zerobounce'
}

interface ZeroBounceApiResponse {
  status?: unknown
  sub_status?: unknown
  free_email?: unknown
  mx_found?: unknown
  smtp_provider?: unknown
}

function mapStatus(status: string): Pick<ZeroBounceResult, 'deliverability' | 'confidence'> {
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
    default:
      return { deliverability: 'UNKNOWN', confidence: 0.3 }
  }
}

/**
 * Verify a single email address via ZeroBounce SMTP check.
 *
 * Returns UNKNOWN (with confidence 0.3) when:
 * - ZEROBOUNCE_API_KEY is not set
 * - Network request fails or times out
 * - Response cannot be parsed
 */
export async function verifyEmailZeroBounce(email: string): Promise<ZeroBounceResult> {
  const unknown: ZeroBounceResult = {
    email,
    deliverability: 'UNKNOWN',
    confidence: 0.3,
    source: 'zerobounce',
  }

  const apiKey = process.env.ZEROBOUNCE_API_KEY?.trim()
  if (!apiKey) {
    return unknown
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    email: email.toLowerCase().trim(),
    ip_address: '',
  })

  let response: Response
  try {
    response = await fetch(`https://api.zerobounce.net/v2/validate?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
  } catch (err) {
    console.warn('[ZeroBounce] Network error for', email, err instanceof Error ? err.message : err)
    return unknown
  }

  if (!response.ok) {
    console.warn('[ZeroBounce] Non-OK response', response.status, 'for', email)
    return unknown
  }

  let payload: ZeroBounceApiResponse
  try {
    payload = (await response.json()) as ZeroBounceApiResponse
  } catch {
    console.warn('[ZeroBounce] Failed to parse response for', email)
    return unknown
  }

  const statusStr = typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : ''
  const mapped = mapStatus(statusStr)

  return {
    email,
    deliverability: mapped.deliverability,
    confidence: mapped.confidence,
    source: 'zerobounce',
  }
}
