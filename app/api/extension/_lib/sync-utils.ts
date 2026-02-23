import { createClient, type User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { createClient as createServerSupabaseClient } from '@/lib/supabase/server'

const CORS_ALLOW_HEADERS = 'Authorization, Content-Type'
const CORS_ALLOW_METHODS = 'POST, OPTIONS'
const RATE_LIMIT_MAX_CONTACTS_PER_HOUR = 100
const ONE_HOUR_MS = 60 * 60 * 1000
const RATE_LIMIT_STORE_KEY = '__ellyn_extension_sync_rate_limit_store__'

interface RateLimitWindow {
  windowStart: number
  count: number
}

type ExtensionRateLimitStore = Map<string, RateLimitWindow>

type GlobalWithRateLimitStore = typeof globalThis & {
  [RATE_LIMIT_STORE_KEY]?: ExtensionRateLimitStore
}

type SupabaseUserClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export interface ExtensionContactData {
  firstName: string
  lastName: string
  company?: string | null
  role?: string | null
  designation?: string | null
  linkedinUrl?: string | null
  headline?: string | null
  photoUrl?: string | null
  email?: string | null
  emailConfidence?: number | null
  emailVerified?: boolean | null
  emailSource?: string | null
  companyDomain?: string | null
  customFields?: Record<string, unknown> | null
}

export interface ContactUpsertRow {
  user_id: string
  first_name: string
  last_name: string
  company: string
  role: string | null
  linkedin_url: string | null
  linkedin_headline: string | null
  linkedin_photo_url: string | null
  inferred_email: string | null
  email_confidence: number | null
  email_verified: boolean
  company_domain: string | null
  source: 'extension'
  status: 'new'
  custom_fields: Record<string, unknown>
}

export interface ExtensionRateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAtEpochSeconds: number
  retryAfterSeconds: number
}

export type ExtensionAuthResult =
  | {
      ok: true
      user: User
      supabase: SupabaseUserClient
    }
  | {
      ok: false
      response: NextResponse
    }

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeString(value)
  return normalized.length > 0 ? normalized : null
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeOptionalRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

function normalizeOrigin(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  try {
    return new URL(raw).origin
  } catch {
    return ''
  }
}

function resolveCorsAllowOrigin(request: NextRequest): string {
  const origin = normalizeOrigin(request.headers.get('origin') || '')
  if (origin.startsWith('chrome-extension://')) {
    // CORS requires reflecting the concrete extension origin (chrome-extension://<id>).
    return origin
  }
  return 'chrome-extension://*'
}

function appendVaryHeader(headers: Headers, value: string) {
  const current = headers.get('Vary')
  if (!current) {
    headers.set('Vary', value)
    return
  }
  const parts = current
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.some((part) => part.toLowerCase() === value.toLowerCase())) {
    parts.push(value)
    headers.set('Vary', parts.join(', '))
  }
}

function applyCorsHeaders(headers: Headers, request: NextRequest) {
  headers.set('Access-Control-Allow-Origin', resolveCorsAllowOrigin(request))
  headers.set('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS)
  headers.set('Access-Control-Allow-Methods', CORS_ALLOW_METHODS)
  headers.set('Access-Control-Max-Age', '3600')
  appendVaryHeader(headers, 'Origin')
}

function mergeHeaders(target: Headers, extraHeaders?: HeadersInit) {
  if (!extraHeaders) return
  const merged = new Headers(extraHeaders)
  merged.forEach((value, key) => {
    target.set(key, value)
  })
}

function jsonWithCors(
  request: NextRequest,
  payload: unknown,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(payload, init)
  applyCorsHeaders(response.headers, request)
  return response
}

function getSupabasePublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return { supabaseUrl, supabaseAnonKey }
}

function extractBearerToken(headers: Headers): string | null {
  const authHeader = headers.get('authorization')
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return null

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

function buildSupabaseClientFromToken(token: string): SupabaseUserClient | null {
  const env = getSupabasePublicEnv()
  if (!env) return null

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
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
  }) as unknown as SupabaseUserClient
}

function getRateLimitStore(): ExtensionRateLimitStore {
  const globalWithStore = globalThis as GlobalWithRateLimitStore
  if (!globalWithStore[RATE_LIMIT_STORE_KEY]) {
    globalWithStore[RATE_LIMIT_STORE_KEY] = new Map<string, RateLimitWindow>()
  }
  return globalWithStore[RATE_LIMIT_STORE_KEY] as ExtensionRateLimitStore
}

function cleanupRateLimitStore(store: ExtensionRateLimitStore, nowMs: number) {
  if (store.size < 500) return
  for (const [key, value] of store.entries()) {
    if (nowMs - value.windowStart > ONE_HOUR_MS * 2) {
      store.delete(key)
    }
  }
}

export function optionsWithCors(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  applyCorsHeaders(response.headers, request)
  return response
}

