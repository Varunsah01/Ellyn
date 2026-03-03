import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens, encryptToken, getUserEmail } from '@/lib/gmail-helper'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    // Handle user cancellation
    if (error === 'access_denied') {
      return NextResponse.redirect(
        new URL('/dashboard/settings?tab=account&gmail=cancelled', request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?tab=account&gmail=error', request.url)
      )
    }

    // CSRF: validate state param against cookie
    const cookieStore = await cookies()
    const storedState = cookieStore.get('gmail_oauth_state')?.value

    if (!state || !storedState || state !== storedState) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?tab=account&gmail=error', request.url)
      )
    }

    // Clear the state cookie
    cookieStore.set('gmail_oauth_state', '', { maxAge: 0, path: '/' })

    // Identify user from session
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Exchange code for tokens
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/oauth`
    const tokenResponse = await exchangeCodeForTokens(code, redirectUri)

    // Fetch Gmail email
    const gmailEmail = await getUserEmail(tokenResponse.access_token)

    // Encrypt tokens with AES-256-GCM
    const encryptedAccessToken = encryptToken(tokenResponse.access_token)
    const encryptedRefreshToken = encryptToken(tokenResponse.refresh_token)

    // Compute token expiry
    const tokenExpiresAt = new Date(
      Date.now() + (tokenResponse.expires_in ?? 3600) * 1000
    ).toISOString()

    // Upsert credentials scoped to user_id
    const serviceClient = await createServiceRoleClient()
    const { error: upsertError } = await serviceClient
      .from('gmail_credentials')
      .upsert(
        {
          user_id: user.id,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          gmail_email: gmailEmail,
          token_expires_at: tokenExpiresAt,
          encrypted_version: 2,
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('Error saving Gmail credentials:', upsertError)
      return NextResponse.redirect(
        new URL('/dashboard/settings?tab=account&gmail=error', request.url)
      )
    }

    return NextResponse.redirect(
      new URL('/dashboard/settings?tab=account&gmail=success', request.url)
    )
  } catch (err) {
    console.error('Gmail OAuth error:', err)
    captureApiException(err, { route: '/api/gmail/oauth', method: 'GET' })
    return NextResponse.redirect(
      new URL('/dashboard/settings?tab=account&gmail=error', request.url)
    )
  }
}
