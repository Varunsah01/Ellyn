import { createServiceRoleClient } from '@/lib/supabase/server'

export const PLAN_LIMITS = {
  free: { email: 50, ai_draft: 0 },
  starter: { email: 500, ai_draft: 150 },
  pro: { email: 1500, ai_draft: 500 },
} as const

type PlanType = keyof typeof PLAN_LIMITS
type ServiceRoleClient = Awaited<ReturnType<typeof createServiceRoleClient>>

type RawProfileRow = {
  plan_type: string | null
}

type RawQuotaRow = {
  email_lookups_used: number | null
  email_lookups_limit: number | null
  ai_draft_generations_used: number | null
  ai_draft_generations_limit: number | null
  reset_date: string | null
  period_start: string | null
  period_end: string | null
  user_profiles?: RawProfileRow | RawProfileRow[] | null
}

type QuotaSnapshot = {
  quota: RawQuotaRow
  plan_type: PlanType
}

export type QuotaInfo = {
  email: { used: number; limit: number; remaining: number }
  ai_draft: { used: number; limit: number; remaining: number }
  reset_date: string | null
  period_start: string | null
  period_end: string | null
  plan_type: string
}

export type QuotaIncrementResult = {
  used: number
  limit: number
  plan_type: string
}

export class QuotaExceededError extends Error {
  constructor(
    public feature: string,
    public used: number,
    public limit: number,
    public plan_type: string
  ) {
    super(`Quota exceeded for ${feature}`)
    this.name = 'QuotaExceededError'
  }
}

// incrementEmailGeneration: calls ensure_user_quota then increments email_lookups_used.
// Throws QuotaExceededError if used >= limit.
// Returns { used, limit, plan_type }
export async function incrementEmailGeneration(
  userId: string
): Promise<QuotaIncrementResult> {
  const supabase = await createServiceRoleClient()
  await ensureUserQuotaRow(supabase, userId)

  const quota = await getQuotaSnapshot(supabase, userId)
  const currentUsed = toSafeInt(quota.quota.email_lookups_used, 0)
  const limit = PLAN_LIMITS[quota.plan_type].email

  if (currentUsed >= limit) {
    throw new QuotaExceededError('email_generation', currentUsed, limit, quota.plan_type)
  }

  const nextUsed = currentUsed + 1
  const { error: updateError } = await supabase
    .from('user_quotas')
    .update({
      email_lookups_used: nextUsed,
      email_lookups_limit: limit,
    })
    .eq('user_id', userId)

  if (updateError) {
    throw updateError
  }

  return { used: nextUsed, limit, plan_type: quota.plan_type }
}

// incrementAIDraftGeneration: same but for ai_draft_generations_used.
// Throws QuotaExceededError if plan is free (limit = 0) or used >= limit.
export async function incrementAIDraftGeneration(
  userId: string
): Promise<QuotaIncrementResult> {
  const supabase = await createServiceRoleClient()
  await ensureUserQuotaRow(supabase, userId)

  const quota = await getQuotaSnapshot(supabase, userId)
  const currentUsed = toSafeInt(quota.quota.ai_draft_generations_used, 0)
  const limit = PLAN_LIMITS[quota.plan_type].ai_draft

  if (limit === 0 || currentUsed >= limit) {
    throw new QuotaExceededError('ai_draft_generation', currentUsed, limit, quota.plan_type)
  }

  const nextUsed = currentUsed + 1
  const { error: updateError } = await supabase
    .from('user_quotas')
    .update({
      ai_draft_generations_used: nextUsed,
      ai_draft_generations_limit: limit,
    })
    .eq('user_id', userId)

  if (updateError) {
    throw updateError
  }

  return { used: nextUsed, limit, plan_type: quota.plan_type }
}

// getUserQuota: returns current quota state without incrementing
export async function getUserQuota(userId: string): Promise<QuotaInfo> {
  const supabase = await createServiceRoleClient()
  await ensureUserQuotaRow(supabase, userId)

  const quota = await getQuotaSnapshot(supabase, userId)

  const emailUsed = toSafeInt(quota.quota.email_lookups_used, 0)
  const aiDraftUsed = toSafeInt(quota.quota.ai_draft_generations_used, 0)
  const emailLimit = PLAN_LIMITS[quota.plan_type].email
  const aiDraftLimit = PLAN_LIMITS[quota.plan_type].ai_draft

  return {
    email: {
      used: emailUsed,
      limit: emailLimit,
      remaining: Math.max(0, emailLimit - emailUsed),
    },
    ai_draft: {
      used: aiDraftUsed,
      limit: aiDraftLimit,
      remaining: Math.max(0, aiDraftLimit - aiDraftUsed),
    },
    reset_date: quota.quota.reset_date ?? null,
    period_start: quota.quota.period_start ?? null,
    period_end: quota.quota.period_end ?? null,
    plan_type: quota.plan_type,
  }
}

async function ensureUserQuotaRow(
  supabase: ServiceRoleClient,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc('ensure_user_quota', { p_user_id: userId })
  if (!error) {
    return
  }

  const { error: insertError } = await supabase
    .from('user_quotas')
    .insert({ user_id: userId })

  if (insertError && insertError.code !== '23505') {
    throw insertError
  }
}

async function getQuotaSnapshot(
  supabase: ServiceRoleClient,
  userId: string
): Promise<QuotaSnapshot> {
  // Preferred read path: fetch quota + plan_type with a join.
  const { data: joinedData, error: joinedError } = await supabase
    .from('user_quotas')
    .select(
      'email_lookups_used, email_lookups_limit, ai_draft_generations_used, ai_draft_generations_limit, reset_date, period_start, period_end, user_profiles(plan_type)'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (!joinedError && joinedData) {
    const joinedRow = joinedData as RawQuotaRow
    const joinedPlan = extractPlanTypeFromJoin(joinedRow.user_profiles)

    if (joinedPlan) {
      return {
        quota: joinedRow,
        plan_type: joinedPlan,
      }
    }
  }

  // Fallback path when join relation is unavailable.
  const { data: quotaData, error: quotaError } = await supabase
    .from('user_quotas')
    .select(
      'email_lookups_used, email_lookups_limit, ai_draft_generations_used, ai_draft_generations_limit, reset_date, period_start, period_end'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (quotaError) {
    throw quotaError
  }

  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('plan_type')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  return {
    quota: (quotaData as RawQuotaRow | null) ?? {
      email_lookups_used: 0,
      email_lookups_limit: PLAN_LIMITS.free.email,
      ai_draft_generations_used: 0,
      ai_draft_generations_limit: PLAN_LIMITS.free.ai_draft,
      reset_date: null,
      period_start: null,
      period_end: null,
    },
    plan_type: normalizePlanType((profileData as RawProfileRow | null)?.plan_type),
  }
}

function extractPlanTypeFromJoin(
  profile: RawQuotaRow['user_profiles']
): PlanType | null {
  if (!profile) return null

  if (Array.isArray(profile)) {
    return parsePlanType(profile[0]?.plan_type)
  }

  return parsePlanType(profile.plan_type)
}

function parsePlanType(value: unknown): PlanType | null {
  const plan = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (plan === 'free' || plan === 'starter' || plan === 'pro') {
    return plan
  }
  return null
}

function normalizePlanType(value: unknown): PlanType {
  return parsePlanType(value) ?? 'free'
}

function toSafeInt(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    return fallback
  }
  return Math.max(0, Math.trunc(n))
}
