import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedServiceRoleClient } from '@/lib/auth/api-user'
import { sendEmailViaGmail } from '@/lib/gmail-send'
import { generateTrackingPixelUrl, injectTrackingPixel } from '@/lib/tracking'
import { fillVariables } from '@/lib/template-variables'
import { formatZodError } from '@/lib/validation/schemas'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

type StoredSequenceStep = {
  id: string
  type: string
  delayDays: number
  subject: string
  body: string
  templateId?: string | null
}

type EnrollmentRow = {
  id: string
  sequence_id: string
  contact_id: string
  user_id: string
  status: 'active' | 'completed' | 'replied' | 'bounced' | 'unsubscribed' | 'removed'
  current_step_index: number
  next_step_at: string | null
  enrolled_at: string
  completed_at: string | null
}

type SequenceRow = {
  id: string
  user_id: string
  name: string
  steps: unknown
}

type ContactRow = {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  company: string | null
  role: string | null
  confirmed_email: string | null
  inferred_email: string | null
}

type DueEnrollmentRow = EnrollmentRow & {
  contact: ContactRow | null
  sequence: {
    id: string
    name: string
    steps: unknown
  } | null
}

const executeSchema = z.object({
  enrollmentId: z.string().uuid().optional(),
  sendMode: z.enum(['compose', 'api']).default('compose'),
})

const legacyActionSchema = z
  .object({
    action: z.enum([
      'mark_sent',
      'skip_step',
      'mark_replied',
      'mark_bounced',
      'pause_enrollment',
      'resume_enrollment',
      'remove_enrollment',
    ]),
    enrollmentId: z.string().uuid().optional(),
    enrollmentStepId: z.string().min(1).optional(),
    sendMode: z.enum(['compose', 'api']).default('compose'),
  })
  .superRefine((value, ctx) => {
    if ((value.action === 'mark_sent' || value.action === 'skip_step') && !value.enrollmentStepId && !value.enrollmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'enrollmentId or enrollmentStepId is required for this action',
      })
    }

    if (
      ['mark_replied', 'mark_bounced', 'pause_enrollment', 'resume_enrollment', 'remove_enrollment'].includes(value.action) &&
      !value.enrollmentId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'enrollmentId is required for this action',
      })
    }
  })

const storedStepSchema = z.object({
  id: z.string().min(1),
  type: z.string().default('email'),
  delayDays: z.coerce.number().int().min(0).default(0),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateId: z.string().uuid().nullable().optional(),
})

function normalizeSteps(raw: unknown): StoredSequenceStep[] {
  if (!Array.isArray(raw)) return []

  const parsed = z.array(storedStepSchema).safeParse(raw)
  if (!parsed.success) return []

  return parsed.data
}

