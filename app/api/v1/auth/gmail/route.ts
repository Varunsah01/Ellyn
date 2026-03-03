import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { getAuthUrl } from '@/lib/gmail-helper'
import { createClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Auth guard
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Generate CSRF state token
    const state = randomBytes(32).toString('hex')

    // Store state in HTTP-only cookie (10-minute TTL)
    const cookieStore = await cookies()
    cookieStore.set('gmail_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    // Build OAuth URL with app-level credentials
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/oauth`
    const authUrl = getAuthUrl(redirectUri, state)

    return NextResponse.redirect(authUrl)
  } catch (err) {
    captureApiException(err, { route: '/api/v1/auth/gmail', method: 'GET' })
    return NextResponse.redirect(
      new URL('/dashboard/settings?tab=account&gmail=error', request.url)
    )
  }
}
