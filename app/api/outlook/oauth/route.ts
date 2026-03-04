import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens, encryptToken, getOutlookEmail } from '@/lib/outlook-helper'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
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
        new URL('/dashboard/settings?tab=account&outlook=cancelled', request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?tab=account&outlook=error', request.url)
      )
    }

    // CSRF: validate state param against cookie
    const cookieStore = await cookies()
    const storedState = cookieStore.get('outlook_oauth_state')?.value

    if (!state || !storedState || state !== storedState) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?tab=account&outlook=error&reason=csrf', request.url)
      )
    }

    // Clear the state cookie
    cookieStore.set('outlook_oauth_state', '', { maxAge: 0, path: '/' })

    // Identify user from session
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Exchange code for tokens (redirectUri must match Azure registration exactly)
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const redirectUri = `${appUrl}/api/outlook/oauth`
    const tokenResponse = await exchangeCodeForTokens(code, redirectUri)

    // Fetch Outlook email from MS Graph
    const outlookEmail = await getOutlookEmail(tokenResponse.access_token)

    // Encrypt tokens with AES-256-GCM
    const encryptedAccessToken = encryptToken(tokenResponse.access_token)
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? encryptToken(tokenResponse.refresh_token)
      : null

    // Compute token expiry
    const tokenExpiresAt = new Date(
      Date.now() + (tokenResponse.expires_in ?? 3600) * 1000
    ).toISOString()

    // Upsert credentials scoped to user_id
    const serviceClient = await createServiceRoleClient()
    const { error: upsertError } = await serviceClient
      .from('outlook_credentials')
      .upsert(
        {
          user_id: user.id,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          outlook_email: outlookEmail,
          token_expires_at: tokenExpiresAt,
          encrypted_version: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('Error saving Outlook credentials:', upsertError)
      return NextResponse.redirect(
        new URL('/dashboard/settings?tab=account&outlook=error', request.url)
      )
    }

    return NextResponse.redirect(
      new URL('/dashboard/settings?tab=account&outlook=success', request.url)
    )
  } catch (err) {
    console.error('Outlook OAuth error:', err)
    captureApiException(err, { route: '/api/outlook/oauth', method: 'GET' })
    return NextResponse.redirect(
      new URL('/dashboard/settings?tab=account&outlook=error', request.url)
    )
  }
}
