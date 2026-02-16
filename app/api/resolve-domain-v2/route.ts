import { NextRequest, NextResponse } from 'next/server'

import { resolveDomain, type DomainResult } from '@/lib/domain-resolution-service'

export const runtime = 'edge'
export const maxDuration = 10

interface ResolveDomainRequest {
  companyName: string
  companyPageUrl?: string
  skipCache?: boolean
  skipMXValidation?: boolean
}

interface ResolveDomainResponse {
  success: boolean
  result?: DomainResult
  error?: string
  timing?: {
    total: number
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  try {
    const body = (await request.json()) as Partial<ResolveDomainRequest>
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''

    if (!companyName) {
      const badRequest: ResolveDomainResponse = {
        success: false,
        error: 'Invalid companyName. Provide a non-empty string.',
        timing: { total: Date.now() - startedAt },
      }
      return NextResponse.json(badRequest, { status: 400 })
    }

    const result = await resolveDomain({
      companyName,
      companyPageUrl: typeof body.companyPageUrl === 'string' ? body.companyPageUrl : undefined,
      skipCache: body.skipCache === true,
      skipMXValidation: body.skipMXValidation === true,
    })

    const successResponse: ResolveDomainResponse = {
      success: true,
      result,
      timing: {
        total: Date.now() - startedAt,
      },
    }

    return NextResponse.json(successResponse)
  } catch (error) {
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
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST.',
    } satisfies ResolveDomainResponse,
    { status: 405 }
  )
}
