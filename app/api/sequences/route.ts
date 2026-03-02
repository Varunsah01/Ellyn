import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'

import { getAuthenticatedServiceRoleClient } from '@/lib/auth/api-user'
import { formatZodError } from '@/lib/validation/schemas'

type PlanType = 'free' | 'starter' | 'pro'

type SequenceStepJson = {
  id: string
  type: string
  delayDays: number
  subject: string
  body: string
  templateId?: string | null
}

type SequenceRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  goal: string | null
  status: 'draft' | 'active' | 'paused' | 'archived'
  steps: SequenceStepJson[] | null
  created_at: string
  updated_at: string
}

type SequenceEnrollmentRow = {
  id: string
  sequence_id: string
  contact_id: string
  status: string
}

type SequenceTrackingEventRow = {
  sequence_id: string | null
  event_type: 'sent' | 'opened' | 'replied' | 'bounced'
}

const sequenceStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])

const stepSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  type: z.string().min(1).max(50).default('email'),
  delayDays: z.coerce.number().int().min(0).max(3650).optional(),
  delay_days: z.coerce.number().int().min(0).max(3650).optional(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  templateId: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
})

const createSequenceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(3000).optional().nullable(),
  goal: z.string().trim().max(500).optional().nullable(),
  status: sequenceStatusSchema.default('draft'),
  steps: z.array(stepSchema).min(1).max(100),
})

const searchParamsSchema = z.object({
  search: z.string().trim().max(100).optional(),
})

const planSequenceLimits: Record<PlanType, number> = {
  free: 3,
  starter: 10,
  pro: Number.POSITIVE_INFINITY,
}

function normalizeSequenceStep(
  step: z.infer<typeof stepSchema>,
  index: number
): SequenceStepJson {
  const delayDays = step.delayDays ?? step.delay_days ?? 0

  return {
    id: step.id ?? `step_${index + 1}_${randomUUID().slice(0, 8)}`,
    type: step.type || 'email',
    delayDays,
    subject: step.subject,
    body: step.body,
    templateId: step.templateId ?? step.template_id ?? null,
  }
}

function normalizeSequenceSteps(rawSteps: unknown): SequenceStepJson[] {
  if (!Array.isArray(rawSteps)) return []

  const normalized: SequenceStepJson[] = []
  for (let index = 0; index < rawSteps.length; index += 1) {
    const parsed = stepSchema.safeParse(rawSteps[index])
    if (!parsed.success) continue
    normalized.push(normalizeSequenceStep(parsed.data, index))
  }

  return normalized
}

function toClientSequenceStep(step: SequenceStepJson, sequenceId: string, index: number) {
  return {
    id: step.id,
    sequence_id: sequenceId,
    order: index + 1,
    type: step.type,
    delayDays: step.delayDays,
    delay_days: step.delayDays,
    templateId: step.templateId ?? null,
    template_id: step.templateId ?? null,
    subject: step.subject,
    body: step.body,
    status: 'active' as const,
  }
}

function buildSequenceStats(
  enrollments: SequenceEnrollmentRow[],
  events: SequenceTrackingEventRow[]
) {
  const emailsSent = events.filter((event) => event.event_type === 'sent').length
  const opened = events.filter((event) => event.event_type === 'opened').length
  const replied = events.filter((event) => event.event_type === 'replied').length
  const bounced = events.filter((event) => event.event_type === 'bounced').length
  const totalContacts = enrollments.length
  const inProgress = enrollments.filter((enrollment) => enrollment.status === 'active').length
  const completed = enrollments.filter((enrollment) => enrollment.status === 'completed').length

  return {
    totalContacts,
    emailsSent,
    opened,
    replied,
    bounced,
    unsubscribed: enrollments.filter((enrollment) => enrollment.status === 'unsubscribed').length,
    inProgress,
    completionRate: totalContacts > 0 ? Math.round((completed / totalContacts) * 100) : 0,
  }
}

function toClientSequence(
  sequence: SequenceRow,
  enrollments: SequenceEnrollmentRow[],
  events: SequenceTrackingEventRow[]
) {
  const normalizedSteps = normalizeSequenceSteps(sequence.steps)

  return {
    ...sequence,
    status: sequence.status,
    steps: normalizedSteps.map((step, index) =>
      toClientSequenceStep(step, sequence.id, index)
    ),
    contacts: enrollments.map((enrollment) => enrollment.contact_id),
    stats: buildSequenceStats(enrollments, events),
    createdAt: sequence.created_at,
    updatedAt: sequence.updated_at,
  }
}

function quotaExceededResponse(feature: string, used: number, limit: number, planType: PlanType) {
  return NextResponse.json(
    {
      error: 'quota_exceeded',
      feature,
      used,
      limit,
      plan_type: planType,
      upgrade_url: '/dashboard/upgrade',
    },
    { status: 402 }
  )
}

