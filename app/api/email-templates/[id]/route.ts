import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { extractVariables } from '@/lib/template-variables'

const CATEGORY_VALUES = ['job_seeker', 'smb_sales', 'general'] as const
const TONE_VALUES = ['professional', 'casual', 'formal', 'friendly'] as const

const TemplatePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    body: z.string().min(1).max(5000).optional(),
    tone: z.enum(TONE_VALUES).optional(),
    use_case: z.string().trim().max(50).nullable().optional(),
    category: z.enum(CATEGORY_VALUES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

function isUndefinedColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = (error as { message?: string })?.message || ''
  return code === '42703' || /column .* does not exist/i.test(message)
}

async function loadTemplate(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  templateId: string
) {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const template = await loadTemplate(supabase, params.id)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const ownedByUser = template.user_id === user.id
    const isSystem = Boolean(template.is_system)
    if (!ownedByUser && !isSystem) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, template })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[email-templates/[id] GET] Failed:', error)
    captureApiException(error, { route: '/api/email-templates/[id]', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const template = await loadTemplate(supabase, params.id)
    if (!template || template.user_id !== user.id) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    if (template.is_system) {
      return NextResponse.json(
        { error: 'System templates cannot be edited. Use Duplicate instead.' },
        { status: 403 }
      )
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = TemplatePatchSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updateInput = parsed.data
    const nextSubject = updateInput.subject ?? template.subject
    const nextBody = updateInput.body ?? template.body
    const variables = extractVariables(`${nextBody} ${nextSubject}`)

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      variables,
    }
    if (updateInput.name !== undefined) updatePayload.name = updateInput.name
    if (updateInput.subject !== undefined) updatePayload.subject = updateInput.subject
    if (updateInput.body !== undefined) updatePayload.body = updateInput.body
    if (updateInput.tone !== undefined) updatePayload.tone = updateInput.tone
    if (updateInput.use_case !== undefined) updatePayload.use_case = updateInput.use_case
    if (updateInput.category !== undefined) updatePayload.category = updateInput.category

    let { data, error } = await supabase
      .from('email_templates')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('is_system', false)
      .select('*')
      .maybeSingle()

    if (error && isUndefinedColumnError(error)) {
      const fallbackPayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (updateInput.name !== undefined) fallbackPayload.name = updateInput.name
      if (updateInput.subject !== undefined) fallbackPayload.subject = updateInput.subject
      if (updateInput.body !== undefined) fallbackPayload.body = updateInput.body

      const fallback = await supabase
        .from('email_templates')
        .update(fallbackPayload)
        .eq('id', params.id)
        .eq('user_id', user.id)
        .eq('is_system', false)
        .select('*')
        .maybeSingle()
      data = fallback.data
      error = fallback.error
    }

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      template: data,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[email-templates/[id] PATCH] Failed:', error)
    captureApiException(error, { route: '/api/email-templates/[id]', method: 'PATCH' })
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const template = await loadTemplate(supabase, params.id)
    if (!template || (template.user_id !== user.id && !template.is_system)) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    if (template.is_system) {
      return NextResponse.json(
        {
          error: 'System templates cannot be deleted. Use Duplicate instead.',
        },
        { status: 403 }
      )
    }
    if (template.user_id !== user.id) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('is_system', false)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[email-templates/[id] DELETE] Failed:', error)
    captureApiException(error, { route: '/api/email-templates/[id]', method: 'DELETE' })
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
