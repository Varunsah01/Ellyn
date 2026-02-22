import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { validatePasswordStrength } from '@/lib/validation/password'
import { captureApiException } from '@/lib/monitoring/sentry'

const SignupSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
  emailRedirectTo: z.string().url().optional(),
})

/**
 * Create a new user account with server-side password strength enforcement.
 * @param {NextRequest} request - Incoming Next.js request object.
 * @returns {Promise<NextResponse>} Signup result with session/verification status.
 * @throws {ValidationError} If input or password requirements are not met.
 * @throws {Error} If account creation fails unexpectedly.
 * @example
 * POST /api/auth/signup
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = SignupSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid signup payload.',
        },
        { status: 400 }
      )
    }

    const name = parsed.data.name.trim()
    const email = parsed.data.email.trim().toLowerCase()
    const password = parsed.data.password

    const strength = validatePasswordStrength(password)
    if (!strength.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password does not meet strength requirements.',
          score: strength.score,
          label: strength.label,
          requirements: strength.requirements,
          feedback: strength.feedback,
        },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: parsed.data.emailRedirectTo,
      },
    })

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to create account.',
        },
        { status: 400 }
      )
    }

    const hasSession = Boolean(data.session)
    return NextResponse.json({
      success: true,
      message: hasSession
        ? 'Account created successfully.'
        : 'Account created. Check your email to verify your address before signing in.',
      hasSession,
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            user_metadata: data.user.user_metadata,
          }
        : null,
    })
  } catch (error) {
    console.error('[Auth] Signup error:', error)
    captureApiException(error, { route: '/api/auth/signup', method: 'POST' })
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create account.',
      },
      { status: 500 }
    )
  }
}

/**
 * Reject non-POST requests for signup.
 * @returns {Promise<NextResponse>} Method-not-allowed response.
 * @example
 * GET /api/auth/signup
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

