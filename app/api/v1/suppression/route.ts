import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const reasonSchema = z
  .enum(['unsubscribed', 'bounced', 'manual'])
  .default('manual')

const postSchema = z.union([
  // Single email
  z.object({
    email: z.string().trim().email(),
    emails: z.undefined().optional(),
    text: z.undefined().optional(),
    reason: reasonSchema,
  }),
  // Array of emails
  z.object({
    email: z.undefined().optional(),
    emails: z.array(z.string().trim().email()).min(1).max(1000),
    text: z.undefined().optional(),
    reason: reasonSchema,
  }),
  // Textarea paste (newline/comma/semicolon separated)
  z.object({
    email: z.undefined().optional(),
    emails: z.undefined().optional(),
    text: z.string().min(1),
    reason: reasonSchema,
  }),
])

// ─── GET /api/v1/suppression ─────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const { data, error } = await supabase
      .from('suppression_list')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ suppressions: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[suppression GET]', error)
    captureApiException(error, { route: '/api/v1/suppression', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch suppression list' }, { status: 500 })
  }
}

// ─── POST /api/v1/suppression ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { reason } = parsed.data

    // Normalise emails from whichever input format was supplied
    let rawEmails: string[] = []
    if ('text' in parsed.data && parsed.data.text) {
      rawEmails = parsed.data.text.split(/[\n,;]+/)
    } else if ('emails' in parsed.data && parsed.data.emails) {
      rawEmails = parsed.data.emails
    } else if ('email' in parsed.data && parsed.data.email) {
      rawEmails = [parsed.data.email]
    }

    const emails = rawEmails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'))

    if (emails.length === 0) {
      return NextResponse.json({ error: 'No valid emails provided' }, { status: 400 })
    }

    const rows = emails.map((email) => ({ user_id: user.id, email, reason }))

    const { data, error } = await supabase
      .from('suppression_list')
      .upsert(rows, { onConflict: 'user_id,email', ignoreDuplicates: true })
      .select()

    if (error) throw error

    return NextResponse.json({ added: data?.length ?? 0 }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[suppression POST]', error)
    captureApiException(error, { route: '/api/v1/suppression', method: 'POST' })
    return NextResponse.json({ error: 'Failed to add to suppression list' }, { status: 500 })
  }
}
