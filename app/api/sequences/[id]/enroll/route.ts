import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedServiceRoleClient } from '@/lib/auth/api-user'
import { formatZodError } from '@/lib/validation/schemas'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

type PlanType = 'free' | 'starter' | 'pro'

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
  status: 'draft' | 'active' | 'paused' | 'archived'
  steps: unknown
}

type ContactRow = {
  id: string
  user_id: string
  confirmed_email: string | null
  inferred_email: string | null
}

type EnrollmentRow = {
  id: string
  sequence_id: string
  contact_id: string
  user_id: string
  status: string
  current_step_index: number
  next_step_at: string | null
  enrolled_at: string
  completed_at: string | null
}

const enrollSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(500),
  startDate: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  skipSuppressed: z.boolean().default(true),
})

const storedStepSchema = z.object({
  id: z.string().min(1),
  type: z.string().default('email'),
  delayDays: z.coerce.number().int().min(0).default(0),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateId: z.string().uuid().nullable().optional(),
})

const enrollmentLimits: Record<PlanType, number> = {
  free: 50,
  starter: 500,
  pro: 2000,
}

function normalizeSteps(raw: unknown): StoredSequenceStep[] {
  if (!Array.isArray(raw)) return []
  const parsed = z.array(storedStepSchema).safeParse(raw)
  if (!parsed.success) return []
  return parsed.data
}

function resolvePlanType(value: unknown): PlanType {
  if (value === 'starter' || value === 'pro') return value
  return 'free'
}

function buildQuotaExceededResponse(feature: string, used: number, limit: number, planType: PlanType) {
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
 * Handle POST requests for `/api/sequences/[id]/enroll`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 10 enroll calls/hour per user
  const rl = await checkApiRateLimit(`enroll:${user.id}`, 10, 3600)
  if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

  const sequenceId = params.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = enrollSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: formatZodError(parsed.error) },
      { status: 400 }
    )
  }

  const { data: sequence, error: sequenceError } = await supabase
    .from('sequences')
    .select('id, user_id, status, steps')
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

  if (sequence.status !== 'active') {
    return NextResponse.json(
      { error: 'Sequence must be active before enrolling contacts' },
      { status: 400 }
    )
  }

  const sequenceSteps = normalizeSteps(sequence.steps)
  if (sequenceSteps.length === 0) {
    return NextResponse.json(
      { error: 'Sequence must include at least one step' },
      { status: 400 }
    )
  }

  const contactIds = Array.from(new Set(parsed.data.contactIds))

  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, user_id, confirmed_email, inferred_email')
    .eq('user_id', user.id)
    .in('id', contactIds)

  if (contactsError) {
    return NextResponse.json(
      { error: 'Failed to fetch contacts', details: contactsError.message },
      { status: 500 }
    )
  }

  const contactMap = new Map<string, ContactRow>()
  for (const contact of (contacts ?? []) as ContactRow[]) {
    contactMap.set(contact.id, contact)
  }

  const { data: existingActiveEnrollments, error: existingError } = await supabase
    .from('sequence_enrollments')
    .select('contact_id')
    .eq('sequence_id', sequenceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('contact_id', contactIds)

  if (existingError) {
    return NextResponse.json(
      { error: 'Failed to validate enrollments', details: existingError.message },
      { status: 500 }
    )
  }

  const existingActiveContactIds = new Set(
    (existingActiveEnrollments ?? []).map((row) => String(row.contact_id))
  )

  const contactEmails = (contacts ?? [])
    .map((contact) => contact.confirmed_email ?? contact.inferred_email)
    .filter((email): email is string => Boolean(email))
    .map((email) => email.trim().toLowerCase())

  let suppressedEmails = new Set<string>()

  if (contactEmails.length > 0) {
    const { data: suppressions, error: suppressionError } = await supabase
      .from('suppression_list')
      .select('email')
      .eq('user_id', user.id)
      .in('email', Array.from(new Set(contactEmails)))

    if (suppressionError) {
      return NextResponse.json(
        { error: 'Failed to validate suppression list', details: suppressionError.message },
        { status: 500 }
      )
    }

    suppressedEmails = new Set(
      (suppressions ?? [])
        .map((entry) => String(entry.email || '').trim().toLowerCase())
        .filter(Boolean)
    )
  }

  const skipped: Array<{ contactId: string; reason: string }> = []
  const warnings: Array<{ contactId: string; message: string }> = []
  const validContactIds: string[] = []

  for (const contactId of contactIds) {
    const contact = contactMap.get(contactId)

    if (!contact) {
      skipped.push({ contactId, reason: 'not_found_or_forbidden' })
      continue
    }

    if (existingActiveContactIds.has(contactId)) {
      skipped.push({ contactId, reason: 'already_enrolled' })
      continue
    }

    const email = (contact.confirmed_email ?? contact.inferred_email ?? '').trim().toLowerCase()
    if (parsed.data.skipSuppressed && email && suppressedEmails.has(email)) {
      skipped.push({ contactId, reason: 'suppressed' })
      continue
    }

    if (!email) {
      warnings.push({
        contactId,
        message: 'Contact has no email and may not be executable until email is available',
      })
    }

    validContactIds.push(contactId)
  }

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

  const planType = resolvePlanType(profile?.plan_type)

  const { count: activeEnrollmentCount, error: quotaCountError } = await supabase
    .from('sequence_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (quotaCountError) {
    return NextResponse.json(
      { error: 'Failed to evaluate enrollment quota', details: quotaCountError.message },
      { status: 500 }
    )
  }

  const used = Number(activeEnrollmentCount ?? 0)
  const limit = enrollmentLimits[planType]

  if (used + validContactIds.length > limit) {
    return buildQuotaExceededResponse('sequence_enrollments', used, limit, planType)
  }

  if (validContactIds.length === 0) {
    return NextResponse.json({
      enrolled: 0,
      skipped,
      warnings,
      enrollments: [] as EnrollmentRow[],
    })
  }

  const firstStep = sequenceSteps[0]!
  const startAt = parsed.data.startDate ? new Date(parsed.data.startDate) : new Date()
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
  }

  const nextStepAt = new Date(startAt)
  nextStepAt.setDate(nextStepAt.getDate() + (firstStep.delayDays ?? 0))

  const enrollmentPayload = validContactIds.map((contactId) => ({
    sequence_id: sequenceId,
    contact_id: contactId,
    user_id: user.id,
    status: 'active',
    current_step_index: 0,
    next_step_at: nextStepAt.toISOString(),
    enrolled_at: startAt.toISOString(),
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('sequence_enrollments')
    .insert(enrollmentPayload)
    .select(
      'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at'
    )

  if (insertError) {
    return NextResponse.json(
      { error: 'Failed to enroll contacts', details: insertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    enrolled: inserted?.length ?? 0,
    skipped,
    warnings,
    enrollments: (inserted ?? []) as EnrollmentRow[],
  })
}
