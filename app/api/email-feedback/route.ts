import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { type PatternFeedback, recordPatternFeedback } from '@/lib/pattern-learning'

interface EmailFeedbackRequest {
  email: string
  pattern: string
  companyDomain: string
  worked: boolean
  contactId?: string
}

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUserFromRequest(request)

    const body = (await request.json()) as Partial<EmailFeedbackRequest>

    const email = String(body.email || '').trim().toLowerCase()
    const pattern = String(body.pattern || '').trim().toLowerCase()
    const companyDomain = String(body.companyDomain || '').trim().toLowerCase()
    const worked = body.worked

    if (!email || !pattern || !companyDomain || typeof worked !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: email, pattern, companyDomain, worked',
        },
        { status: 400 }
      )
    }

    if (!isLikelyEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email format.',
        },
        { status: 400 }
      )
    }

    const feedback: PatternFeedback = {
      email,
      pattern,
      company_domain: companyDomain,
      worked,
      contact_id: typeof body.contactId === 'string' ? body.contactId : undefined,
    }

    const result = await recordPatternFeedback(feedback)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to record feedback',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded. Thank you for helping improve accuracy.',
      data: {
        email,
        pattern,
        companyDomain,
        worked,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[API][email-feedback] Error:', {
      message,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record feedback',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  )
}

function isLikelyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
