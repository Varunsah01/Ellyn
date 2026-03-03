import { NextRequest, NextResponse } from 'next/server'
import {
  formatEmail,
  sendEmail,
  refreshAccessToken,
  decryptToken,
  encryptToken,
} from '@/lib/gmail-helper'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { GmailSendSchema, formatZodError } from '@/lib/validation/schemas'
import { captureApiException } from '@/lib/monitoring/sentry'

export async function POST(request: NextRequest) {
  try {
    // Auth guard
    const user = await getAuthenticatedUserFromRequest(request)

    const parsed = GmailSendSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const { leadId, contactId, to, subject, body: emailBody, isHtml = true } = parsed.data

    // Fetch credentials scoped to user_id
    const supabase = await createServiceRoleClient()
    const { data: credentials, error: credError } = await supabase
      .from('gmail_credentials')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (credError || !credentials) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect Gmail in settings.', code: 'gmail_not_connected' },
        { status: 404 }
      )
    }

    let accessToken = decryptToken(credentials.access_token)
    const refreshToken = decryptToken(credentials.refresh_token)
    const gmailFrom = credentials.gmail_email || undefined

    // Proactive token refresh if expires within 5 minutes
    const expiresAt = credentials.token_expires_at
      ? new Date(credentials.token_expires_at).getTime()
      : 0
    const fiveMinutes = 5 * 60 * 1000

    if (expiresAt > 0 && expiresAt - Date.now() < fiveMinutes) {
      try {
        const refreshed = await refreshAccessToken(refreshToken)
        accessToken = refreshed.access_token
        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

        void supabase
          .from('gmail_credentials')
          .update({
            access_token: encryptToken(accessToken),
            token_expires_at: newExpiresAt,
          })
          .eq('user_id', user.id)
          .then(({ error: updateErr }) => {
            if (updateErr) console.error('Error updating refreshed token:', updateErr)
          })
      } catch (refreshErr) {
        // Token may be revoked
        return NextResponse.json(
          { error: 'Gmail authorization expired. Please reconnect Gmail.', code: 'gmail_reauth_required' },
          { status: 401 }
        )
      }
    }

    // Try sending email
    let messageId = ''

    try {
      const encodedMessage = formatEmail(to, subject, emailBody, gmailFrom, isHtml)
      messageId = await sendEmail(accessToken, encodedMessage)
    } catch (sendErr: unknown) {
      // If 401/invalid_grant, try refreshing once
      if (sendErr instanceof Error && (sendErr.message.includes('401') || sendErr.message.includes('invalid_grant'))) {
        try {
          const refreshed = await refreshAccessToken(refreshToken)
          accessToken = refreshed.access_token
          const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

          void supabase
            .from('gmail_credentials')
            .update({
              access_token: encryptToken(accessToken),
              token_expires_at: newExpiresAt,
            })
            .eq('user_id', user.id)
            .then(({ error: updateErr }) => {
              if (updateErr) console.error('Error updating refreshed token:', updateErr)
            })

          const encodedMessage = formatEmail(to, subject, emailBody, gmailFrom, isHtml)
          messageId = await sendEmail(accessToken, encodedMessage)
        } catch {
          return NextResponse.json(
            { error: 'Gmail authorization expired. Please reconnect Gmail.', code: 'gmail_reauth_required' },
            { status: 401 }
          )
        }
      } else {
        throw sendErr
      }
    }

    // Fire-and-forget: log to email_history
    void supabase
      .from('email_history')
      .insert({
        user_id: user.id,
        lead_id: leadId ?? null,
        contact_id: contactId ?? null,
        to_email: to,
        from_email: gmailFrom ?? null,
        subject,
        body: emailBody,
        gmail_message_id: messageId,
        status: 'sent',
      })
      .then(({ error: histErr }) => {
        if (histErr) console.error('Error logging email history:', histErr)
      })

    // Fire-and-forget: update lead status if leadId provided
    if (leadId) {
      void supabase
        .from('leads')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .then(({ error: leadErr }) => {
          if (leadErr) console.error('Error updating lead status:', leadErr)
        })
    }

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Email sent successfully',
    })
  } catch (err: unknown) {
    console.error('Error sending email:', err)
    captureApiException(err, { route: '/api/gmail/send', method: 'POST' })
    const errorMessage = err instanceof Error ? err.message : 'Failed to send email'

    return NextResponse.json(
      { error: errorMessage || 'Failed to send email' },
      { status: 500 }
    )
  }
}
