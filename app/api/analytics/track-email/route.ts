import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { invalidateUserAnalyticsCache } from '@/lib/cache/tags'
import { captureApiException } from '@/lib/monitoring/sentry'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatZodError } from '@/lib/validation/schemas'

import { isMissingDbObjectError, sanitizeErrorForLog } from '../_helpers'

const trackEmailEventSchema = z.object({
  draftId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  sequenceId: z.string().uuid().optional(),
  eventType: z.enum(['sent', 'opened', 'clicked', 'replied', 'bounced']),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const rl = await checkApiRateLimit(`track-email:${user.id}`, 200, 3600)
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

    const supabase = await createServiceRoleClient()

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = trackEmailEventSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const insertResult = await supabase
      .from('email_tracking_events')
      .insert({
        user_id: user.id,
        draft_id: payload.draftId ?? null,
        contact_id: payload.contactId ?? null,
        sequence_id: payload.sequenceId ?? null,
        event_type: payload.eventType,
        metadata: payload.metadata ?? {},
        ...(payload.occurredAt ? { occurred_at: payload.occurredAt } : {}),
      })
      .select('id, occurred_at')
      .single()

    if (insertResult.error) {
      return NextResponse.json(
        { success: false, error: 'Failed to track email event' },
        { status: 500 }
      )
    }

    void invalidateUserAnalyticsCache(user.id).catch((error) => {
      console.warn('[analytics/track-email] Failed to invalidate analytics cache', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        id: insertResult.data?.id ?? null,
        occurredAt: insertResult.data?.occurred_at ?? new Date().toISOString(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (isMissingDbObjectError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tracking schema is missing. Run migration 012_email_tracking.sql.',
        },
        { status: 503 }
      )
    }

    console.error('[analytics/track-email] Internal error:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/analytics/track-email', method: 'POST' })
    return NextResponse.json(
      { success: false, error: 'Failed to track email event' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}
