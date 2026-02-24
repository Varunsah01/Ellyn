/**
 * Verification quota placeholders.
 * NOTE: Abstract API removed. This quota is unused. Kept for future use.
 */

export const DAILY_VERIFICATION_LIMITS = {
  free: 10,
  pro: 100,
} as const

export type VerificationQuotaResult = {
  allowed: boolean
  used: number
  limit: number
  planType: 'free' | 'pro'
  resetAt: string
}

function nextMidnightUtc(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

// NOTE: Abstract API removed. This quota is unused. Kept for future use.
export async function getDailyVerificationQuota(
  _userId: string
): Promise<VerificationQuotaResult> {
  return {
    allowed: true,
    used: 0,
    limit: DAILY_VERIFICATION_LIMITS.free,
    planType: 'free',
    resetAt: nextMidnightUtc(),
  }
}
