import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'

const patchSchema = z.object({
  persona: z.enum(['job_seeker', 'smb_sales']),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const { data, error } = await supabase
      .from('user_profiles')
      .select('persona')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[user/persona] GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch persona' }, { status: 500 })
    }

    return NextResponse.json({ persona: data?.persona ?? 'job_seeker' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    captureApiException(error, { route: '/api/v1/user/persona', method: 'GET' })
    return NextResponse.json({ error: 'Failed to get persona' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)

    const body: unknown = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid persona value' }, { status: 400 })
    }

    const supabase = await createServiceRoleClient()

    const { error } = await supabase
      .from('user_profiles')
      .update({ persona: parsed.data.persona })
      .eq('id', user.id)

    if (error) {
      console.error('[user/persona] PATCH error:', error)
      return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 })
    }

    return NextResponse.json({ persona: parsed.data.persona })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    captureApiException(error, { route: '/api/v1/user/persona', method: 'PATCH' })
    return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 })
  }
}
