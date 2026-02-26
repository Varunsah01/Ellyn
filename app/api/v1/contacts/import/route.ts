import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'
import { checkPlanLimit } from '@/lib/plan-limits'

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const contactSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  linkedin_url: z.string().trim().url().optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

const batchSchema = z.object({
  contacts: z.array(contactSchema).min(1).max(500),
})

type ContactInput = z.infer<typeof contactSchema>

// ─── POST /api/v1/contacts/import ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    // Rate limit: 5 imports/hour per user
    const rl = await checkApiRateLimit(`import:${user.id}`, 5, 3600)
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

    const supabase = await createServiceRoleClient()

    const body = await request.json()
    const parsed = batchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Enforce per-plan contact limit
    const { count: existingCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const existing = existingCount ?? 0
    const { allowed: planAllowed, limit: contactLimit, plan } = await checkPlanLimit(
      user.id,
      'contacts',
      existing
    )

    if (!planAllowed) {
      return NextResponse.json(
        {
          error: 'contact_limit_reached',
          limit: contactLimit,
          plan_type: plan,
          upgrade_url: '/dashboard/upgrade',
        },
        { status: 402 }
      )
    }

    // Trim the import batch to not exceed the limit
    if (contactLimit !== Infinity) {
      const incoming = parsed.data.contacts.length
      if (existing + incoming > contactLimit) {
        const allowed = contactLimit - existing
        parsed.data.contacts.splice(allowed)
      }
    }

    const result = { imported: 0, skipped: 0, errors: [] as { row: number; reason: string }[] }

    const validRows: {
      user_id: string
      first_name: string
      last_name: string
      company: string
      role: string | null
      inferred_email: string | null
      email_confidence: number | null
      linkedin_url: string | null
      location: string | null
      notes: string | null
      tags: string[]
      source: string
      status: string
    }[] = []

    for (let i = 0; i < parsed.data.contacts.length; i++) {
      const c: ContactInput = parsed.data.contacts[i]!

      validRows.push({
        user_id: user.id,
        first_name: c.first_name,
        last_name: c.last_name,
        company: c.company,
        role: c.role?.trim() || null,
        inferred_email: c.email?.trim() || null,
        email_confidence: c.email ? 70 : null,
        linkedin_url: c.linkedin_url?.trim() || null,
        location: c.location?.trim() || null,
        notes: c.notes?.trim() || null,
        tags: Array.isArray(c.tags) ? c.tags.filter(Boolean).slice(0, 10) : [],
        source: 'csv_import',
        status: 'new',
      })
    }

    const BATCH = 50
    for (let start = 0; start < validRows.length; start += BATCH) {
      const chunk = validRows.slice(start, start + BATCH)

      const { error, data } = await supabase
        .from('contacts')
        .upsert(chunk, {
          onConflict: 'user_id,first_name,last_name,company',
          ignoreDuplicates: true,
        })
        .select('id')

      if (error) {
        // Row-by-row fallback to collect individual errors
        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j]!
          const { error: rowError } = await supabase
            .from('contacts')
            .insert(row)
            .select('id')
            .single()

          if (rowError) {
            if (
              rowError.code === '23505' ||
              rowError.message?.includes('duplicate') ||
              rowError.message?.includes('unique')
            ) {
              result.skipped++
            } else {
              result.errors.push({ row: start + j + 1, reason: rowError.message })
            }
          } else {
            result.imported++
          }
        }
      } else {
        const inserted = data?.length ?? 0
        result.imported += inserted
        result.skipped += chunk.length - inserted
      }
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[contacts/import POST]', error)
    captureApiException(error, { route: '/api/v1/contacts/import', method: 'POST' })
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
