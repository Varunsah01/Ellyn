import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import {
  sendEmail,
  refreshAccessToken,
  decryptToken,
  encryptToken,
} from '@/lib/outlook-helper'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { GmailSendSchema, formatZodError } from '@/lib/validation/schemas'
import { captureApiException } from '@/lib/monitoring/sentry'
import { generateDirectTrackingPixelUrl, injectTrackingPixel } from '@/lib/tracking'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)

    const parsed = GmailSendSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const { leadId, contactId, to, subject, body: rawEmailBody, isHtml = true } = parsed.data

    // Inject direct tracking pixel when HTML and contactId available
    let emailBody = rawEmailBody
    let trackingId: string | undefined
    if (isHtml && contactId) {
      trackingId = crypto.randomUUID()
      const pixelUrl = generateDirectTrackingPixelUrl({ trackingId, userId: user.id, contactId })
      emailBody = injectTrackingPixel(emailBody, pixelUrl)
    }

    const supabase = await createServiceRoleClient()
    const { data: credentials, error: credError } = await supabase
      .from('outlook_credentials')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (credError || !credentials) {
      return NextResponse.json(
        { error: 'Outlook not connected. Please connect Outlook in settings.', code: 'outlook_not_connected' },
        { status: 400 }
      )
    }

    let accessToken = decryptToken(credentials.access_token)
    const refreshToken = decryptToken(credentials.refresh_token)
    const outlookEmail: string = credentials.outlook_email ?? ''

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
          .from('outlook_credentials')
          .update({
            access_token: encryptToken(accessToken),
            token_expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .then(({ error: updateErr }) => {
            if (updateErr) console.error('Error updating refreshed Outlook token:', updateErr)
          })
      } catch {
        return NextResponse.json(
          { error: 'Outlook authorization expired. Please reconnect Outlook.', code: 'outlook_reauth_required' },
          { status: 401 }
        )
      }
    }

    // Try sending email
    let messageId = ''
    let conversationId = ''

    try {
      const result = await sendEmail(accessToken, { to, subject, body: emailBody, isHtml })
      messageId = result.messageId
      conversationId = result.conversationId
    } catch (sendErr: unknown) {
      // On OUTLOOK_REAUTH_REQUIRED or 401 — attempt one token refresh and retry
      if (sendErr instanceof Error && (
        sendErr.message === 'OUTLOOK_REAUTH_REQUIRED' ||
        sendErr.message.includes('401')
      )) {
        try {
          const refreshed = await refreshAccessToken(refreshToken)
          accessToken = refreshed.access_token
          const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

          void supabase
            .from('outlook_credentials')
            .update({
              access_token: encryptToken(accessToken),
              token_expires_at: newExpiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)
            .then(({ error: updateErr }) => {
              if (updateErr) console.error('Error updating refreshed Outlook token:', updateErr)
            })

          const result = await sendEmail(accessToken, { to, subject, body: emailBody, isHtml })
          messageId = result.messageId
          conversationId = result.conversationId
        } catch {
          return NextResponse.json(
            { error: 'Outlook authorization expired. Please reconnect Outlook.', code: 'outlook_reauth_required' },
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
        from_email: outlookEmail || null,
        subject,
        body: emailBody,
        provider_thread_id: conversationId || null,
        status: 'sent',
      })
      .then(({ error: histErr }) => {
        if (histErr) console.error('Error logging Outlook email history:', histErr)
      })

    // Fire-and-forget: log sent event
    void supabase
      .from('email_tracking_events')
      .insert({
        user_id: user.id,
        contact_id: contactId ?? null,
        event_type: 'sent',
        metadata: {
          source: 'outlook_send_route',
          message_id: messageId || null,
          conversation_id: conversationId || null,
          tracking_id: trackingId ?? null,
        },
      })
      .then(({ error: evtErr }) => {
        if (evtErr) console.error('Error logging Outlook tracking sent event:', evtErr)
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

    return NextResponse.json({ success: true, message: 'Email sent successfully' })
  } catch (err: unknown) {
    console.error('Error sending Outlook email:', err)
    captureApiException(err, { route: '/api/outlook/send', method: 'POST' })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}