function normalizeEnrollmentStatus(value: unknown): EnrollmentRow['status'] {
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

function normalizeContactRow(raw: any): ContactRow | null {
  if (!raw) return null

  return {
    id: String(raw.id ?? ''),
    user_id: String(raw.user_id ?? ''),
    first_name: typeof raw.first_name === 'string' ? raw.first_name : null,
    last_name: typeof raw.last_name === 'string' ? raw.last_name : null,
    full_name: typeof raw.full_name === 'string' ? raw.full_name : null,
    company: typeof raw.company === 'string' ? raw.company : null,
    role: typeof raw.role === 'string' ? raw.role : null,
    confirmed_email:
      typeof raw.confirmed_email === 'string' ? raw.confirmed_email : null,
    inferred_email:
      typeof raw.inferred_email === 'string' ? raw.inferred_email : null,
  }
}

function normalizeDueEnrollmentRow(raw: any): DueEnrollmentRow | null {
  if (!raw) return null

  const contactRaw = Array.isArray(raw.contact) ? raw.contact[0] ?? null : raw.contact ?? null
  const sequenceRaw = Array.isArray(raw.sequence) ? raw.sequence[0] ?? null : raw.sequence ?? null

  if (!sequenceRaw) return null

  return {
    id: String(raw.id ?? ''),
    sequence_id: String(raw.sequence_id ?? ''),
    contact_id: String(raw.contact_id ?? ''),
    user_id: String(raw.user_id ?? ''),
    status: normalizeEnrollmentStatus(raw.status),
    current_step_index: Number(raw.current_step_index ?? 0),
    next_step_at: typeof raw.next_step_at === 'string' ? raw.next_step_at : null,
    enrolled_at:
      typeof raw.enrolled_at === 'string' ? raw.enrolled_at : new Date().toISOString(),
    completed_at: typeof raw.completed_at === 'string' ? raw.completed_at : null,
    contact: normalizeContactRow(contactRaw),
    sequence: {
      id: String(sequenceRaw.id ?? ''),
      name: String(sequenceRaw.name ?? 'Sequence'),
      steps: sequenceRaw.steps,
    },
  }
}

function getContactEmail(contact: ContactRow): string {
  return (contact.confirmed_email || contact.inferred_email || '').trim()
}

function buildEmailLinks(email: string, subject: string, body: string) {
  return {
    gmailLink: `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    outlookLink: `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(email)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  }
}

async function createDraft(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServiceRoleClient>>['supabase'],
  payload: {
    userId: string
    contactId: string
    templateId: string | null | undefined
    subject: string
    body: string
    scheduledFor: string
  }
): Promise<{ id: string } | null> {
  const baseInsert = {
    user_id: payload.userId,
    contact_id: payload.contactId,
    template_id: payload.templateId ?? null,
    subject: payload.subject,
    body: payload.body,
    status: 'scheduled',
    scheduled_for: payload.scheduledFor,
  }

  const inserted = await supabase
    .from('ai_drafts')
    .insert(baseInsert)
    .select('id')
    .maybeSingle<{ id: string }>()

  if (!inserted.error && inserted.data) {
    return inserted.data
  }

  const fallback = await supabase
    .from('ai_drafts')
    .insert({
      user_id: payload.userId,
      contact_id: payload.contactId,
      subject: payload.subject,
      body: payload.body,
      status: 'draft',
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (fallback.error || !fallback.data) return null
  return fallback.data
}

async function fetchEnrollmentBundle(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServiceRoleClient>>['supabase'],
  userId: string,
  enrollmentId: string
) {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('sequence_enrollments')
    .select('id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at')
    .eq('id', enrollmentId)
    .eq('user_id', userId)
    .maybeSingle<EnrollmentRow>()

  if (enrollmentError) {
    throw new Error(enrollmentError.message)
  }

  if (!enrollment) {
    return null
  }

  const [sequenceResult, contactResult] = await Promise.all([
    supabase
      .from('sequences')
      .select('id, user_id, name, steps')
      .eq('id', enrollment.sequence_id)
      .eq('user_id', userId)
      .maybeSingle<SequenceRow>(),
    supabase
      .from('contacts')
      .select(
        'id, user_id, first_name, last_name, full_name, company, role, confirmed_email, inferred_email'
      )
      .eq('id', enrollment.contact_id)
      .eq('user_id', userId)
      .maybeSingle<ContactRow>(),
  ])

  if (sequenceResult.error) throw new Error(sequenceResult.error.message)
  if (contactResult.error) throw new Error(contactResult.error.message)

  if (!sequenceResult.data || !contactResult.data) {
    return null
  }

  return {
    enrollment,
    sequence: sequenceResult.data,
    contact: contactResult.data,
  }
}

function nextStepTimeFromNow(delayDays: number): string {
  const next = new Date()
  next.setDate(next.getDate() + Math.max(0, delayDays || 0))
  return next.toISOString()
}

async function executeEnrollment(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServiceRoleClient>>['supabase'],
  userId: string,
  enrollmentId: string,
  sendMode: 'compose' | 'api' = 'compose'
) {
  // Early check for api mode: verify Gmail is connected before doing any work
  if (sendMode === 'api') {
    const { data: gmailCreds } = await supabase
      .from('gmail_credentials')
      .select('gmail_email')
      .eq('user_id', userId)
      .maybeSingle()

    if (!gmailCreds) {
      return NextResponse.json(
        {
          error: 'Gmail not connected. Connect Gmail in Settings to send directly.',
          code: 'gmail_not_connected',
        },
        { status: 400 }
      )
    }
  }

  const bundle = await fetchEnrollmentBundle(supabase, userId, enrollmentId)
  if (!bundle) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const { enrollment, sequence, contact } = bundle

  if (enrollment.status !== 'active') {
    return NextResponse.json(
      { error: 'Enrollment is not active' },
      { status: 400 }
    )
  }

  const nowIso = new Date().toISOString()
  if (enrollment.next_step_at && enrollment.next_step_at > nowIso) {
    return NextResponse.json(
      { error: 'Next step is not due yet' },
      { status: 400 }
    )
  }

  const steps = normalizeSteps(sequence.steps)
  const currentStep = steps[enrollment.current_step_index]

  if (!currentStep) {
    const { data: completedEnrollment, error: completeError } = await supabase
      .from('sequence_enrollments')
      .update({
        status: 'completed',
        completed_at: nowIso,
        next_step_at: null,
      })
      .eq('id', enrollment.id)
      .eq('user_id', userId)
      .select(
        'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at'
      )
      .single<EnrollmentRow>()

    if (completeError) {
      return NextResponse.json(
        { error: 'Failed to complete enrollment', details: completeError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      gmailLink: null,
      outlookLink: null,
      subject: null,
      body: null,
      draft_id: null,
      enrollment_status: 'completed',
      enrollment: completedEnrollment,
    })
  }

  const email = getContactEmail(contact)
  if (!email) {
    return NextResponse.json(
      { error: 'Contact has no email address' },
      { status: 400 }
    )
  }

  const vars = {
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    company: contact.company || '',
    role: contact.role || '',
    firstName: contact.first_name || '',
    lastName: contact.last_name || '',
  }

  const subject = fillVariables(currentStep.subject, vars)
  const body = fillVariables(currentStep.body, vars)

  const draft = await createDraft(supabase, {
    userId,
    contactId: contact.id,
    templateId: currentStep.templateId ?? null,
    subject,
    body,
    scheduledFor: nowIso,
  })

  if (!draft) {
    return NextResponse.json(
      { error: 'Failed to create draft for sequence step' },
      { status: 500 }
    )
  }

  const pixelUrl = generateTrackingPixelUrl({
    draftId: draft.id,
    userId,
    contactId: contact.id,
  })
  const trackedBody = injectTrackingPixel(body, pixelUrl)
  const links = buildEmailLinks(email, subject, trackedBody)

  const nextIndex = enrollment.current_step_index + 1
  const isLastStep = nextIndex >= steps.length

  let updatedEnrollment: EnrollmentRow | null = null

  if (isLastStep) {
    const { data, error } = await supabase
      .from('sequence_enrollments')
      .update({
        status: 'completed',
        completed_at: nowIso,
        current_step_index: nextIndex,
        next_step_at: null,
      })
      .eq('id', enrollment.id)
      .eq('user_id', userId)
      .select(
        'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at'
      )
      .single<EnrollmentRow>()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update enrollment', details: error.message },
        { status: 500 }
      )
    }

    updatedEnrollment = data
  } else {
    const nextStep = steps[nextIndex]!
    const nextStepAt = nextStepTimeFromNow(nextStep.delayDays)

    const { data, error } = await supabase
      .from('sequence_enrollments')
      .update({
        current_step_index: nextIndex,
        next_step_at: nextStepAt,
      })
      .eq('id', enrollment.id)
      .eq('user_id', userId)
      .select(
        'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at'
      )
      .single<EnrollmentRow>()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update enrollment', details: error.message },
        { status: 500 }
      )
    }

    updatedEnrollment = data
  }

  const contactUpdatePayload: Record<string, unknown> = {
    status: 'contacted',
    last_contacted_at: nowIso,
  }

  if (Object.prototype.hasOwnProperty.call(contact, 'response_received')) {
    contactUpdatePayload.response_received = false
  }

  await supabase
    .from('contacts')
    .update(contactUpdatePayload)
    .eq('id', contact.id)
    .eq('user_id', userId)

  // In compose mode, log tracking event now; api mode logs after successful send
  if (sendMode !== 'api') {
    await supabase.from('email_tracking_events').insert({
      user_id: userId,
      draft_id: draft.id,
      contact_id: contact.id,
      sequence_id: sequence.id,
      event_type: 'sent',
      metadata: {
        enrollment_id: enrollment.id,
        step_id: currentStep.id,
        step_index: enrollment.current_step_index,
      },
    })
  }

  if (sendMode === 'api') {
    const sendResult = await sendEmailViaGmail({
      userId,
      to: email,
      subject,
      body: trackedBody,
      contactId: contact.id,
      isHtml: true,
    })

    if (!sendResult.success) {
      if (sendResult.code === 'gmail_reauth_required' || sendResult.code === 'gmail_not_connected') {
        return NextResponse.json(
          { error: sendResult.error, code: sendResult.code },
          { status: sendResult.code === 'gmail_not_connected' ? 400 : 401 }
        )
      }
      return NextResponse.json(
        { error: sendResult.error || 'Failed to send email via Gmail' },
        { status: 500 }
      )
    }

    void supabase
      .from('email_tracking_events')
      .insert({
        user_id: userId,
        draft_id: draft.id,
        contact_id: contact.id,
        sequence_id: sequence.id,
        event_type: 'sent',
        metadata: {
          gmail_message_id: sendResult.messageId,
          enrollment_id: enrollment.id,
          step_index: enrollment.current_step_index,
          send_mode: 'api',
        },
      })
      .then(({ error: trackErr }) => {
        if (trackErr) console.error('[sequences/execute] Failed to log sent event:', trackErr)
      })

    void supabase
      .from('ai_drafts')
      .update({ status: 'sent' })
      .eq('id', draft.id)
      .then(({ error: draftErr }) => {
        if (draftErr) console.error('[sequences/execute] Failed to update draft status:', draftErr)
      })

    void supabase
      .from('contacts')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', contact.id)
      .eq('user_id', userId)
      .in('status', ['discovered', 'new'])
      .then(({ error: contactErr }) => {
        if (contactErr) console.error('[sequences/execute] Failed to update contact status:', contactErr)
      })

    return NextResponse.json({
      success: true,
      sent: true,
      messageId: sendResult.messageId,
      gmailLink: null,
      outlookLink: null,
      subject,
      body: trackedBody,
      draft_id: draft.id,
      enrollment_status: updatedEnrollment?.status ?? 'active',
      enrollment: updatedEnrollment,
    })
  }

  return NextResponse.json({
    gmailLink: links.gmailLink,
    outlookLink: links.outlookLink,
    subject,
    body,
    draft_id: draft.id,
    enrollment_status: updatedEnrollment?.status ?? 'active',
    enrollment: updatedEnrollment,
  })
}

