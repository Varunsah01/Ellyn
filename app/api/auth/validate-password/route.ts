import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validatePasswordStrength } from '@/lib/validation/password'
import { captureApiException } from '@/lib/monitoring/sentry'

const ValidatePasswordSchema = z.object({
  password: z.string(),
})

/**
 * Validate a password against the application's strength requirements.
 * @param {NextRequest} request - Incoming Next.js request object.
 * @returns {Promise<NextResponse>} JSON response containing strength score and requirement checks.
 * @throws {Error} If request parsing or validation processing fails unexpectedly.
 * @example
 * POST /api/auth/validate-password
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = ValidatePasswordSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password is required.',
        },
        { status: 400 }
      )
    }

    const result = validatePasswordStrength(parsed.data.password)

    if (!result.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password does not meet strength requirements.',
          score: result.score,
          label: result.label,
          requirements: result.requirements,
          feedback: result.feedback,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      score: result.score,
      label: result.label,
      requirements: result.requirements,
      feedback: result.feedback,
    })
  } catch (error) {
    console.error('[Auth] Password validation error:', error)
    captureApiException(error, { route: '/api/auth/validate-password', method: 'POST' })
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to validate password strength.',
      },
      { status: 500 }
    )
  }
}

/**
 * Reject non-POST requests for password validation.
 * @returns {Promise<NextResponse>} Method-not-allowed response.
 * @example
 * GET /api/auth/validate-password
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

