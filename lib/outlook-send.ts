/**
 * Server-side Outlook send helper.
 * Mirrors lib/gmail-send.ts — skips the HTTP roundtrip to /api/outlook/send.
 */

import {
  decryptToken,
  refreshAccessToken,
  encryptToken,
  sendEmail,
} from '@/lib/outlook-helper'
import { injectTrackingPixel } from '@/lib/tracking'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function sendEmailViaOutlook({
  userId,
  to,
  subject,
  body,
  contactId,
  isHtml = true,
  trackingPixelUrl,
  sequenceEnrollmentId,
}: {
  userId: string
  to: string
  subject: string
  body: string
  contactId?: string
  isHtml?: boolean
  trackingPixelUrl?: string
  sequenceEnrollmentId?: string
}): Promise<{ success: boolean; error?: string; code?: string }> {
  const supabase = await createServiceRoleClient()

  const { data: credentials, error: credError } = await supabase
    .from('outlook_credentials')
    .select('access_token, refresh_token, outlook_email, token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (credError || !credentials) {
    return { success: false, error: 'Outlook not connected', code: 'outlook_not_connected' }
  }

  let accessToken = decryptToken(credentials.access_token)
  const refreshToken = decryptToken(credentials.refresh_token)
  const outlookFrom: string | undefined = credentials.outlook_email || undefined

  // Proactive refresh if token expires within 5 minutes
  const expiresAt = credentials.token_expires_at
    ? new Date(credentials.token_expires_at).getTime()
    : 0
  if (expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(refreshToken)
      accessToken = refreshed.access_token
      void supabase
        .from('outlook_credentials')
        .update({
          access_token: encryptToken(accessToken),
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq('user_id', userId)
    } catch {
      return { success: false, error: 'Outlook token expired', code: 'outlook_reauth_required' }
    }
  }

  const finalBody = trackingPixelUrl ? injectTrackingPixel(body, trackingPixelUrl) : body

  function insertHistory(messageId: string, conversationId: string) {
    void supabase
      .from('email_history')
      .insert({
        user_id: userId,
        contact_id: contactId ?? null,
        to_email: to,
        from_email: outlookFrom ?? null,
        subject,
        body: finalBody,
        status: 'sent',
        sequence_enrollment_id: sequenceEnrollmentId ?? null,
        provider_thread_id: conversationId,
      })
      .then(({ error: histErr }) => {
        if (histErr) console.error('[outlook-send] email_history insert failed:', histErr)
      })

    void supabase
      .from('email_tracking_events')
      .insert({
        user_id: userId,
        contact_id: contactId ?? null,
        event_type: 'sent',
        metadata: {
          source: 'outlook_send',
          message_id: messageId,
          conversation_id: conversationId,
        },
      })
      .then(({ error: evtErr }) => {
        if (evtErr) console.error('[outlook-send] tracking event insert failed:', evtErr)
      })
  }

  try {
    const { messageId, conversationId } = await sendEmail(accessToken, {
      to,
      subject,
      body: finalBody,
      isHtml,
      from: outlookFrom,
    })

    insertHistory(messageId, conversationId)
    return { success: true }
  } catch (sendErr: unknown) {
    // Retry on OUTLOOK_REAUTH_REQUIRED (401)
    if (sendErr instanceof Error && sendErr.message === 'OUTLOOK_REAUTH_REQUIRED') {
      try {
        const refreshed = await refreshAccessToken(refreshToken)
        accessToken = refreshed.access_token
        void supabase
          .from('outlook_credentials')
          .update({
            access_token: encryptToken(accessToken),
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          })
          .eq('user_id', userId)

        const { messageId, conversationId } = await sendEmail(accessToken, {
          to,
          subject,
          body: finalBody,
          isHtml,
          from: outlookFrom,
        })

        insertHistory(messageId, conversationId)
        return { success: true }
      } catch {
        return { success: false, error: 'Outlook auth expired', code: 'outlook_reauth_required' }
      }
    }

    return {
      success: false,
      error: sendErr instanceof Error ? sendErr.message : 'Send failed',
    }
  }
}
