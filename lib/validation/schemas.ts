import { z } from 'zod'

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
}

/**
 * Escape html.
 * @param {string} value - Value input.
 * @returns {string} Computed string.
 * @example
 * escapeHtml('value')
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`]/g, (char) => HTML_ESCAPE_MAP[char] || char)
}

/**
 * Sanitize inline string.
 * @param {string} value - Value input.
 * @returns {string} Computed string.
 * @example
 * sanitizeInlineString('value')
 */
export function sanitizeInlineString(value: string): string {
  return escapeHtml(value.trim().replace(/\s+/g, ' '))
}

/**
 * Sanitize multiline string.
 * @param {string} value - Value input.
 * @returns {string} Computed string.
 * @example
 * sanitizeMultilineString('value')
 */
export function sanitizeMultilineString(value: string): string {
  return escapeHtml(value.replace(/\r\n?/g, '\n').trim())
}

const DOMAIN_REGEX = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i

function normalizeDomainLikeInput(value: string): string {
  const sanitized = sanitizeInlineString(value)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')

  const withoutPath = sanitized.split('/')[0] ?? ''
  const withoutQuery = withoutPath.split('?')[0] ?? ''
  return withoutQuery.split('#')[0] ?? ''
}

const requiredInline = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInlineString(value) : value),
    z.string().min(min).max(max)
  )

const optionalInline = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return undefined
    if (typeof value !== 'string') return value
    const normalized = sanitizeInlineString(value)
    return normalized.length > 0 ? normalized : undefined
  }, z.string().max(max).optional())

const requiredMultiline = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeMultilineString(value) : value),
    z.string().min(min).max(max)
  )

const requiredDomain = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const normalized = normalizeDomainLikeInput(value)
      return normalized
    },
    z.string().max(255).regex(DOMAIN_REGEX, 'Invalid domain')
  )

const optionalMultiline = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return undefined
    if (typeof value !== 'string') return value
    const normalized = sanitizeMultilineString(value)
    return normalized.length > 0 ? normalized : undefined
  }, z.string().max(max).optional())

const optionalEmail = () =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined
    if (typeof value !== 'string') return value
    const normalized = sanitizeInlineString(value).toLowerCase()
    return normalized.length > 0 ? normalized : undefined
  }, z.string().email().max(254).optional())

const nullableOptionalEmail = () =>
  z.preprocess((value) => {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    if (typeof value !== 'string') return value
    const normalized = sanitizeInlineString(value).toLowerCase()
    return normalized.length > 0 ? normalized : null
  }, z.union([z.string().email().max(254), z.null()]).optional())

const optionalDomain = () =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined
    if (typeof value !== 'string') return value
    const normalized = normalizeDomainLikeInput(value)
    return normalized.length > 0 ? normalized : undefined
  }, z.string().max(255).regex(DOMAIN_REGEX, 'Invalid domain').optional())

const optionalUrl = () =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined
    if (typeof value !== 'string') return value
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }, z.string().url().max(500).optional())

const safeTag = () => requiredInline(1, 40)

export const ContactSourceEnum = z.enum(['manual', 'extension', 'csv_import'])
export const ContactStatusEnum = z.enum(['new', 'contacted', 'replied', 'no_response'])
export const LeadStatusEnum = z.enum(['discovered', 'sent', 'bounced', 'replied'])
export const DraftStatusEnum = z.enum(['draft', 'sent'])
export const SequenceStatusEnum = z.enum(['draft', 'active', 'paused', 'completed'])
export const SequenceStepStatusEnum = z.enum(['active', 'paused'])
export const EnrollmentStatusEnum = z.enum(['not_started', 'in_progress', 'paused', 'replied', 'bounced', 'completed'])

export const TemplateCategoryEnum = z.enum([
  'referral',
  'follow_up',
  'coffee_chat',
  'info_interview',
  'custom',
  'recruiter',
  'advice',
  'follow-up',
  'networking',
  'thank-you',
  'startup',
  'job_seeker',
  'smb_sales',
  'general',
])

