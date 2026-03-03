/**
 * Server-side Gmail send helper.
 * Preferred over calling /api/gmail/send internally — skips the HTTP roundtrip
 * and avoids auth-forwarding complexity.
 */

import {
  decryptToken,
  refreshAccessToken,
  encryptToken,
  formatEmail,
  sendEmail,
} from '@/lib/gmail-helper'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function sendEmailViaGmail({
  userId,
  to,
  subject,
  body,
  contactId,
  isHtml = true,
}: {
  userId: string
  to: string
  subject: string
  body: string
  contactId?: string
  isHtml?: boolean
}): Promise<{ success: boolean; messageId?: string; error?: string; code?: string }> {
  const supabase = await createServiceRoleClient()

  const { data: credentials, error: credError } = await supabase
    .from('gmail_credentials')
    .select('access_token, refresh_token, gmail_email, token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (credError || !credentials) {
    return { success: false, error: 'Gmail not connected', code: 'gmail_not_connected' }
  }

  let accessToken = decryptToken(credentials.access_token)
  const refreshToken = decryptToken(credentials.refresh_token)
  const gmailFrom: string | undefined = credentials.gmail_email || undefined

  // Proactive refresh if token expires within 5 minutes
  const expiresAt = credentials.token_expires_at
    ? new Date(credentials.token_expires_at).getTime()
    : 0
  if (expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(refreshToken)
      accessToken = refreshed.access_token
      void supabase
        .from('gmail_credentials')
        .update({
          access_token: encryptToken(accessToken),
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq('user_id', userId)
    } catch {
      return { success: false, error: 'Gmail token expired', code: 'gmail_reauth_required' }
    }
  }

  try {
    const encodedMessage = formatEmail(to, subject, body, gmailFrom, isHtml)
    const messageId = await sendEmail(accessToken, encodedMessage)

    void supabase
      .from('email_history')
      .insert({
        user_id: userId,
        contact_id: contactId ?? null,
        to_email: to,
        from_email: gmailFrom ?? null,
        subject,
        body,
        gmail_message_id: messageId,
        status: 'sent',
      })
      .then(({ error: histErr }) => {
        if (histErr) console.error('[gmail-send] email_history insert failed:', histErr)
      })

    return { success: true, messageId }
  } catch (sendErr: unknown) {
    // Retry on 401 / invalid_grant
    if (
      sendErr instanceof Error &&
      (sendErr.message.includes('401') || sendErr.message.includes('invalid_grant'))
    ) {
      try {
        const refreshed = await refreshAccessToken(refreshToken)
        accessToken = refreshed.access_token
        void supabase
          .from('gmail_credentials')
          .update({
            access_token: encryptToken(accessToken),
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          })
          .eq('user_id', userId)

        const encodedMessage = formatEmail(to, subject, body, gmailFrom, isHtml)
        const messageId = await sendEmail(accessToken, encodedMessage)

        void supabase
          .from('email_history')
          .insert({
            user_id: userId,
            contact_id: contactId ?? null,
            to_email: to,
            from_email: gmailFrom ?? null,
            subject,
            body,
            gmail_message_id: messageId,
            status: 'sent',
          })

        return { success: true, messageId }
      } catch {
        return { success: false, error: 'Gmail auth expired', code: 'gmail_reauth_required' }
      }
    }

    return {
      success: false,
      error: sendErr instanceof Error ? sendErr.message : 'Send failed',
    }
  }
}
