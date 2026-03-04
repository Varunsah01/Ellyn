import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { decryptToken, refreshAccessToken, encryptToken } from '@/lib/gmail-helper'
import {
  decryptToken as decryptOutlookToken,
  refreshAccessToken as refreshOutlookToken,
  encryptToken as encryptOutlookToken,
} from '@/lib/outlook-helper'

export const runtime = 'nodejs'
export const maxDuration = 60

interface EmailHistoryRow {
  id: string
  user_id: string
  contact_id: string | null
  sequence_enrollment_id: string | null
  provider_thread_id: string | null
  gmail_message_id: string | null
}

interface GmailMessage {
  payload?: {
    headers?: Array<{ name: string; value: string }>
  }
}

interface GmailThread {
  messages?: GmailMessage[]
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceRoleClient()

  // Fetch all email_history rows linked to sequence enrollments with provider thread IDs
  const { data: rows, error: rowsError } = await supabase
    .from('email_history')
    .select('id, user_id, contact_id, sequence_enrollment_id, provider_thread_id, gmail_message_id')
    .not('sequence_enrollment_id', 'is', null)
    .not('provider_thread_id', 'is', null)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (rowsError) {
    console.error('[cron/check-replies] Failed to fetch email_history:', rowsError)
    return NextResponse.json({ error: 'Failed to fetch email history' }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  // Check which enrollments already have status 'replied' to skip them
  const enrollmentIds = [...new Set(rows.map((r: EmailHistoryRow) => r.sequence_enrollment_id).filter(Boolean))] as string[]
  const { data: existingReplied } = await supabase
    .from('sequence_enrollments')
    .select('id')
    .in('id', enrollmentIds)
    .eq('status', 'replied')

  const alreadyRepliedIds = new Set((existingReplied ?? []).map((r: { id: string }) => r.id))

  // Filter out already-replied enrollments
  const pending = (rows as EmailHistoryRow[]).filter(
    (r) => r.sequence_enrollment_id && !alreadyRepliedIds.has(r.sequence_enrollment_id)
  )

  if (pending.length === 0) {
    return NextResponse.json({ processed: 0, skipped: rows.length })
  }

  // Group by user_id to deduplicate credential lookups
  const byUser = new Map<string, EmailHistoryRow[]>()
  for (const row of pending) {
    const list = byUser.get(row.user_id) ?? []
    list.push(row)
    byUser.set(row.user_id, list)
  }

  let processed = 0
  let repliesFound = 0

  await Promise.allSettled(
    Array.from(byUser.entries()).map(async ([userId, userRows]) => {
      // Split by provider: Gmail rows have gmail_message_id, Outlook rows don't
      const gmailRows = userRows.filter((r) => r.gmail_message_id)
      const outlookRows = userRows.filter((r) => !r.gmail_message_id)

      // ---- Gmail reply detection ----
      if (gmailRows.length > 0) {
        try {
          const { data: gmailCreds } = await supabase
            .from('gmail_credentials')
            .select('access_token, refresh_token, gmail_email, token_expires_at')
            .eq('user_id', userId)
            .maybeSingle()

          if (!gmailCreds) return

          let accessToken = decryptToken(gmailCreds.access_token)
          const refreshToken = decryptToken(gmailCreds.refresh_token)
          const userEmail: string = gmailCreds.gmail_email ?? ''

          // Proactive refresh
          const expiresAt = gmailCreds.token_expires_at
            ? new Date(gmailCreds.token_expires_at).getTime()
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
              return // Can't refresh, skip this user
            }
          }

          await Promise.allSettled(
            gmailRows.map(async (row) => {
              try {
                processed++
                const threadRes = await fetch(
                  `https://gmail.googleapis.com/gmail/v1/users/me/threads/${row.provider_thread_id}?format=metadata&metadataHeaders=From`,
                  { headers: { Authorization: `Bearer ${accessToken}` } }
                )

                if (threadRes.status === 401 || threadRes.status === 403) {
                  return // Insufficient scope or expired — skip silently
                }

                if (!threadRes.ok) return

                const thread = (await threadRes.json()) as GmailThread
                const messages = thread.messages ?? []

                // A reply exists if any message is FROM someone other than the sending user
                const hasReply = messages.some((msg) => {
                  const fromHeader = msg.payload?.headers?.find(
                    (h) => h.name.toLowerCase() === 'from'
                  )
                  const from = fromHeader?.value ?? ''
                  return userEmail && !from.toLowerCase().includes(userEmail.toLowerCase())
                })

                if (hasReply) {
                  repliesFound++
                  await markReply({ supabase, row })
                }
              } catch (err) {
                console.error('[cron/check-replies] Gmail thread check error:', err)
              }
            })
          )
        } catch (err) {
          console.error('[cron/check-replies] Gmail user processing error:', err)
        }
      }

      // ---- Outlook reply detection ----
      if (outlookRows.length > 0) {
        try {
          const { data: outlookCreds } = await supabase
            .from('outlook_credentials')
            .select('access_token, refresh_token, outlook_email, token_expires_at')
            .eq('user_id', userId)
            .maybeSingle()

          if (!outlookCreds) return

          let accessToken = decryptOutlookToken(outlookCreds.access_token)
          const refreshToken = decryptOutlookToken(outlookCreds.refresh_token)
          const userEmail: string = outlookCreds.outlook_email ?? ''

          // Proactive refresh
          const expiresAt = outlookCreds.token_expires_at
            ? new Date(outlookCreds.token_expires_at).getTime()
            : 0
          if (expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000) {
            try {
              const refreshed = await refreshOutlookToken(refreshToken)
              accessToken = refreshed.access_token
              void supabase
                .from('outlook_credentials')
                .update({
                  access_token: encryptOutlookToken(accessToken),
                  token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
                })
                .eq('user_id', userId)
            } catch {
              return
            }
          }

          await Promise.allSettled(
            outlookRows.map(async (row) => {
              try {
                processed++
                const filter = encodeURIComponent(`conversationId eq '${row.provider_thread_id}'`)
                const msgRes = await fetch(
                  `https://graph.microsoft.com/v1.0/me/messages?$filter=${filter}&$select=from,sender`,
                  { headers: { Authorization: `Bearer ${accessToken}` } }
                )

                if (msgRes.status === 401 || msgRes.status === 403) {
                  return // Insufficient scope — skip silently
                }

                if (!msgRes.ok) return

                const data = (await msgRes.json()) as {
                  value?: Array<{ from?: { emailAddress?: { address?: string } } }>
                }
                const messages = data.value ?? []

                const hasReply = messages.some((msg) => {
                  const from = msg.from?.emailAddress?.address ?? ''
                  return userEmail && !from.toLowerCase().includes(userEmail.toLowerCase())
                })

                if (hasReply) {
                  repliesFound++
                  await markReply({ supabase, row })
                }
              } catch (err) {
                console.error('[cron/check-replies] Outlook message check error:', err)
              }
            })
          )
        } catch (err) {
          console.error('[cron/check-replies] Outlook user processing error:', err)
        }
      }
    })
  )

  return NextResponse.json({ processed, repliesFound })
}

async function markReply({
  supabase,
  row,
}: {
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>
  row: EmailHistoryRow
}) {
  const enrollmentId = row.sequence_enrollment_id!

  // Fetch sequence_id for the event
  const { data: enrollment } = await supabase
    .from('sequence_enrollments')
    .select('sequence_id')
    .eq('id', enrollmentId)
    .maybeSingle()

  const sequenceId: string | null = enrollment?.sequence_id ?? null

  await Promise.allSettled([
    supabase
      .from('sequence_enrollments')
      .update({ status: 'replied' })
      .eq('id', enrollmentId)
      .neq('status', 'replied'),

    supabase.from('email_tracking_events').insert({
      user_id: row.user_id,
      contact_id: row.contact_id ?? null,
      sequence_id: sequenceId,
      event_type: 'replied',
      metadata: {
        enrollment_id: enrollmentId,
        provider_thread_id: row.provider_thread_id,
        source: 'cron_check_replies',
      },
    }),

    row.contact_id
      ? supabase
          .from('contacts')
          .update({ status: 'replied' })
          .eq('id', row.contact_id)
          .neq('status', 'replied')
      : Promise.resolve(),
  ])
}