export function withCors(
  request: NextRequest,
  response: NextResponse,
  extraHeaders?: HeadersInit
): NextResponse {
  mergeHeaders(response.headers, extraHeaders)
  applyCorsHeaders(response.headers, request)
  return response
}

export function buildRateLimitHeaders(rateLimit: ExtensionRateLimitResult): HeadersInit {
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', String(rateLimit.limit))
  headers.set('X-RateLimit-Remaining', String(Math.max(0, rateLimit.remaining)))
  headers.set('X-RateLimit-Reset', String(rateLimit.resetAtEpochSeconds))
  if (!rateLimit.allowed && rateLimit.retryAfterSeconds > 0) {
    headers.set('Retry-After', String(rateLimit.retryAfterSeconds))
  }
  return headers
}

export function consumeUserSyncRateLimit(
  userId: string,
  contactCountInput: number
): ExtensionRateLimitResult {
  const nowMs = Date.now()
  const contactCount = Math.max(0, Math.floor(Number(contactCountInput) || 0))
  const store = getRateLimitStore()
  cleanupRateLimitStore(store, nowMs)

  const existing = store.get(userId)
  const isExistingWindowValid =
    existing && nowMs - existing.windowStart < ONE_HOUR_MS

  const windowStart = isExistingWindowValid ? existing!.windowStart : nowMs
  const currentCount = isExistingWindowValid ? existing!.count : 0
  const nextCount = currentCount + contactCount
  const windowResetMs = windowStart + ONE_HOUR_MS
  const resetAtEpochSeconds = Math.ceil(windowResetMs / 1000)

  if (nextCount > RATE_LIMIT_MAX_CONTACTS_PER_HOUR) {
    const retryAfterSeconds = Math.max(0, Math.ceil((windowResetMs - nowMs) / 1000))
    return {
      allowed: false,
      limit: RATE_LIMIT_MAX_CONTACTS_PER_HOUR,
      remaining: Math.max(0, RATE_LIMIT_MAX_CONTACTS_PER_HOUR - currentCount),
      resetAtEpochSeconds,
      retryAfterSeconds,
    }
  }

  store.set(userId, {
    windowStart,
    count: nextCount,
  })

  return {
    allowed: true,
    limit: RATE_LIMIT_MAX_CONTACTS_PER_HOUR,
    remaining: Math.max(0, RATE_LIMIT_MAX_CONTACTS_PER_HOUR - nextCount),
    resetAtEpochSeconds,
    retryAfterSeconds: 0,
  }
}

export async function authenticateExtensionRequest(
  request: NextRequest
): Promise<ExtensionAuthResult> {
  const token = extractBearerToken(request.headers)
  if (!token) {
    return {
      ok: false,
      response: jsonWithCors(request, { error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const supabase = buildSupabaseClientFromToken(token)
  if (!supabase) {
    return {
      ok: false,
      response: jsonWithCors(
        request,
        { error: 'Supabase environment is not configured' },
        { status: 500 }
      ),
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: jsonWithCors(request, { error: 'Invalid token' }, { status: 401 }),
    }
  }

  return {
    ok: true,
    user,
    supabase,
  }
}

export function parseExtensionContactData(payload: unknown): {
  data: ExtensionContactData | null
  error: string | null
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      data: null,
      error: 'Invalid contact payload',
    }
  }

  const body = payload as Record<string, unknown>
  const firstName = normalizeString(body.firstName)
  const lastName = normalizeString(body.lastName)

  if (!firstName || !lastName) {
    return {
      data: null,
      error: 'firstName and lastName required',
    }
  }

  return {
    data: {
      firstName,
      lastName,
      company: normalizeNullableString(body.company),
      role: normalizeNullableString(body.role),
      designation: normalizeNullableString(body.designation),
      linkedinUrl: normalizeNullableString(body.linkedinUrl),
      headline: normalizeNullableString(body.headline),
      photoUrl: normalizeNullableString(body.photoUrl),
      email: normalizeNullableString(body.email),
      emailConfidence: normalizeNullableNumber(body.emailConfidence),
      emailVerified: body.emailVerified === true,
      emailSource: normalizeNullableString(body.emailSource),
      companyDomain: normalizeNullableString(body.companyDomain),
      customFields: normalizeOptionalRecord(body.customFields),
    },
    error: null,
  }
}

export function buildContactUpsertPayload(
  contact: ExtensionContactData,
  userId: string
): ContactUpsertRow {
  return {
    user_id: userId,
    first_name: contact.firstName,
    last_name: contact.lastName,
    company: contact.company || 'Unknown',
    role: contact.role || contact.designation || null,
    linkedin_url: contact.linkedinUrl || null,
    linkedin_headline: contact.headline || null,
    linkedin_photo_url: contact.photoUrl || null,
    inferred_email: contact.email || null,
    email_confidence: contact.emailConfidence ?? null,
    email_verified: contact.emailVerified === true,
    company_domain: contact.companyDomain || null,
    source: 'extension',
    status: 'new',
    custom_fields: contact.customFields || {},
  }
}
