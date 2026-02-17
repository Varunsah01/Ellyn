import { createServiceRoleClient } from '@/lib/supabase/server'

export class QuotaExceededError extends Error {
  constructor(
    public feature: string,
    public used: number,
    public limit: number,
    public plan_type: string
  ) {
    super(`Quota exceeded for ${feature}: ${used}/${limit} (plan: ${plan_type})`)
    this.name = 'QuotaExceededError'
  }
}

export type QuotaInfo = {
  email: { used: number; limit: number; remaining: number }
  ai_draft: { used: number; limit: number; remaining: number }
  reset_date: string | null
  plan_type: string
}

export async function getUserQuota(userId: string): Promise<QuotaInfo> {
  const supabase = await createServiceRoleClient()

  const { data: quotaData, error: quotaError } = await supabase
    .from('user_quotas')
    .select('email_lookups_used, email_lookups_limit, ai_draft_generations_used, reset_date')
    .eq('user_id', userId)
    .single()

  if (quotaError) throw quotaError

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan_type')
    .eq('id', userId)
    .single()

  const planType: string = profile?.plan_type ?? 'free'
  const emailLimit = Number(quotaData?.email_lookups_limit ?? 25)
  const emailUsed = Number(quotaData?.email_lookups_used ?? 0)
  const aiDraftLimit = planType === 'pro' ? 999999 : 15
  const aiDraftUsed = Number(quotaData?.ai_draft_generations_used ?? 0)

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
    reset_date: quotaData?.reset_date ?? null,
    plan_type: planType,
  }
}

export async function incrementEmailGeneration(userId: string): Promise<void> {
  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase.rpc('check_and_increment_quota', {
    p_user_id: userId,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.allowed) {
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('email_lookups_used, email_lookups_limit')
      .eq('user_id', userId)
      .single()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan_type')
      .eq('id', userId)
      .single()

    throw new QuotaExceededError(
      'email_generation',
      Number(quotaData?.email_lookups_used ?? 0),
      Number(quotaData?.email_lookups_limit ?? 25),
      profile?.plan_type ?? 'free'
    )
  }
}

export async function incrementAIDraftGeneration(userId: string): Promise<void> {
  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase.rpc('check_and_increment_ai_draft', {
    p_user_id: userId,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.allowed) {
    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('ai_draft_generations_used')
      .eq('user_id', userId)
      .single()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan_type')
      .eq('id', userId)
      .single()

    const planType = profile?.plan_type ?? 'free'

    throw new QuotaExceededError(
      'ai_draft',
      Number(quotaData?.ai_draft_generations_used ?? 0),
      planType === 'pro' ? 999999 : 15,
      planType
    )
  }
}
