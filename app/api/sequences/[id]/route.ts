import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'

import { getAuthenticatedServiceRoleClient } from '@/lib/auth/api-user'
import { syncSequenceSteps } from '@/lib/sequences/contracts'
import { formatZodError } from '@/lib/validation/schemas'

type SequenceStatus = 'draft' | 'active' | 'paused' | 'archived'
type EnrollmentStatus =
  | 'active'
  | 'completed'
  | 'replied'
  | 'bounced'
  | 'unsubscribed'
  | 'removed'

type StoredSequenceStep = {
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
  status: SequenceStatus
  steps: unknown
  created_at: string
  updated_at: string
}

type EnrollmentRow = {
  id: string
  sequence_id: string
  contact_id: string
  user_id: string
  status: EnrollmentStatus
  current_step_index: number
  next_step_at: string | null
  enrolled_at: string
  completed_at: string | null
  contact: {
    id: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
    company: string | null
    role: string | null
    confirmed_email: string | null
    inferred_email: string | null
  } | null
}

type TrackingRow = {
  id: string
  draft_id: string | null
  contact_id: string | null
  event_type: string
  metadata: Record<string, unknown> | null
  occurred_at: string
}

const sequenceStatusSchema = z.enum(['draft', 'active', 'paused', 'archived', 'completed'])

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

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(3000).nullable().optional(),
    goal: z.string().trim().max(500).nullable().optional(),
    status: sequenceStatusSchema.optional(),
    steps: z.array(stepSchema).min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

const storedStepSchema = z.object({
  id: z.string().min(1),
  type: z.string().default('email'),
  delayDays: z.coerce.number().int().min(0).default(0),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateId: z.string().uuid().nullable().optional(),
})

function normalizeStoredSteps(raw: unknown): StoredSequenceStep[] {
  if (!Array.isArray(raw)) return []

  const parsed = z.array(storedStepSchema).safeParse(raw)
  if (!parsed.success) return []

  return parsed.data
}

function normalizeIncomingSteps(steps: z.infer<typeof stepSchema>[]): StoredSequenceStep[] {
  return steps.map((step, index) => ({
    id: step.id ?? `step_${index + 1}_${randomUUID().slice(0, 8)}`,
    type: step.type || 'email',
    delayDays: step.delayDays ?? step.delay_days ?? 0,
    subject: step.subject,
    body: step.body,
    templateId: step.templateId ?? step.template_id ?? null,
  }))
}

function normalizeStatus(status: z.infer<typeof sequenceStatusSchema>): SequenceStatus {
  if (status === 'completed') return 'archived'
  return status
}

function buildSyntheticEnrollmentSteps(
  enrollments: EnrollmentRow[],
  sequenceSteps: StoredSequenceStep[]
) {
  const synthetic: Array<{
    id: string
    enrollment_id: string
    step_id: string
    step_order: number
    scheduled_for: string
    status: 'pending' | 'sent' | 'skipped' | 'bounced' | 'replied'
    subject_override: null
    body_override: null
    sent_at: string | null
  }> = []

  for (const enrollment of enrollments) {
    for (let index = 0; index < sequenceSteps.length; index += 1) {
      const step = sequenceSteps[index]!

      const fallbackScheduled = new Date(enrollment.enrolled_at || new Date().toISOString())
      fallbackScheduled.setDate(fallbackScheduled.getDate() + step.delayDays)

      const isCurrentStep = index === enrollment.current_step_index
      const scheduledFor =
        isCurrentStep && enrollment.next_step_at
          ? enrollment.next_step_at
          : fallbackScheduled.toISOString()

      let status: 'pending' | 'sent' | 'skipped' | 'bounced' | 'replied' = 'pending'

      if (enrollment.status === 'completed') {
        status = 'sent'
      } else if (enrollment.status === 'active') {
        status = index < enrollment.current_step_index ? 'sent' : 'pending'
      } else if (enrollment.status === 'replied') {
        status = index < enrollment.current_step_index ? 'sent' : 'replied'
      } else if (enrollment.status === 'bounced') {
        status = index < enrollment.current_step_index ? 'sent' : 'bounced'
      } else {
        status = index < enrollment.current_step_index ? 'sent' : 'skipped'
      }

      synthetic.push({
        id: `${enrollment.id}:${step.id}`,
        enrollment_id: enrollment.id,
        step_id: step.id,
        step_order: index + 1,
        scheduled_for: scheduledFor,
        status,
        subject_override: null,
        body_override: null,
        sent_at: status === 'sent' ? scheduledFor : null,
      })
    }
  }

  return synthetic
}

