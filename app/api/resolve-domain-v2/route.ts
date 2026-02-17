import { NextRequest, NextResponse } from 'next/server'

import { resolveDomain, type DomainResult } from '@/lib/domain-resolution-service'
import {
  captureApiException,
  captureSlowApiRoute,
  withApiRouteSpan,
} from '@/lib/monitoring/sentry'
import { ResolveDomainSchema, formatZodError } from '@/lib/validation/schemas'

export const runtime = 'edge'
export const maxDuration = 10

interface ResolveDomainResponse {
  success: boolean
  result?: DomainResult
  error?: string
  details?: Array<{ path: string; message: string; code: string }>
  timing?: {
    total: number
  }
}

/**
 * Handle POST requests for `/api/resolve-domain-v2`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/resolve-domain-v2 request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/resolve-domain-v2
 * fetch('/api/resolve-domain-v2', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  return withApiRouteSpan(
    'POST /api/resolve-domain-v2',
    async () => {
      try {
        const parsed = ResolveDomainSchema.safeParse(await request.json())
        if (!parsed.success) {
          const badRequest: ResolveDomainResponse = {
            success: false,
            error: 'Validation failed',
            details: formatZodError(parsed.error),
            timing: { total: Date.now() - startedAt },
          }
          return NextResponse.json(badRequest, { status: 400 })
        }
        const body = parsed.data

        const result = await resolveDomain({
          companyName: body.companyName,
          companyPageUrl: body.companyPageUrl,
          skipCache: body.skipCache === true,
          skipMXValidation: body.skipMXValidation === true,
        })

        const total = Date.now() - startedAt
        captureSlowApiRoute('/api/resolve-domain-v2', total, {
          method: 'POST',
          thresholdMs: 1500,
        })

        const successResponse: ResolveDomainResponse = {
          success: true,
          result,
          timing: {
            total,
          },
        }

        return NextResponse.json(successResponse)
      } catch (error) {
        if (error instanceof SyntaxError) {
          const badJson: ResolveDomainResponse = {
            success: false,
            error: 'Invalid JSON body',
            timing: {
              total: Date.now() - startedAt,
            },
          }
          return NextResponse.json(badJson, { status: 400 })
        }

        captureApiException(error, {
          route: '/api/resolve-domain-v2',
          method: 'POST',
        })
        console.error('[resolve-domain-v2] Internal error:', error)

        const message = error instanceof Error ? error.message : 'Failed to resolve domain'
        const failureResponse: ResolveDomainResponse = {
          success: false,
          error: message,
          timing: {
            total: Date.now() - startedAt,
          },
        }

        return NextResponse.json(failureResponse, { status: 500 })
      }
    },
    {
      'api.route': '/api/resolve-domain-v2',
      'api.method': 'POST',
    }
  )
}

/**
 * Handle GET requests for `/api/resolve-domain-v2`.
 * @returns {unknown} JSON response for the GET /api/resolve-domain-v2 request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/resolve-domain-v2
 * fetch('/api/resolve-domain-v2')
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST.',
    } satisfies ResolveDomainResponse,
    { status: 405 }
  )
}
