import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { inferDomainWithGemini } from '@/lib/domain-inference'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUserFromRequest(request)

    const body = await request.json()
    const companyName = String(body?.companyName || '').trim()
    const failedDomain = String(body?.failedDomain || '').trim()
    const linkedinUrl = String(body?.linkedinUrl || '').trim()

    if (!companyName || !failedDomain) {
      return NextResponse.json(
        { error: 'companyName and failedDomain are required' },
        { status: 400 }
      )
    }

    const inference = await inferDomainWithGemini(companyName, failedDomain, linkedinUrl)
    return NextResponse.json(inference)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[v1/ai/infer-domain] Unexpected error:', error)
    return NextResponse.json(
      {
        inferredDomain: null,
        confidence: 'low',
        reasoning: 'Inference unavailable.',
        alternativeDomains: [],
      },
      { status: 200 }
    )
  }
}
