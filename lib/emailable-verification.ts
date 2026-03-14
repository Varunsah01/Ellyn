import { buildCacheKey, getOrSet, normalizeCacheToken } from '@/lib/cache/redis'
import { ExternalAPIError } from '@/lib/errors/custom-errors'
import { captureApiException } from '@/lib/monitoring/sentry'

export interface EmailableResponse {
  email: string
  user: string
  domain: string
  format_valid: boolean
  mx_found: boolean
  smtp_checkable: boolean
  state: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
  reason: string
  score: number
  deliverability: 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN'
}

const EMAILABLE_CACHE_TTL = 7 * 24 * 60 * 60 // 7 days

/**
 * Verify an email address using the Emailable API.
 * 
 * Maps Emailable states to Ellyn deliverability labels:
 * - deliverable -> DELIVERABLE
 * - undeliverable -> UNDELIVERABLE
 * - risky -> RISKY
 * - unknown -> UNKNOWN
 * 
 * Results are cached for 7 days in Redis.
 */
export async function verifyEmailEmailable(email: string): Promise<EmailableResponse> {
  const apiKey = process.env.EMAILABLE_API_KEY?.trim()
  
  if (!apiKey) {
    console.warn('[Emailable] API key missing, returning UNKNOWN for', email)
    return {
      email,
      user: email.split('@')[0] || '',
      domain: email.split('@')[1] || '',
      format_valid: true,
      mx_found: true,
      smtp_checkable: false,
      state: 'unknown',
      reason: 'api_key_missing',
      score: 0,
      deliverability: 'UNKNOWN',
    }
  }

  const normalizedEmail = normalizeCacheToken(email)
  const cacheKey = buildCacheKey(['cache', 'emailable', 'verification', normalizedEmail])

  return getOrSet<EmailableResponse>({
    key: cacheKey,
    ttlSeconds: EMAILABLE_CACHE_TTL,
    fetcher: async () => {
      try {
        const response = await fetch(
          `https://api.emailable.com/v1/verify?email=${encodeURIComponent(email)}&api_key=${apiKey}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          let errorData: any = {}
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { message: errorText }
          }
          
          throw new ExternalAPIError(
            errorData.message || `Emailable API error: ${response.status}`,
            'emailable',
            { metadata: { statusCode: response.status, errorData } }
          )
        }

        const data = await response.json()
        
        // Map Emailable state to our deliverability label
        let deliverability: 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN' = 'UNKNOWN'
        
        const state = String(data.state || '').toLowerCase()
        if (state === 'deliverable') {
          deliverability = 'DELIVERABLE'
        } else if (state === 'undeliverable') {
          deliverability = 'UNDELIVERABLE'
        } else if (state === 'risky') {
          deliverability = 'RISKY'
        }

        return {
          ...data,
          deliverability,
        }
      } catch (error) {
        captureApiException(error, {
          route: 'lib/emailable-verification',
          method: 'VERIFY',
          tags: { provider: 'emailable' },
        })

        if (error instanceof ExternalAPIError) throw error
        
        throw new ExternalAPIError(
          error instanceof Error ? error.message : 'Unknown error during Emailable verification',
          'emailable',
          { cause: error }
        )
      }
    },
  })
}
