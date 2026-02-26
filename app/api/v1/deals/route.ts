import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'
import { computeLeadScore, type TrackingEvent, type ScoredContact } from '@/lib/lead-scoring'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'
import { checkPlanLimit } from '@/lib/plan-limits'

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_SORT_FIELDS = ['created_at', 'value', 'expected_close'] as const
type SortField = (typeof VALID_SORT_FIELDS)[number]

// Include scoring-relevant fields alongside the spec's contact shape
const CONTACT_SELECT =
  'id, first_name, last_name, company, inferred_email, linkedin_photo_url, ' +
  'email_verified, email_confidence, linkedin_url'

const DEAL_SELECT = `*, contact:contacts(${CONTACT_SELECT})`

// ─── Zod schema ───────────────────────────────────────────────────────────────

const CreateDealSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  contact_id: z.string().uuid().optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  stage: z
    .enum(['prospecting', 'contacted', 'interested', 'meeting', 'proposal', 'won', 'lost'])
    .default('prospecting'),
  probability: z.number().int().min(0).max(100).default(50),
  expected_close: z.string().date().optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(10).default([]),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseSortField(raw: string | null): SortField {
  if (raw && VALID_SORT_FIELDS.includes(raw as SortField)) return raw as SortField
  return 'created_at'
}

function parseSortDir(raw: string | null): boolean {
  return raw === 'asc'
}

function parsePositiveInt(raw: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

type DealContactRow = ScoredContact & {
  id: string
  first_name: string | null
  last_name: string | null
  company: string | null
  inferred_email: string | null
  linkedin_photo_url: string | null
}

type DealRow = Record<string, unknown> & {
  contact_id: string | null
  contact: DealContactRow | null
}

async function annotateDealScores(
  deals: DealRow[],
  userId: string,
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>
): Promise<Array<DealRow & { lead_score: ReturnType<typeof computeLeadScore> | null }>> {
  const contactIds = [...new Set(deals.filter((d) => d.contact_id).map((d) => d.contact_id as string))]

  const trackingByContact: Record<string, TrackingEvent[]> = {}

  if (contactIds.length > 0) {
    const { data: events } = await supabase
      .from('email_tracking_events')
      .select('contact_id, event_type, occurred_at')
      .eq('user_id', userId)
      .in('contact_id', contactIds)
      .order('occurred_at', { ascending: false })
      .limit(20 * contactIds.length)

    for (const evt of (events ?? []) as {
      contact_id: string
      event_type: string
      occurred_at: string
    }[]) {
      const bucket = trackingByContact[evt.contact_id] ?? []
      trackingByContact[evt.contact_id] = bucket
      if (bucket.length < 20) {
        bucket.push({ event_type: evt.event_type, occurred_at: evt.occurred_at })
      }
    }
  }

  return deals.map((deal) => {
    if (!deal.contact_id || !deal.contact) return { ...deal, lead_score: null }
    const events = trackingByContact[deal.contact_id] ?? []
    return { ...deal, lead_score: computeLeadScore(deal.contact, events) }
  })
}

// ─── GET /api/v1/deals ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePersona(request, 'smb_sales')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()
    const sp = request.nextUrl.searchParams

    const stageFilter = sp.get('stage')
    const search = sp.get('search')?.trim().slice(0, 100) ?? ''
    const sortBy = parseSortField(sp.get('sortBy'))
    const ascending = parseSortDir(sp.get('sortDir'))
    const page = parsePositiveInt(sp.get('page'), 1, 1, 100000)
    const limit = parsePositiveInt(sp.get('limit'), 20, 1, 100)
    const rangeStart = (page - 1) * limit
    const rangeEnd = page * limit - 1

    // Build main paginated query
    let query = supabase
      .from('deals')
      .select(DEAL_SELECT, { count: 'exact' })
      .eq('user_id', user.id)

    if (stageFilter) query = query.eq('stage', stageFilter)
    if (search) query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%`)

    query = query.order(sortBy, { ascending }).range(rangeStart, rangeEnd)

    // Aggregate pipeline totals (all non-won/lost, regardless of filters)
    const [listResult, pipelineResult] = await Promise.all([
      query,
      supabase
        .from('deals')
        .select('value, probability')
        .eq('user_id', user.id)
        .not('stage', 'in', '(won,lost)'),
    ])

    if (listResult.error) throw listResult.error

    const deals = (listResult.data ?? []) as unknown as DealRow[]
    const total = listResult.count ?? 0

    // Compute pipeline aggregates
    const pipelineRows = (pipelineResult.data ?? []) as { value: number | null; probability: number | null }[]
    const pipeline_value = pipelineRows.reduce((sum, r) => sum + (r.value ?? 0), 0)
    const weighted_value = pipelineRows.reduce(
      (sum, r) => sum + ((r.value ?? 0) * (r.probability ?? 0)) / 100,
      0
    )

    // Annotate each deal with lead score
    const dealsWithScores = await annotateDealScores(deals, user.id, supabase)

    return NextResponse.json({
      deals: dealsWithScores,
      total,
      pipeline_value,
      weighted_value,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[deals GET]', error)
    captureApiException(error, { route: '/api/v1/deals', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
  }
}

// ─── POST /api/v1/deals ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePersona(request, 'smb_sales')
    if (!guard.allowed) return guard.response

    const { user } = guard

    // Rate limit: 30 deal creates/hour per user
    const rl = await checkApiRateLimit(`deals-create:${user.id}`, 30, 3600)
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

    const body = await request.json()
    const parsed = CreateDealSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createServiceRoleClient()

    // Enforce per-plan deal limit via centralized checkPlanLimit
    const { count: dealCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { allowed: planAllowed, limit: dealLimit, plan } = await checkPlanLimit(
      user.id,
      'deals',
      dealCount ?? 0
    )

    if (!planAllowed) {
      return NextResponse.json(
        {
          error: 'deal_limit_reached',
          limit: dealLimit,
          plan_type: plan,
          upgrade_url: '/dashboard/upgrade',
        },
        { status: 402 }
      )
    }

    const { data, error } = await supabase
      .from('deals')
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        company: parsed.data.company,
        contact_id: parsed.data.contact_id ?? null,
        value: parsed.data.value ?? null,
        currency: parsed.data.currency,
        stage: parsed.data.stage,
        probability: parsed.data.probability,
        expected_close: parsed.data.expected_close ?? null,
        notes: parsed.data.notes ?? null,
        tags: parsed.data.tags,
      })
      .select(DEAL_SELECT)
      .single()

    if (error) throw error

    return NextResponse.json({ ...(data as Record<string, unknown>), lead_score: null }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[deals POST]', error)
    captureApiException(error, { route: '/api/v1/deals', method: 'POST' })
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }
}
