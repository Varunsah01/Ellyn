import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createVersionedHandler } from '@/app/api/v1/_utils'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { verifyEmailEmailable } from '@/lib/emailable-verification'
import { incrementEmailGeneration, QuotaExceededError } from '@/lib/quota'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

const verifySchema = z.object({
  email: z.string().email(),
})

/**
 * Handle POST requests for `/api/v1/email-verify`.
 * Verifies an email address using the Emailable integration.
 */
const POST_HANDLER = async (req: NextRequest) => {
  const user = await getAuthenticatedUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check rate limit.
  const rl = await checkApiRateLimit(`email-verify:${user.id}`, 60, 3600)
  if (!rl.allowed) {
    return rateLimitExceeded(rl.resetAt)
  }

  try {
    const body = await req.json()
    const { email } = verifySchema.parse(body)

    // Check quota and increment usage.
    try {
      await incrementEmailGeneration(user.id)
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            error: 'quota_exceeded',
            feature: error.feature,
            used: error.used,
            limit: error.limit,
            upgrade_url: '/dashboard/upgrade',
          },
          { status: 402 }
        )
      }
      throw error
    }

    const verification = await verifyEmailEmailable(email)

    return NextResponse.json({
      success: true,
      email: verification.email,
      deliverability: verification.deliverability,
      state: verification.state,
      score: verification.score,
      reason: verification.reason,
      metadata: {
        format_valid: verification.format_valid,
        mx_found: verification.mx_found,
        smtp_checkable: verification.smtp_checkable,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: error.errors }, { status: 400 })
    }
    
    console.error('[Email Verify API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const POST = createVersionedHandler(POST_HANDLER)
