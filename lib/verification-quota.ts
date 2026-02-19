/**
 * Daily email verification quota.
 *
 * Quota is computed by counting actual Abstract API calls in api_costs for
 * the current UTC calendar day. Cache hits (source='cache') are excluded
 * since they cost nothing.
 *
 * Fails open — if the DB query errors we allow the verification so the
 * user experience isn't degraded by an internal infra issue.
 */

import { createServiceRoleClient } from '@/lib/supabase/server'

export const DAILY_VERIFICATION_LIMITS = {
  free: 10,
  pro: 100,
} as const

export type VerificationQuotaResult = {
  allowed: boolean
  used: number
  limit: number
  planType: 'free' | 'pro'
  resetAt: string // ISO timestamp of next midnight UTC
}

function nextMidnightUtc(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function todayStartUtc(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function getDailyVerificationQuota(
  userId: string
): Promise<VerificationQuotaResult> {
  try {
    const serviceClient = await createServiceRoleClient()

    // 1. Get user's plan type
    const { data: quotaRow } = await serviceClient
      .from('user_quotas')
      .select('plan_type')
      .eq('user_id', userId)
      .maybeSingle()

    const planType: 'free' | 'pro' =
      quotaRow?.plan_type === 'pro' ? 'pro' : 'free'
    const limit = DAILY_VERIFICATION_LIMITS[planType]

    // 2. Count actual API verifications today (excludes cache hits and fallbacks)
    const { count, error } = await serviceClient
      .from('api_costs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('service', 'abstract')
      .contains('metadata', { endpoint: 'verify-email', source: 'abstract' })
      .gte('created_at', todayStartUtc())

    if (error) {
      console.warn('[verification-quota] Count query failed:', error.message)
      // Fail open
      return { allowed: true, used: 0, limit, planType, resetAt: nextMidnightUtc() }
    }

    const used = count ?? 0
    return {
      allowed: used < limit,
      used,
      limit,
      planType,
      resetAt: nextMidnightUtc(),
    }
  } catch (err) {
    console.error('[verification-quota] Unexpected error:', err)
    // Fail open — never block the user due to our own infra issue
    return {
      allowed: true,
      used: 0,
      limit: DAILY_VERIFICATION_LIMITS.free,
      planType: 'free',
      resetAt: nextMidnightUtc(),
    }
  }
}
