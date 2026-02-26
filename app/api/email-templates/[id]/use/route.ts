import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateTrackingPixelUrl, injectTrackingPixel } from '@/lib/tracking'
import { recordActivity } from '@/lib/utils/recordActivity'

const TemplateUseSchema = z.object({
  contact_id: z.string().uuid().optional(),
  filled_subject: z.string(),
  filled_body: z.string(),
})

function isUndefinedColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = (error as { message?: string })?.message || ''
  return code === '42703' || /column .* does not exist/i.test(message)
}

async function incrementTemplateUsage(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  templateId: string,
  currentRow: Record<string, unknown>
) {
  const nowIso = new Date().toISOString()
  const usageCount = Number(currentRow.usage_count ?? 0)

  const first = await supabase
    .from('email_templates')
    .update({ usage_count: usageCount + 1, updated_at: nowIso })
    .eq('id', templateId)
  if (!first.error) return
  if (!isUndefinedColumnError(first.error)) throw first.error

  const fallbackCount = Number(currentRow.use_count ?? 0)
  const second = await supabase
    .from('email_templates')
    .update({ use_count: fallbackCount + 1, updated_at: nowIso })
    .eq('id', templateId)
  if (second.error) throw second.error
}

export async function POST(
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

    const parsed = TemplateUseSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const templateId = params.id
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle()
    if (templateError) throw templateError

    if (!template || (template.user_id !== user.id && !template.is_system)) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const body = parsed.data
    let draftId: string | null = null

    if (body.contact_id) {
      const insertAttempt = await supabase
        .from('ai_drafts')
        .insert({
          user_id: user.id,
          contact_id: body.contact_id,
          template_id: templateId,
          subject: body.filled_subject,
          body: body.filled_body,
          status: 'draft',
        })
        .select('id')
        .single()

      if (insertAttempt.error && isUndefinedColumnError(insertAttempt.error)) {
        const fallbackAttempt = await supabase
          .from('ai_drafts')
          .insert({
            user_id: user.id,
            contact_id: body.contact_id,
            template_name: String(template.name ?? ''),
            subject: body.filled_subject,
            body: body.filled_body,
            status: 'draft',
          })
          .select('id')
          .single()

        if (fallbackAttempt.error) throw fallbackAttempt.error
        draftId = fallbackAttempt.data?.id ?? null
      } else if (insertAttempt.error) {
        throw insertAttempt.error
      } else {
        draftId = insertAttempt.data?.id ?? null
      }
    }

    if (draftId && body.contact_id) {
      const pixelUrl = generateTrackingPixelUrl({
        draftId,
        userId: user.id,
        contactId: body.contact_id,
      })
      const trackedBody = injectTrackingPixel(body.filled_body, pixelUrl)

      const updateAttempt = await supabase
        .from('ai_drafts')
        .update({ body: trackedBody })
        .eq('id', draftId)
        .eq('user_id', user.id)

      if (updateAttempt.error) {
        console.error('[email-templates/[id]/use POST] Failed to update draft body with tracking pixel:', updateAttempt.error)
      }
    }

    await incrementTemplateUsage(
      supabase,
      templateId,
      template as Record<string, unknown>
    )

    recordActivity({
      userId: user.id,
      type: 'template_used',
      description: `Used template ${template.name}`,
      contactId: body.contact_id ?? null,
      metadata: {
        template_id: templateId,
        is_system: Boolean(template.is_system),
      },
    })

    return NextResponse.json({
      draft_id: draftId,
      template_id: templateId,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[email-templates/[id]/use POST] Failed:', error)
    captureApiException(error, {
      route: '/api/email-templates/[id]/use',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Failed to use template' }, { status: 500 })
  }
}
