import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { dodo } from '@/lib/dodo'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    const customerId = profile?.stripe_customer_id as string | null
    if (!customerId) {
      return NextResponse.json(
        { error: 'No Dodo customer found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const session = await dodo.customers.customerPortal.create(customerId)
    const link = (session as unknown as { link?: string }).link

    if (!link) {
      return NextResponse.json({ error: 'No portal link returned' }, { status: 500 })
    }

    return NextResponse.json({ url: link })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[portal] Error:', error)
    captureApiException(error, { route: '/api/v1/subscription/portal', method: 'POST' })
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
