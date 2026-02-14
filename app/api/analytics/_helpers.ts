import type { User } from '@supabase/supabase-js'

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'all'

const VALID_PERIODS: AnalyticsPeriod[] = ['day', 'week', 'month', 'all']

export function normalizePeriod(value: string | null | undefined): AnalyticsPeriod {
  if (!value) return 'month'
  const normalized = value.trim().toLowerCase()
  return VALID_PERIODS.includes(normalized as AnalyticsPeriod)
    ? (normalized as AnalyticsPeriod)
    : 'month'
}

export function getPeriodStartDate(period: AnalyticsPeriod): Date | null {
  const now = Date.now()
  switch (period) {
    case 'day':
      return new Date(now - 24 * 60 * 60 * 1000)
    case 'week':
      return new Date(now - 7 * 24 * 60 * 60 * 1000)
    case 'month':
      return new Date(now - 30 * 24 * 60 * 60 * 1000)
    default:
      return null
  }
}

export function isMissingDbObjectError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42P01' || code === 'PGRST202' || code === '42883'
}

export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function toSafeNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function sanitizeErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'object' && error !== null) {
    const safe: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(error as Record<string, unknown>)) {
      if (/token|key|secret|authorization/i.test(key)) continue
      safe[key] = value
    }
    return safe
  }

  return { message: String(error) }
}

export function csvEscape(value: unknown): string {
  const raw = String(value ?? '')
  if (/[,"\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function isAdminUser(user: User): boolean {
  const appMetadata = (user.app_metadata || {}) as Record<string, unknown>
  const userMetadata = (user.user_metadata || {}) as Record<string, unknown>

  const roleCandidates = [
    appMetadata.role,
    userMetadata.role,
    appMetadata.roles,
    userMetadata.roles,
  ]

  const hasAdminRole = roleCandidates.some((candidate) => {
    if (typeof candidate === 'string') {
      return candidate.toLowerCase() === 'admin'
    }
    if (Array.isArray(candidate)) {
      return candidate.some((entry) => String(entry).toLowerCase() === 'admin')
    }
    return false
  })

  if (hasAdminRole) {
    return true
  }

  const allowedEmails = (process.env.ANALYTICS_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  if (allowedEmails.length === 0) {
    return false
  }

  const userEmail = String(user.email || '').trim().toLowerCase()
  return Boolean(userEmail && allowedEmails.includes(userEmail))
}
