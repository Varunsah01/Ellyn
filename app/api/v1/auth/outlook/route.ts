import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { getAuthUrl, getMicrosoftClientId, getMicrosoftClientSecret } from '@/lib/outlook-helper'
import { createClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Validate env vars early — surface misconfiguration gracefully
    try {
      getMicrosoftClientId()
      getMicrosoftClientSecret()
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard/settings?tab=account&outlook=error&reason=misconfigured', request.url)
      )
    }

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
    cookieStore.set('outlook_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const redirectUri = `${appUrl}/api/outlook/oauth`
    const authUrl = getAuthUrl(redirectUri, state)

    return NextResponse.redirect(authUrl)
  } catch (err) {
    captureApiException(err, { route: '/api/v1/auth/outlook', method: 'GET' })
    return NextResponse.redirect(
      new URL('/dashboard/settings?tab=account&outlook=error', request.url)
    )
  }
}
