import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { dodo } from '@/lib/dodo'
import { captureApiException } from '@/lib/monitoring/sentry'
import {
  BILLING_CYCLE,
  DEFAULT_PRICING_REGION,
  getDodoProductId,
  type BillingCycle,
} from '@/lib/pricing-config'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const body = await request.json()
    const { billingCycle } = body as { billingCycle?: string }
    const selectedCycle: BillingCycle =
      billingCycle && Object.prototype.hasOwnProperty.call(BILLING_CYCLE, billingCycle)
        ? (billingCycle as BillingCycle)
        : 'monthly'

    let productId: string
    try {
      productId = getDodoProductId(DEFAULT_PRICING_REGION, selectedCycle)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Product configuration missing'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      `${request.nextUrl.protocol}//${request.nextUrl.host}`

    // Look up existing Dodo customer ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('dodo_customer_id')
      .eq('id', user.id)
      .single()

    const existingCustomerId = profile?.dodo_customer_id as string | null

    // Build customer object for the subscription request
    const customerPayload = existingCustomerId
      ? { customer_id: existingCustomerId }
      : { email: user.email ?? '', name: user.email ?? '' }

    const sub = await dodo.subscriptions.create({
      product_id: productId,
      quantity: 1,
      customer: customerPayload as Parameters<typeof dodo.subscriptions.create>[0]['customer'],
      payment_link: true,
      return_url: `${baseUrl}/dashboard/settings/billing?success=true`,
      metadata: {
        userId: user.id,
        billingCycle: selectedCycle,
      },
      billing: { country: 'US' },
    })

    // Persist the Dodo customer ID if it was just created
    const newCustomerId = (sub.customer as { customer_id?: string } | null)?.customer_id ?? existingCustomerId
    if (newCustomerId && !existingCustomerId) {
      await supabase
        .from('user_profiles')
        .update({ dodo_customer_id: newCustomerId })
        .eq('id', user.id)
    }

    const paymentUrl = (sub as unknown as { payment_link?: string }).payment_link
    if (!paymentUrl) {
      return NextResponse.json({ error: 'No payment link returned from Dodo' }, { status: 500 })
    }

    return NextResponse.json({ url: paymentUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[checkout] Error:', error)
    captureApiException(error, { route: '/api/v1/subscription/checkout', method: 'POST' })
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