export const EnhanceDraftActionEnum = z.enum(['enhance', 'shorten', 'lengthen', 'fix-grammar'])
export const ToneEnum = z.enum(['professional', 'casual', 'friendly', 'formal', 'enthusiastic'])
export const GenerateTemplateTypeEnum = z.enum([
  'recruiter',
  'referral',
  'advice',
  'follow-up',
  'thank-you',
  'custom',
])

export const SequenceExecuteActionEnum = z.enum([
  'mark_sent',
  'skip_step',
  'mark_replied',
  'mark_bounced',
  'pause_enrollment',
  'resume_enrollment',
  'remove_enrollment',
])

const contactBaseFields = {
  firstName: requiredInline(1, 80),
  lastName: requiredInline(1, 80),
  company: requiredInline(1, 160),
  role: optionalInline(120),
  inferredEmail: optionalEmail(),
  confirmedEmail: optionalEmail(),
  emailConfidence: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
      z.number().min(0).max(100).optional()
    ),
  companyDomain: optionalDomain(),
  companyIndustry: optionalInline(120),
  companySize: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === '') return undefined
        return typeof value === 'string' ? sanitizeInlineString(value).toLowerCase() : value
      },
      z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional()
    ),
  linkedinUrl: optionalUrl(),
  source: ContactSourceEnum.optional(),
  status: ContactStatusEnum.optional(),
  notes: optionalMultiline(5000),
  tags: z
    .array(safeTag())
    .max(20)
    .optional()
    .transform((tags) => (tags ? Array.from(new Set(tags)) : undefined)),
  lastContactedAt: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined
      return typeof value === 'string' ? value.trim() : value
    }, z.string().datetime().optional()),
} as const

export const ContactCreateSchema = z.object({
  ...contactBaseFields,
  firstName: contactBaseFields.firstName,
  lastName: contactBaseFields.lastName,
  company: contactBaseFields.company,
})

export const ContactUpdateSchema = z
  .object(contactBaseFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export const LeadEmailCandidateSchema = z.object({
  email: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInlineString(value).toLowerCase() : value),
    z.string().email().max(254)
  ),
  pattern: optionalInline(50).default('unknown'),
  confidence: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
      z.number().min(0).max(100).optional()
    ),
})

export const LeadCreateSchema = z.object({
  personName: requiredInline(1, 160),
  companyName: requiredInline(1, 160),
  emails: z.array(LeadEmailCandidateSchema).min(1).max(50),
  selectedEmail: nullableOptionalEmail(),
  status: LeadStatusEnum.optional(),
})

export const LeadUpdateSchema = z
  .object({
    status: LeadStatusEnum.optional(),
    selectedEmail: nullableOptionalEmail(),
  })
  .refine((value) => value.status !== undefined || value.selectedEmail !== undefined, {
    message: 'At least one field (status or selectedEmail) must be provided',
  })

export const TemplateCreateSchema = z.object({
  name: requiredInline(1, 120),
  subject: requiredInline(1, 200),
  body: requiredMultiline(1, 10000),
  category: TemplateCategoryEnum.optional(),
  tone: z.string().max(50).optional(),
  use_case: z.string().max(100).optional(),
  variables: z.array(z.string().max(100)).max(50).optional(),
  tags: z
    .array(safeTag())
    .max(20)
    .optional()
    .transform((tags) => (tags ? Array.from(new Set(tags)) : undefined)),
  icon: optionalInline(32),
  use_count: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
      z.number().int().min(0).max(1_000_000).optional()
    ),
})

export const TemplateUpdateSchema = TemplateCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one field must be provided',
  }
)

export const EmailGenerateSchema = z.object({
  firstName: requiredInline(2, 80),
  lastName: requiredInline(2, 80),
  companyName: requiredInline(2, 160),
  companyDomain: optionalDomain(),
  role: optionalInline(120),
})

export const PredictEmailSchema = z.object({
  firstName: requiredInline(1, 80),
  lastName: requiredInline(1, 80),
  companyName: optionalInline(160),
  companyDomain: requiredDomain(),
  role: optionalInline(120),
  linkedinUrl: optionalUrl(),
})

export const PredictPatternsSchema = z.object({
  domain: requiredDomain(),
  company: requiredInline(2, 160),
  role: optionalInline(120),
  industry: optionalInline(120),
})

