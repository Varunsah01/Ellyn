import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { validatePasswordStrength } from '@/lib/validation/password'

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(1, 'New password is required.'),
  confirmPassword: z.string().min(1, 'Confirm password is required.'),
})

async function verifyCurrentPassword(email: string, currentPassword: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase auth configuration is missing.')
  }

  const client = createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  const { error } = await client.auth.signInWithPassword({
    email,
    password: currentPassword,
  })

  return !error
}

/**
 * Change the authenticated user's password after verifying current credentials.
 * @param {NextRequest} request - Incoming Next.js request object.
 * @returns {Promise<NextResponse>} Success response or detailed validation failure.
 * @throws {AuthenticationError} If no authenticated user is found.
 * @throws {Error} If password verification or update fails unexpectedly.
 * @example
 * POST /api/auth/change-password
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    const parsed = ChangePasswordSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid password change request.',
        },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword, confirmPassword } = parsed.data

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'New password and confirmation do not match.',
        },
        { status: 400 }
      )
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'New password must be different from your current password.',
        },
        { status: 400 }
      )
    }

    const strength = validatePasswordStrength(newPassword)
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

    if (!user.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to verify current password for this account.',
        },
        { status: 400 }
      )
    }

    const isCurrentPasswordValid = await verifyCurrentPassword(user.email, currentPassword)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Current password is incorrect.',
        },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      console.error('[Auth] Password update failed:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: updateError.message || 'Unable to update password.',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully.',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[Auth] Change password error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update password.',
      },
      { status: 500 }
    )
  }
}

/**
 * Reject non-POST requests for password change.
 * @returns {Promise<NextResponse>} Method-not-allowed response.
 * @example
 * GET /api/auth/change-password
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