async function listDueSteps(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServiceRoleClient>>['supabase'],
  userId: string
) {
  const { data: dueRows, error } = await supabase
    .from('sequence_enrollments')
    .select(
      'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at, contact:contacts(id, user_id, first_name, last_name, full_name, company, role, confirmed_email, inferred_email), sequence:sequences(id, name, steps)'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('next_step_at', new Date().toISOString())
    .order('next_step_at', { ascending: true })
    .limit(50)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch due sequence steps', details: error.message },
      { status: 500 }
    )
  }

  const normalizedDueRows = (dueRows ?? [])
    .map((row) => normalizeDueEnrollmentRow(row))
    .filter((row): row is DueEnrollmentRow => Boolean(row))

  const items = normalizedDueRows
    .map((entry) => {
      const contact = entry.contact
      const sequence = entry.sequence
      if (!contact || !sequence) return null

      const steps = normalizeSteps(sequence.steps)
      const currentStep = steps[entry.current_step_index]
      if (!currentStep) return null

      const email = getContactEmail(contact)
      if (!email) return null

      const vars = {
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        company: contact.company || '',
        role: contact.role || '',
        firstName: contact.first_name || '',
        lastName: contact.last_name || '',
      }

      const subject = fillVariables(currentStep.subject, vars)
      const body = fillVariables(currentStep.body, vars)
      const links = buildEmailLinks(email, subject, body)

      return {
        enrollmentId: entry.id,
        enrollmentStepId: entry.id,
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        contactId: contact.id,
        contactName:
          contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        contactEmail: email,
        subject,
        body,
        gmailLink: links.gmailLink,
        outlookLink: links.outlookLink,
        scheduledFor: entry.next_step_at,
        currentStepIndex: entry.current_step_index,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return NextResponse.json({ items })
}

async function skipEnrollmentStep(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServiceRoleClient>>['supabase'],
  userId: string,
  enrollmentId: string
) {
  const bundle = await fetchEnrollmentBundle(supabase, userId, enrollmentId)
  if (!bundle) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const { enrollment, sequence } = bundle
  if (enrollment.status !== 'active') {
    return NextResponse.json({ error: 'Enrollment is not active' }, { status: 400 })
  }

  const steps = normalizeSteps(sequence.steps)
  const nextIndex = enrollment.current_step_index + 1
  const isLastStep = nextIndex >= steps.length

  const payload: Record<string, unknown> = isLastStep
    ? {
        status: 'completed',
        completed_at: new Date().toISOString(),
        current_step_index: nextIndex,
        next_step_at: null,
      }
    : {
        current_step_index: nextIndex,
        next_step_at: nextStepTimeFromNow(steps[nextIndex]!.delayDays),
      }

  const { data, error } = await supabase
    .from('sequence_enrollments')
    .update(payload)
    .eq('id', enrollment.id)
    .eq('user_id', userId)
    .select(
      'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at'
    )
    .single<EnrollmentRow>()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update enrollment', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, enrollment: data })
}

async function setEnrollmentStatus(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServiceRoleClient>>['supabase'],
  userId: string,
  enrollmentId: string,
  status: EnrollmentRow['status']
) {
  const completionTime = ['completed', 'replied', 'bounced', 'removed', 'unsubscribed'].includes(status)
    ? new Date().toISOString()
    : null

  const { data, error } = await supabase
    .from('sequence_enrollments')
    .update({
      status,
      completed_at: completionTime,
      next_step_at: status === 'active' ? undefined : null,
    })
    .eq('id', enrollmentId)
    .eq('user_id', userId)
    .select(
      'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at'
    )
    .maybeSingle<EnrollmentRow>()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update enrollment', details: error.message },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, enrollment: data })
}

/**
 * Handle GET requests for `/api/sequences/execute`.
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return listDueSteps(supabase, user.id)
}

/**
 * Handle POST requests for `/api/sequences/execute`.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 60 execute calls/hour per user
  const rl = await checkApiRateLimit(`execute:${user.id}`, 60, 3600)
  if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    Object.prototype.hasOwnProperty.call(body, 'action')
  ) {
    const parsedLegacy = legacyActionSchema.safeParse(body)
    if (!parsedLegacy.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsedLegacy.error) },
        { status: 400 }
      )
    }

    const { action, enrollmentId, enrollmentStepId } = parsedLegacy.data
    const enrollmentIdFromStep =
      enrollmentStepId && enrollmentStepId.includes(':')
        ? enrollmentStepId.split(':')[0]
        : enrollmentStepId
    const targetEnrollmentId = enrollmentId || enrollmentIdFromStep

    if (!targetEnrollmentId || !z.string().uuid().safeParse(targetEnrollmentId).success) {
      return NextResponse.json({ error: 'Enrollment id is required' }, { status: 400 })
    }

    if (action === 'mark_sent') {
      return executeEnrollment(supabase, user.id, targetEnrollmentId, parsedLegacy.data.sendMode)
    }

    if (action === 'skip_step') {
      return skipEnrollmentStep(supabase, user.id, targetEnrollmentId)
    }

    if (action === 'mark_replied') {
      const statusResponse = await setEnrollmentStatus(
        supabase,
        user.id,
        targetEnrollmentId,
        'replied'
      )

      void (async () => {
        const bundle = await fetchEnrollmentBundle(supabase, user.id, targetEnrollmentId)
        if (!bundle) return

        await supabase.from('contacts').update({ status: 'replied', response_received: true }).eq('id', bundle.contact.id).eq('user_id', user.id)
        await supabase.from('email_tracking_events').insert({
          user_id: user.id,
          contact_id: bundle.contact.id,
          sequence_id: bundle.sequence.id,
          event_type: 'replied',
          metadata: { enrollment_id: targetEnrollmentId },
        })
      })().catch(console.error)

      return statusResponse
    }

    if (action === 'mark_bounced') {
      const statusResponse = await setEnrollmentStatus(
        supabase,
        user.id,
        targetEnrollmentId,
        'bounced'
      )

      void (async () => {
        try {
          await supabase.from('email_tracking_events').insert({
            user_id: user.id,
            sequence_id: null,
            event_type: 'bounced',
            metadata: { enrollment_id: targetEnrollmentId },
          })
        } catch (error) {
          console.error(error)
        }
      })()

      return statusResponse
    }

    if (action === 'pause_enrollment') {
      return setEnrollmentStatus(supabase, user.id, targetEnrollmentId, 'unsubscribed')
    }

    if (action === 'resume_enrollment') {
      return setEnrollmentStatus(supabase, user.id, targetEnrollmentId, 'active')
    }

    if (action === 'remove_enrollment') {
      return setEnrollmentStatus(supabase, user.id, targetEnrollmentId, 'removed')
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const parsed = executeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: formatZodError(parsed.error) },
      { status: 400 }
    )
  }

  if (!parsed.data.enrollmentId) {
    return listDueSteps(supabase, user.id)
  }

  return executeEnrollment(supabase, user.id, parsed.data.enrollmentId, parsed.data.sendMode)
}