export const PatternFeedbackSchema = z.object({
  email: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInlineString(value).toLowerCase() : value),
    z.string().email().max(254)
  ),
  pattern: requiredInline(1, 50).transform((value) => value.toLowerCase()),
  companyDomain: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInlineString(value).toLowerCase() : value),
    z.string().max(255).regex(DOMAIN_REGEX, 'Invalid domain')
  ),
  worked: z.boolean(),
  contactId: optionalInline(64),
})

export const EmailFeedbackSchema = PatternFeedbackSchema

export const LearningRecordSchema = z.object({
  domain: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInlineString(value).toLowerCase() : value),
    z.string().max(255).regex(DOMAIN_REGEX, 'Invalid domain')
  ),
  pattern: requiredInline(1, 50).transform((value) => value.toLowerCase()),
  worked: z.boolean(),
})

export const ResolveDomainSchema = z.object({
  companyName: requiredInline(1, 200),
  companyPageUrl: optionalUrl(),
  skipCache: z.boolean().optional(),
  skipMXValidation: z.boolean().optional(),
})

export const VerifyEmailSchema = z.object({
  email: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInlineString(value).toLowerCase() : value),
    z.string().email().max(254)
  ),
})

export const DraftUpsertSchema = z.object({
  id: optionalInline(64),
  contactId: requiredInline(1, 64),
  subject: requiredInline(1, 300),
  body: requiredMultiline(1, 12000),
  status: DraftStatusEnum.optional(),
  templateId: optionalInline(64),
})

export const GmailSendSchema = z.object({
  leadId: optionalInline(64),
  contactId: optionalInline(64),
  to: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInlineString(value).toLowerCase() : value),
    z.string().email().max(254)
  ),
  subject: requiredInline(1, 300),
  body: requiredMultiline(1, 20000),
  isHtml: z.boolean().optional(),
}).refine((data) => data.contactId || data.leadId, {
  message: 'At least one of contactId or leadId must be provided',
  path: ['contactId'],
})

export const EnhanceDraftSchema = z.object({
  draft: requiredMultiline(1, 12000),
  action: EnhanceDraftActionEnum.default('enhance'),
  additionalContext: z
    .object({
      tone: ToneEnum.optional(),
      company: optionalInline(160),
      userName: optionalInline(120),
      userSchool: optionalInline(120),
    })
    .optional(),
})

export const CustomizeToneSchema = z.object({
  draft: requiredMultiline(1, 12000),
  targetTone: ToneEnum,
})

export const GenerateTemplateAiSchema = z.object({
  templateType: GenerateTemplateTypeEnum,
  instructions: optionalMultiline(700),
  context: z.object({
    userName: requiredInline(1, 120),
    userSchool: optionalInline(120),
    userMajor: optionalInline(120),
  }),
  targetRole: optionalInline(120),
  targetCompany: optionalInline(160),
})

export const SequenceStepInputSchema = z.object({
  order: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
      z.number().int().min(1).max(500).optional()
    ),
  delay_days: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
      z.number().int().min(0).max(3650).optional()
    ),
  template_id: optionalInline(64),
  subject: requiredInline(1, 300),
  body: requiredMultiline(1, 20000),
  stop_on_reply: z.boolean().optional(),
  stop_on_bounce: z.boolean().optional(),
  status: SequenceStepStatusEnum.optional(),
})

export const SequenceCreateSchema = z.object({
  name: requiredInline(1, 120),
  description: optionalMultiline(3000),
  goal: optionalInline(500),
  status: SequenceStatusEnum.optional(),
  steps: z.array(SequenceStepInputSchema).min(1).max(100),
})

export const SequenceUpdateSchema = z
  .object({
    status: SequenceStatusEnum.optional(),
    name: optionalInline(120),
    description: optionalMultiline(3000),
    goal: optionalInline(500),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export const SequenceEnrollSchema = z.object({
  contactIds: z.array(requiredInline(1, 64)).min(1).max(500),
  startDate: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined
      if (typeof value !== 'string') return value
      return value.trim()
    }, z.string().max(100).optional())
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: 'Invalid startDate',
    }),
  overrides: z
    .record(
      z.string(),
      z.record(
        z.string(),
        z.object({
          subject: optionalInline(300),
          body: optionalMultiline(20000),
        })
      )
    )
    .optional(),
})

