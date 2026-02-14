import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

import { createClient as createServerClient } from '@/lib/supabase/server'

type QuotaRpcClient = Awaited<ReturnType<typeof createServerClient>>

export type QuotaCheckRow = {
  allowed: boolean
  remaining: number
  reset_date: string | null
}

export type QuotaStatusRow = {
  used: number
  quota_limit: number
  remaining: number
  reset_date: string | null
  plan_type: 'free' | 'pro' | string
}

export function extractBearerToken(headers: Headers): string | null {
  const authHeader = headers.get('authorization')
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return null

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

export async function createQuotaClient(request: Pick<Request, 'headers'>): Promise<QuotaRpcClient> {
  const token = extractBearerToken(request.headers)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (token && supabaseUrl && supabaseAnonKey) {
    return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }) as unknown as QuotaRpcClient
  }

  return createServerClient()
}

export function isMissingDbObjectError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42P01' || code === 'PGRST202' || code === '42883'
}

export function isQuotaNotFoundError(error: unknown): boolean {
  const message = ((error as { message?: string })?.message || '').toLowerCase()
  return message.includes('quota not found')
}

export function toRetryAfterSeconds(resetDate: string | null): number {
  if (!resetDate) return 60
  const resetTime = new Date(resetDate).getTime()
  if (!Number.isFinite(resetTime)) return 60
  return Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
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
      if (/key|token|authorization|secret/i.test(key)) continue
      safe[key] = value
    }
    return safe
  }

  return { message: String(error) }
}

export async function ensureQuotaRow(
  client: QuotaRpcClient,
  userId: string
): Promise<boolean> {
  const { error } = await client.rpc('ensure_user_quota', { p_user_id: userId })
  return !error
}