/**
 * Handle GET requests for `/api/sequences`.
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsedQuery = searchParamsSchema.safeParse({
    search: request.nextUrl.searchParams.get('search') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: formatZodError(parsedQuery.error) },
      { status: 400 }
    )
  }

  const search = parsedQuery.data.search?.toLowerCase() ?? ''

  const { data: sequences, error: sequenceError } = await supabase
    .from('sequences')
    .select('id, user_id, name, description, goal, status, steps, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (sequenceError) {
    return NextResponse.json(
      { error: 'Failed to fetch sequences', details: sequenceError.message },
      { status: 500 }
    )
  }

  const sequenceRows = (sequences ?? []) as SequenceRow[]
  const sequenceIds = sequenceRows.map((sequence) => sequence.id)

  let enrollments: SequenceEnrollmentRow[] = []
  let events: SequenceTrackingEventRow[] = []

  if (sequenceIds.length > 0) {
    const [enrollmentResult, eventResult] = await Promise.all([
      supabase
        .from('sequence_enrollments')
        .select('id, sequence_id, contact_id, status')
        .eq('user_id', user.id)
        .in('sequence_id', sequenceIds),
      supabase
        .from('email_tracking_events')
        .select('sequence_id, event_type')
        .eq('user_id', user.id)
        .in('sequence_id', sequenceIds)
        .in('event_type', ['sent', 'opened', 'replied', 'bounced']),
    ])

    if (enrollmentResult.error) {
      return NextResponse.json(
        { error: 'Failed to fetch enrollments', details: enrollmentResult.error.message },
        { status: 500 }
      )
    }

    if (eventResult.error) {
      return NextResponse.json(
        { error: 'Failed to fetch sequence events', details: eventResult.error.message },
        { status: 500 }
      )
    }

    enrollments = (enrollmentResult.data ?? []) as SequenceEnrollmentRow[]
    events = (eventResult.data ?? []) as SequenceTrackingEventRow[]
  }

  const enrollmentsBySequence = new Map<string, SequenceEnrollmentRow[]>()
  for (const enrollment of enrollments) {
    const items = enrollmentsBySequence.get(enrollment.sequence_id) ?? []
    items.push(enrollment)
    enrollmentsBySequence.set(enrollment.sequence_id, items)
  }

  const eventsBySequence = new Map<string, SequenceTrackingEventRow[]>()
  for (const event of events) {
    if (!event.sequence_id) continue
    const items = eventsBySequence.get(event.sequence_id) ?? []
    items.push(event)
    eventsBySequence.set(event.sequence_id, items)
  }

  const enriched = sequenceRows
    .map((sequence) =>
      toClientSequence(
        sequence,
        enrollmentsBySequence.get(sequence.id) ?? [],
        eventsBySequence.get(sequence.id) ?? []
      )
    )
    .filter((sequence) => {
      if (!search) return true
      const haystack = `${sequence.name} ${sequence.description ?? ''}`.toLowerCase()
      return haystack.includes(search)
    })

  return NextResponse.json({ sequences: enriched })
}

/**
 * Handle POST requests for `/api/sequences`.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = createSequenceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: formatZodError(parsed.error) },
      { status: 400 }
    )
  }

  const normalizedSteps = parsed.data.steps.map((step, index) =>
    normalizeSequenceStep(step, index)
  )

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('plan_type')
    .eq('id', user.id)
    .maybeSingle<{ plan_type: PlanType | null }>()

  if (profileError) {
    return NextResponse.json(
      { error: 'Failed to fetch user profile', details: profileError.message },
      { status: 500 }
    )
  }

  const planType: PlanType =
    profile?.plan_type === 'starter' || profile?.plan_type === 'pro'
      ? profile.plan_type
      : 'free'

  const { count, error: countError } = await supabase
    .from('sequences')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return NextResponse.json(
      { error: 'Failed to evaluate quota', details: countError.message },
      { status: 500 }
    )
  }

  const used = Number(count ?? 0)
  const limit = planSequenceLimits[planType]

  if (Number.isFinite(limit) && used >= limit) {
    return quotaExceededResponse('sequences', used, limit, planType)
  }

  const { data: created, error: createError } = await supabase
    .from('sequences')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      goal: parsed.data.goal ?? null,
      status: parsed.data.status,
      steps: normalizedSteps,
    })
    .select('id, user_id, name, description, goal, status, steps, created_at, updated_at')
    .single<SequenceRow>()

  if (createError || !created) {
    return NextResponse.json(
      { error: 'Failed to create sequence', details: createError?.message },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      sequence: toClientSequence(created, [], []),
    },
    { status: 201 }
  )
}
