import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { invalidateEmailPatternCache } from '@/lib/cache/tags'
import { captureApiException } from '@/lib/monitoring/sentry'
import { type PatternFeedback, recordPatternFeedback } from '@/lib/pattern-learning'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'
import { EmailFeedbackSchema, formatZodError } from '@/lib/validation/schemas'

type PatternFeedbackOptions = {
  route: string
  rateLimitKey: string
}

export async function handlePatternFeedbackPost(
  request: NextRequest,
  options: PatternFeedbackOptions
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)

    const rl = await checkApiRateLimit(`${options.rateLimitKey}:${user.id}`, 60, 3600)
    if (!rl.allowed) {
      console.warn('[pattern-feedback] rate limit exceeded', {
        route: options.route,
        userId: user.id,
      })
      return rateLimitExceeded(rl.resetAt)
    }

    const payload = await request.json().catch(() => null)
    const parsed = EmailFeedbackSchema.safeParse(payload)
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
      console.warn('[pattern-feedback] Pattern cache invalidation failed:', {
        route: options.route,
        userId: user.id,
        message: invalidateError instanceof Error ? invalidateError.message : String(invalidateError),
      })
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
      console.warn('[pattern-feedback] unauthorized request denied', {
        route: options.route,
      })
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[pattern-feedback] Error:', {
      route: options.route,
      message,
    })
    captureApiException(error, { route: options.route, method: 'POST' })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record feedback',
      },
      { status: 500 }
    )
  }
}

export function methodNotAllowedResponse() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  )
}
