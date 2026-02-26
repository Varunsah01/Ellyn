import { NextRequest, NextResponse } from 'next/server'

import { adminEndpointGuard } from '@/lib/auth/admin-endpoint-guard'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSystemTemplates } from '@/lib/system-templates'

function isUndefinedColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = (error as { message?: string })?.message || ''
  return code === '42703' || /column .* does not exist/i.test(message)
}

export async function POST(request: NextRequest) {
  try {
    const guardResult = await adminEndpointGuard(request)
    if (!guardResult.allowed) {
      return guardResult.response ?? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await createServiceRoleClient()

    const { count, error: countError } = await supabase
      .from('email_templates')
      .select('*', { count: 'exact', head: true })
      .eq('is_system', true)
    if (countError) throw countError

    if (count && count > 0) {
      return NextResponse.json({
        message: `${count} system templates already exist`,
        seeded: 0,
      })
    }

    const templates = getSystemTemplates()

    let { error } = await supabase.from('email_templates').insert(templates)
    if (error && isUndefinedColumnError(error)) {
      const withoutUsageCount = templates.map(({ usage_count, ...rest }) => rest)
      const fallbackOne = await supabase
        .from('email_templates')
        .insert(withoutUsageCount)
      error = fallbackOne.error

      if (error && isUndefinedColumnError(error)) {
        const withoutCounters = withoutUsageCount.map(({ use_count, ...rest }) => rest)
        const fallbackTwo = await supabase
          .from('email_templates')
          .insert(withoutCounters)
        error = fallbackTwo.error
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ seeded: templates.length })
  } catch (error) {
    console.error('[admin/seed-templates] Failed:', error)
    captureApiException(error, { route: '/api/admin/seed-templates', method: 'POST' })
    return NextResponse.json({ error: 'Failed to seed system templates' }, { status: 500 })
  }
}
