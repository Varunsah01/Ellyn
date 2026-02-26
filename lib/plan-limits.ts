import { createServiceRoleClient } from '@/lib/supabase/server'

export type Plan = 'free' | 'starter' | 'pro'

export const PLAN_LIMITS = {
  contacts:      { free: 200,    starter: 2000,  pro: Infinity },
  sequences:     { free: 3,      starter: 10,    pro: Infinity },
  enrollments:   { free: 50,     starter: 500,   pro: 2000 },
  templates:     { free: 50,     starter: 200,   pro: Infinity },
  deals:         { free: 20,     starter: 100,   pro: Infinity },
  verifications: { free: 10,     starter: 50,    pro: 100 },
} as const

export function getLimit(plan: Plan, feature: keyof typeof PLAN_LIMITS): number {
  return PLAN_LIMITS[feature][plan]
}

export async function checkPlanLimit(
  userId: string,
  feature: keyof typeof PLAN_LIMITS,
  currentCount: number
): Promise<{ allowed: boolean; limit: number; plan: Plan }> {
  const supabase = await createServiceRoleClient()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan_type')
    .eq('id', userId)
    .single()

  const plan = ((profile?.plan_type as Plan | null) ?? 'free') as Plan
  const limit = getLimit(plan, feature)

  return { allowed: currentCount < limit, limit, plan }
}
