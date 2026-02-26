import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { extractVariables } from '@/lib/template-variables'

const CATEGORY_VALUES = ['job_seeker', 'smb_sales', 'general'] as const
const TONE_VALUES = ['professional', 'casual', 'formal', 'friendly'] as const

const TemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subject: z.string().trim().min(1).max(200),
  body: z.string().min(1).max(5000),
  tone: z.enum(TONE_VALUES).default('professional'),
  use_case: z.string().trim().max(50).optional(),
  category: z.enum(CATEGORY_VALUES).default('general'),
})

type TemplateSortRow = {
  is_system?: boolean | null
  usage_count?: number | null
  use_count?: number | null
  created_at?: string | null
}

function sanitizeSearch(value: string | null): string {
  if (!value) return ''
  return value
    .trim()
    .slice(0, 120)
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
}

function parseCategory(raw: string | null): 'job_seeker' | 'smb_sales' | 'general' | 'all' {
  if (raw === 'job_seeker' || raw === 'smb_sales' || raw === 'general' || raw === 'all') {
    return raw
  }
  return 'all'
}

function parseIncludeSystem(raw: string | null): boolean {
  if (raw === 'false') return false
  if (raw === 'true') return true
  return true
}

function isUndefinedColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = (error as { message?: string })?.message || ''
  return code === '42703' || /column .* does not exist/i.test(message)
}

function usageValue(row: TemplateSortRow): number {
  if (typeof row.usage_count === 'number' && Number.isFinite(row.usage_count)) {
    return row.usage_count
  }
  if (typeof row.use_count === 'number' && Number.isFinite(row.use_count)) {
    return row.use_count
  }
  return 0
}

function createdAtValue(row: TemplateSortRow): number {
  const value = row.created_at ? new Date(row.created_at).getTime() : 0
  return Number.isFinite(value) ? value : 0
}

function sortTemplates(rows: TemplateSortRow[]): TemplateSortRow[] {
  return [...rows].sort((a, b) => {
    const systemDiff = Number(Boolean(b.is_system)) - Number(Boolean(a.is_system))
    if (systemDiff !== 0) return systemDiff

    const usageDiff = usageValue(b) - usageValue(a)
    if (usageDiff !== 0) return usageDiff

    return createdAtValue(b) - createdAtValue(a)
  })
}

async function insertTemplate(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  payload: Record<string, unknown>
) {
  const firstAttempt = await supabase
    .from('email_templates')
    .insert({ ...payload, usage_count: 0 })
    .select('*')
    .single()
  if (!firstAttempt.error) return firstAttempt
  if (!isUndefinedColumnError(firstAttempt.error)) return firstAttempt

  const secondAttempt = await supabase
    .from('email_templates')
    .insert({ ...payload, use_count: 0 })
    .select('*')
    .single()
  if (!secondAttempt.error) return secondAttempt
  if (!isUndefinedColumnError(secondAttempt.error)) return secondAttempt

  return supabase
    .from('email_templates')
    .insert(payload)
    .select('*')
    .single()
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const params = request.nextUrl.searchParams
    const category = parseCategory(params.get('category'))
    const search = sanitizeSearch(params.get('search'))
    const includeSystem = parseIncludeSystem(params.get('includeSystem'))

    let userQuery = supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.id)

    if (category !== 'all') {
      userQuery = userQuery.eq('category', category)
    }
    if (search) {
      userQuery = userQuery.or(`name.ilike.%${search}%,subject.ilike.%${search}%`)
    }

    const { data: userTemplates, error: userError } = await userQuery
    if (userError) throw userError

    let systemTemplates: TemplateSortRow[] = []
    if (includeSystem) {
      let systemQuery = supabase
        .from('email_templates')
        .select('*')
        .eq('is_system', true)

      if (category !== 'all') {
        systemQuery = systemQuery.eq('category', category)
      }
      if (search) {
        systemQuery = systemQuery.or(`name.ilike.%${search}%,subject.ilike.%${search}%`)
      }

      const { data, error } = await systemQuery
      if (error && !isUndefinedColumnError(error)) throw error
      systemTemplates = (data ?? []) as TemplateSortRow[]
    }

    const templates = sortTemplates([
      ...(systemTemplates as TemplateSortRow[]),
      ...((userTemplates ?? []) as TemplateSortRow[]),
    ])

    return NextResponse.json({
      success: true,
      templates,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[email-templates GET] Failed:', error)
    captureApiException(error, { route: '/api/email-templates', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = TemplateCreateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('plan_type')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) throw profileError

    const planType = String(profile?.plan_type ?? 'free')
    const templateLimit = planType === 'free' ? 50 : 200

    const { count: existingCount, error: countError } = await supabase
      .from('email_templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (countError) throw countError

    if ((existingCount ?? 0) >= templateLimit) {
      return NextResponse.json(
        {
          error: `Template limit reached (${templateLimit}) for plan ${planType}`,
          limit: templateLimit,
          plan_type: planType,
        },
        { status: 403 }
      )
    }

    const body = parsed.data
    const variables = extractVariables(`${body.body} ${body.subject}`)
    const payload: Record<string, unknown> = {
      user_id: user.id,
      is_system: false,
      is_default: false,
      name: body.name,
      subject: body.subject,
      body: body.body,
      tone: body.tone,
      use_case: body.use_case ?? null,
      category: body.category,
      variables,
    }

    const { data, error } = await insertTemplate(supabase, payload)
    if (error) throw error

    return NextResponse.json(
      { success: true, template: data },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[email-templates POST] Failed:', error)
    captureApiException(error, { route: '/api/email-templates', method: 'POST' })
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
