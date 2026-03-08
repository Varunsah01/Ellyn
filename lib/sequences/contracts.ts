import { randomUUID } from 'crypto'
import { z } from 'zod'

export const SequenceStepTypeSchema = z.enum(['email', 'wait', 'condition', 'task'])

export const CompatibleSequenceStepSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  step_order: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  step_name: z.string().trim().max(200).optional(),
  step_type: SequenceStepTypeSchema.optional(),
  stepType: SequenceStepTypeSchema.optional(),
  type: SequenceStepTypeSchema.optional(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(20000),
  delay_days: z.number().int().min(0).max(3650).optional(),
  delayDays: z.number().int().min(0).max(3650).optional(),
  template_id: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  stop_on_reply: z.boolean().optional(),
  stop_on_bounce: z.boolean().optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  send_on_days: z.array(z.number().int().min(0).max(6)).optional(),
  send_from_hour: z.number().int().min(0).max(23).optional(),
  send_to_hour: z.number().int().min(0).max(23).optional(),
  condition_type: z.string().trim().max(120).nullable().optional(),
})

export type CompatibleSequenceStepInput = z.infer<typeof CompatibleSequenceStepSchema>

export const StoredSequenceStepSchema = z.object({
  id: z.string().min(1),
  type: z.string().default('email'),
  delayDays: z.coerce.number().int().min(0).default(0),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateId: z.string().uuid().nullable().optional(),
  stopOnReply: z.boolean().optional(),
  stopOnBounce: z.boolean().optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
})

export type StoredSequenceStep = z.infer<typeof StoredSequenceStepSchema>

type NormalizedSequenceStepRow = {
  id: string | null
  step_order: number | null
  delay_days: number | null
  template_id: string | null
  subject: string | null
  body: string | null
  stop_on_reply: boolean | null
  stop_on_bounce: boolean | null
  attachments: unknown
}

export function normalizeIncomingSequenceStep(
  step: CompatibleSequenceStepInput,
  index: number
): StoredSequenceStep {
  return {
    id: step.id ?? `step_${index + 1}_${randomUUID().slice(0, 8)}`,
    type: step.type ?? step.stepType ?? step.step_type ?? 'email',
    delayDays: step.delayDays ?? step.delay_days ?? 0,
    subject: step.subject,
    body: step.body,
    templateId: step.templateId ?? step.template_id ?? null,
    stopOnReply: step.stop_on_reply ?? true,
    stopOnBounce: step.stop_on_bounce ?? true,
    attachments: Array.isArray(step.attachments) ? step.attachments : [],
  }
}

export function normalizeIncomingSequenceSteps(
  steps: CompatibleSequenceStepInput[]
): StoredSequenceStep[] {
  return steps.map((step, index) => normalizeIncomingSequenceStep(step, index))
}

export function normalizeStoredSequenceSteps(raw: unknown): StoredSequenceStep[] {
  if (!Array.isArray(raw)) return []
  const parsed = z.array(StoredSequenceStepSchema).safeParse(raw)
  return parsed.success ? parsed.data : []
}

export function normalizeSequenceStepRows(rows: NormalizedSequenceStepRow[]): StoredSequenceStep[] {
  return rows
    .map((row, index) => ({
      id: row.id ?? `step_${index + 1}`,
      type: 'email',
      delayDays: Math.max(0, Number(row.delay_days ?? 0)),
      subject: row.subject ?? '',
      body: row.body ?? '',
      templateId: row.template_id ?? null,
      stopOnReply: row.stop_on_reply ?? true,
      stopOnBounce: row.stop_on_bounce ?? true,
      attachments: Array.isArray(row.attachments)
        ? (row.attachments as Array<Record<string, unknown>>)
        : [],
      order: row.step_order ?? index,
    }))
    .filter((row) => row.subject.trim().length > 0 || row.body.trim().length > 0)
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map(({ order: _order, ...row }) => row)
}

export function getPrimaryContactEmail(contact: {
  confirmed_email?: string | null
  inferred_email?: string | null
}): string | null {
  const email = contact.confirmed_email ?? contact.inferred_email ?? null
  const normalized = typeof email === 'string' ? email.trim() : ''
  return normalized.length > 0 ? normalized : null
}

export function toClientSequenceStep(step: StoredSequenceStep, sequenceId: string, index: number) {
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
    stop_on_reply: step.stopOnReply ?? true,
    stop_on_bounce: step.stopOnBounce ?? true,
    attachments: step.attachments ?? [],
  }
}

export function toLegacySequenceStep(step: StoredSequenceStep, index: number) {
  const stepType = step.type === 'wait' || step.type === 'condition' || step.type === 'task'
    ? step.type
    : 'email'

  return {
    id: step.id,
    step_order: index,
    order: index,
    step_name: `Step ${index + 1}`,
    step_type: stepType,
    stepType: stepType,
    type: stepType,
    subject: step.subject,
    body: step.body,
    delay_days: step.delayDays,
    delayDays: step.delayDays,
    template_id: step.templateId ?? null,
    templateId: step.templateId ?? null,
    stop_on_reply: step.stopOnReply ?? true,
    stop_on_bounce: step.stopOnBounce ?? true,
    attachments: step.attachments ?? [],
    send_on_days: [1, 2, 3, 4, 5],
    send_from_hour: 9,
    send_to_hour: 17,
    condition_type: null,
    status: 'active' as const,
  }
}

export async function syncSequenceSteps(
  supabase: any,
  sequenceId: string,
  steps: StoredSequenceStep[]
): Promise<{ error: { message?: string } | null }> {
  const { error: deleteError } = await supabase
    .from('sequence_steps')
    .delete()
    .eq('sequence_id', sequenceId)

  if (deleteError) {
    return { error: deleteError }
  }

  if (steps.length === 0) {
    return { error: null }
  }

  const payload = steps.map((step, index) => ({
    id: step.id,
    sequence_id: sequenceId,
    step_order: index,
    delay_days: step.delayDays,
    template_id: step.templateId ?? null,
    subject: step.subject,
    body: step.body,
    stop_on_reply: step.stopOnReply ?? true,
    stop_on_bounce: step.stopOnBounce ?? true,
    status: 'active',
    attachments: step.attachments ?? [],
  }))

  const { error } = await supabase.from('sequence_steps').insert(payload)
  return { error }
}
