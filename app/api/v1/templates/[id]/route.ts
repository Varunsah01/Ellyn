import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as LegacyRoute from '@/app/api/templates/[id]/route'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'

const legacyConfig = LegacyRoute as Record<string, unknown>
type VersionedRouteHandler = Parameters<typeof createVersionedHandler>[0]

function asVersionedHandler(handler: unknown): VersionedRouteHandler {
  return handler as VersionedRouteHandler
}

const TemplatePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    tone: z.string().trim().max(50).optional(),
    category: z
      .enum(['job_seeker', 'smb_sales', 'general', 'custom'])
      .optional(),
    use_case: z.string().trim().max(100).nullable().optional(),
    variables: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
    use_count: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

type TemplateAccessRow = {
  id: string
  user_id: string | null
  is_default: boolean | null
  is_system: boolean | null
}

async function loadTemplateForAccess(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  templateId: string
): Promise<TemplateAccessRow | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('id,user_id,is_default,is_system')
    .eq('id', templateId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as TemplateAccessRow | null
}

function canAccessTemplate(
  template: TemplateAccessRow,
  userId: string
): boolean {
  return template.user_id === userId || template.is_default === true
}

async function patchHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

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

    const template = await loadTemplateForAccess(supabase, params.id)
    if (!template || !canAccessTemplate(template, user.id)) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.is_default || template.is_system) {
      return NextResponse.json(
        { error: 'System templates cannot be edited' },
        { status: 403 }
      )
    }

    if (template.user_id !== user.id) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const input = parsed.data
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (input.name !== undefined) payload.name = input.name
    if (input.subject !== undefined) payload.subject = input.subject
    if (input.body !== undefined) payload.body = input.body
    if (input.tone !== undefined) payload.tone = input.tone
    if (input.category !== undefined) payload.category = input.category
    if (input.use_case !== undefined) payload.use_case = input.use_case
    if (input.variables !== undefined) payload.variables = input.variables
    if (input.use_count !== undefined) payload.use_count = input.use_count

    const { data, error } = await supabase
      .from('email_templates')
      .update(payload)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, template: data })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[api/v1/templates/[id] PATCH] Failed:', error)
    captureApiException(error, {
      route: '/api/v1/templates/[id]',
      method: 'PATCH',
    })

    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

async function deleteHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const template = await loadTemplateForAccess(supabase, params.id)
    if (!template || !canAccessTemplate(template, user.id)) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.is_default || template.is_system) {
      return NextResponse.json(
        { error: 'System templates cannot be deleted' },
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

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: 'Template deleted successfully' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[api/v1/templates/[id] DELETE] Failed:', error)
    captureApiException(error, {
      route: '/api/v1/templates/[id]',
      method: 'DELETE',
    })

    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}

export const GET = createVersionedHandler(asVersionedHandler(legacyConfig.GET))
export const POST = createVersionedHandler(asVersionedHandler(legacyConfig.POST))
export const PUT = createVersionedHandler(asVersionedHandler(legacyConfig.PUT))
export const PATCH = createVersionedHandler(asVersionedHandler(patchHandler))
export const DELETE = createVersionedHandler(asVersionedHandler(deleteHandler))
export const OPTIONS = createVersionedHandler(
  asVersionedHandler(legacyConfig.OPTIONS)
)
export const HEAD = createVersionedHandler(asVersionedHandler(legacyConfig.HEAD))
