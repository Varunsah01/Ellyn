import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { invalidateEmailPatternCache } from '@/lib/cache/tags'
import { type PatternFeedback, recordPatternFeedback } from '@/lib/pattern-learning'
import { EmailFeedbackSchema, formatZodError } from '@/lib/validation/schemas'

/**
 * Handle POST requests for `/api/email-feedback`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/email-feedback request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/email-feedback
 * fetch('/api/email-feedback', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUserFromRequest(request)

    const parsed = EmailFeedbackSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: formatZodError(parsed.error),
        },
        { status: 400 }
      )
    }

    const { email, pattern, companyDomain, worked, contactId } = parsed.data

    const feedback: PatternFeedback = {
      email,
      pattern,
      company_domain: companyDomain,
      worked,
      contact_id: contactId,
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

    try {
      await invalidateEmailPatternCache(companyDomain)
    } catch (invalidateError) {
      console.warn('[API][email-feedback] Pattern cache invalidation failed:', invalidateError)
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

/**
 * Handle GET requests for `/api/email-feedback`.
 * @returns {unknown} JSON response for the GET /api/email-feedback request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/email-feedback
 * fetch('/api/email-feedback')
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  )
}