function toClientStep(step: StoredSequenceStep, sequenceId: string, index: number) {
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

function toLegacyEnrollmentStatus(status: EnrollmentStatus): string {
  if (status === 'active') return 'in_progress'
  return status
}

function normalizeEnrollmentStatus(value: unknown): EnrollmentStatus {
  if (
    value === 'completed' ||
    value === 'replied' ||
    value === 'bounced' ||
    value === 'unsubscribed' ||
    value === 'removed'
  ) {
    return value
  }

  return 'active'
}

function normalizeEnrollmentRow(raw: any): EnrollmentRow {
  const contactRaw = Array.isArray(raw?.contact)
    ? raw.contact[0] ?? null
    : (raw?.contact ?? null)

  return {
    id: String(raw?.id ?? ''),
    sequence_id: String(raw?.sequence_id ?? ''),
    contact_id: String(raw?.contact_id ?? ''),
    user_id: String(raw?.user_id ?? ''),
    status: normalizeEnrollmentStatus(raw?.status),
    current_step_index: Number(raw?.current_step_index ?? 0),
    next_step_at:
      typeof raw?.next_step_at === 'string' ? raw.next_step_at : null,
    enrolled_at:
      typeof raw?.enrolled_at === 'string'
        ? raw.enrolled_at
        : new Date().toISOString(),
    completed_at:
      typeof raw?.completed_at === 'string' ? raw.completed_at : null,
    contact: contactRaw
      ? {
          id: String(contactRaw.id ?? ''),
          full_name:
            typeof contactRaw.full_name === 'string'
              ? contactRaw.full_name
              : null,
          first_name:
            typeof contactRaw.first_name === 'string'
              ? contactRaw.first_name
              : null,
          last_name:
            typeof contactRaw.last_name === 'string'
              ? contactRaw.last_name
              : null,
          company:
            typeof contactRaw.company === 'string' ? contactRaw.company : null,
          role: typeof contactRaw.role === 'string' ? contactRaw.role : null,
          confirmed_email:
            typeof contactRaw.confirmed_email === 'string'
              ? contactRaw.confirmed_email
              : null,
          inferred_email:
            typeof contactRaw.inferred_email === 'string'
              ? contactRaw.inferred_email
              : null,
        }
      : null,
  }
}

/**
 * Handle GET requests for `/api/sequences/[id]`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sequenceId = params.id

  const { data: sequence, error: sequenceError } = await supabase
    .from('sequences')
    .select('id, user_id, name, description, goal, status, steps, created_at, updated_at')
    .eq('id', sequenceId)
    .eq('user_id', user.id)
    .maybeSingle<SequenceRow>()

  if (sequenceError) {
    return NextResponse.json(
      { error: 'Failed to fetch sequence', details: sequenceError.message },
      { status: 500 }
    )
  }

  if (!sequence) {
    return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
  }

  const sequenceSteps = normalizeStoredSteps(sequence.steps)

  const [enrollmentResult, eventsResult] = await Promise.all([
    supabase
      .from('sequence_enrollments')
      .select(
        'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at, contact:contacts(id, full_name, first_name, last_name, company, role, confirmed_email, inferred_email)'
      )
      .eq('sequence_id', sequence.id)
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false }),
    supabase
      .from('email_tracking_events')
      .select('id, draft_id, contact_id, event_type, metadata, occurred_at')
      .eq('user_id', user.id)
      .eq('sequence_id', sequence.id)
      .order('occurred_at', { ascending: false })
      .limit(500),
  ])

  if (enrollmentResult.error) {
    return NextResponse.json(
      { error: 'Failed to fetch enrollments', details: enrollmentResult.error.message },
      { status: 500 }
    )
  }

  if (eventsResult.error) {
    return NextResponse.json(
      { error: 'Failed to fetch sequence events', details: eventsResult.error.message },
      { status: 500 }
    )
  }

  const normalizedEnrollments = (enrollmentResult.data ?? []).map((row) =>
    normalizeEnrollmentRow(row)
  )

  const enrollments = normalizedEnrollments.map((enrollment) => ({
    ...enrollment,
    status: toLegacyEnrollmentStatus(enrollment.status),
    current_step: enrollment.current_step_index,
    start_date: enrollment.enrolled_at,
  }))

  const enrollmentSteps = buildSyntheticEnrollmentSteps(normalizedEnrollments, sequenceSteps)

  const events = ((eventsResult.data ?? []) as TrackingRow[]).map((event) => {
    const metadata = (event.metadata ?? {}) as Record<string, unknown>

    return {
      id: event.id,
      enrollment_id:
        typeof metadata.enrollment_id === 'string' ? metadata.enrollment_id : null,
      step_id: typeof metadata.step_id === 'string' ? metadata.step_id : null,
      event_type: event.event_type,
      metadata,
      created_at: event.occurred_at,
    }
  })

  return NextResponse.json({
    sequence: {
      ...sequence,
      steps: sequenceSteps.map((step, index) => toClientStep(step, sequence.id, index)),
      createdAt: sequence.created_at,
      updatedAt: sequence.updated_at,
    },
    steps: sequenceSteps.map((step, index) => toClientStep(step, sequence.id, index)),
    enrollments,
    enrollmentSteps,
    events,
  })
}

/**
 * Handle PATCH requests for `/api/sequences/[id]`.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: formatZodError(parsed.error) },
      { status: 400 }
    )
  }

  const updatePayload: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name
  if (parsed.data.description !== undefined)
    updatePayload.description = parsed.data.description ?? null
  if (parsed.data.goal !== undefined) updatePayload.goal = parsed.data.goal ?? null
  if (parsed.data.status !== undefined)
    updatePayload.status = normalizeStatus(parsed.data.status)
  if (parsed.data.steps !== undefined)
    updatePayload.steps = normalizeIncomingSteps(parsed.data.steps)

  const { data: updated, error: updateError } = await supabase
    .from('sequences')
    .update(updatePayload)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, user_id, name, description, goal, status, steps, created_at, updated_at')
    .maybeSingle<SequenceRow>()

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update sequence', details: updateError.message },
      { status: 500 }
    )
  }

  if (!updated) {
    return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
  }

  const sequenceSteps = normalizeStoredSteps(updated.steps)

  if (parsed.data.steps !== undefined) {
    const syncResult = await syncSequenceSteps(supabase, updated.id, sequenceSteps)
    if (syncResult.error) {
      return NextResponse.json(
        { error: 'Failed to update sequence steps', details: syncResult.error.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    success: true,
    sequence: {
      ...updated,
      steps: sequenceSteps.map((step, index) => toClientStep(step, updated.id, index)),
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  })
}

/**
 * Handle DELETE requests for `/api/sequences/[id]`.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: deleted, error } = await supabase
    .from('sequences')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete sequence', details: error.message },
      { status: 500 }
    )
  }

  if (!deleted) {
    return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
