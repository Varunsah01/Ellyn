import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { extractVariables } from '@/lib/template-variables'

function isUndefinedColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = (error as { message?: string })?.message || ''
  return code === '42703' || /column .* does not exist/i.test(message)
}

async function insertDuplicateTemplate(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  payload: Record<string, unknown>
) {
  const first = await supabase
    .from('email_templates')
    .insert({ ...payload, usage_count: 0 })
    .select('*')
    .single()
  if (!first.error) return first
  if (!isUndefinedColumnError(first.error)) return first

  const second = await supabase
    .from('email_templates')
    .insert({ ...payload, use_count: 0 })
    .select('*')
    .single()
  if (!second.error) return second
  if (!isUndefinedColumnError(second.error)) return second

  return supabase
    .from('email_templates')
    .insert(payload)
    .select('*')
    .single()
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const { data: original, error: originalError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (originalError) throw originalError
    if (!original || (original.user_id !== user.id && !original.is_system)) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      is_system: false,
      is_default: false,
      name: `Copy of ${original.name}`,
      subject: original.subject,
      body: original.body,
      tone: original.tone ?? 'professional',
      use_case: original.use_case ?? null,
      category: original.category ?? 'general',
      variables: Array.isArray(original.variables)
        ? original.variables
        : extractVariables(`${original.body ?? ''} ${original.subject ?? ''}`),
      tags: Array.isArray(original.tags) ? original.tags : null,
      icon: typeof original.icon === 'string' ? original.icon : null,
    }

    const { data, error } = await insertDuplicateTemplate(supabase, payload)
    if (error) throw error

    return NextResponse.json({
      success: true,
      template: data,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[email-templates/[id]/duplicate POST] Failed:', error)
    captureApiException(error, {
      route: '/api/email-templates/[id]/duplicate',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Failed to duplicate template' }, { status: 500 })
  }
}