export const SequenceExecuteSchema = z
  .object({
    action: SequenceExecuteActionEnum,
    enrollmentStepId: optionalInline(64),
    enrollmentId: optionalInline(64),
  })
  .superRefine((value, ctx) => {
    if ((value.action === 'mark_sent' || value.action === 'skip_step') && !value.enrollmentStepId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'enrollmentStepId is required for this action',
        path: ['enrollmentStepId'],
      })
    }

    if (
      (value.action === 'mark_replied' ||
        value.action === 'mark_bounced' ||
        value.action === 'pause_enrollment' ||
        value.action === 'resume_enrollment' ||
        value.action === 'remove_enrollment') &&
      !value.enrollmentId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'enrollmentId is required for this action',
        path: ['enrollmentId'],
      })
    }
  })

export const AdminQuotaActionEnum = z.enum(['reset_user', 'adjust_user', 'reset_all'])

export const AdminQuotaSchema = z
  .object({
    action: AdminQuotaActionEnum,
    userId: optionalInline(64),
    used: z
      .preprocess(
        (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
        z.number().int().min(0).max(1_000_000).optional()
      ),
    limit: z
      .preprocess(
        (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
        z.number().int().min(1).max(1_000_000).optional()
      ),
    planType: z.enum(['free', 'pro']).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.action === 'reset_user' || value.action === 'adjust_user') && !value.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `userId is required for action ${value.action}`,
        path: ['userId'],
      })
    }
  })

export const TrackLookupSchema = z.object({
  profileUrl: optionalUrl(),
  domain: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInlineString(value).toLowerCase() : value),
    z.string().max(255).regex(DOMAIN_REGEX, 'Invalid domain')
  ),
  email: z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInlineString(value).toLowerCase() : value),
    z.string().email().max(254)
  ),
  pattern: requiredInline(1, 50),
  confidence: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
      z.number().min(0).max(1).optional()
    ),
  source: requiredInline(1, 60),
  cacheHit: z.boolean().optional(),
  cost: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
      z.number().min(0).max(100).optional()
    ),
  duration: z
    .preprocess(
      (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
      z.number().int().min(0).max(120000).optional()
    ),
  success: z.boolean().optional(),
})

export const EnrichSchema = z.object({
  firstName: requiredInline(2, 80),
  lastName: requiredInline(2, 80),
  companyName: requiredInline(2, 160),
  role: optionalInline(120),
})

/**
 * Format zod error.
 * @param {z.ZodError} error - Error input.
 * @returns {unknown} Computed unknown.
 * @example
 * formatZodError({})
 */
export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }))
}

export type ContactCreateInput = z.infer<typeof ContactCreateSchema>
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>
export type LeadCreateInput = z.infer<typeof LeadCreateSchema>
export type LeadUpdateInput = z.infer<typeof LeadUpdateSchema>
export type TemplateCreateInput = z.infer<typeof TemplateCreateSchema>
export type TemplateUpdateInput = z.infer<typeof TemplateUpdateSchema>
export type EmailGenerateInput = z.infer<typeof EmailGenerateSchema>
export type DraftUpsertInput = z.infer<typeof DraftUpsertSchema>
export type GmailSendInput = z.infer<typeof GmailSendSchema>
export type EnhanceDraftInput = z.infer<typeof EnhanceDraftSchema>
export type CustomizeToneInput = z.infer<typeof CustomizeToneSchema>
export type GenerateTemplateAiInput = z.infer<typeof GenerateTemplateAiSchema>
export type PredictEmailInput = z.infer<typeof PredictEmailSchema>
export type PredictPatternsInput = z.infer<typeof PredictPatternsSchema>
export type SequenceCreateInput = z.infer<typeof SequenceCreateSchema>
export type SequenceUpdateInput = z.infer<typeof SequenceUpdateSchema>
export type SequenceEnrollInput = z.infer<typeof SequenceEnrollSchema>
export type SequenceExecuteInput = z.infer<typeof SequenceExecuteSchema>
