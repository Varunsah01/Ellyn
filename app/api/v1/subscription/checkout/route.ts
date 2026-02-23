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

function getProviderStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null

  const directStatus = (error as { status?: unknown }).status
  if (typeof directStatus === 'number' && Number.isFinite(directStatus)) {
    return directStatus
  }

  const nestedStatus = (error as { response?: { status?: unknown } }).response?.status
  if (typeof nestedStatus === 'number' && Number.isFinite(nestedStatus)) {
    return nestedStatus
  }

  return null
}

function getProviderMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  return 'Unknown provider error'
}

function mapCheckoutProviderError(error: unknown): { status: number; message: string } {
  const status = getProviderStatus(error)
  const rawMessage = getProviderMessage(error)
  const configuredEnvironment =
    process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode'

  if (status === 401) {
    const modeHint =
      configuredEnvironment === 'test_mode'
        ? 'DODO auth failed in test_mode. Use a test-mode API key, or switch DODO_PAYMENTS_ENVIRONMENT to live_mode if you are using a live key.'
        : 'DODO auth failed in live_mode. Use a live-mode API key, or switch DODO_PAYMENTS_ENVIRONMENT to test_mode if you are using a test key.'
    return { status: 502, message: modeHint }
  }

  if (status === 403 && configuredEnvironment === 'live_mode') {
    return {
      status: 502,
      message:
        'Live payments are not enabled for this Dodo merchant yet. Enable live mode in Dodo, or use test_mode with a test API key.',
    }
  }

  if (status && status >= 400 && status < 500) {
    return { status: 502, message: `Checkout request rejected by Dodo (${status}): ${rawMessage}` }
  }

  return { status: 502, message: `Failed to create checkout session: ${rawMessage}` }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const body = await request.json().catch(() => ({}))
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
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('dodo_customer_id')
      .eq('id', user.id)
      .single()
    if (profileError && profileError.code !== 'PGRST116') {
      console.warn('[checkout] Failed to load existing customer id:', profileError.message)
    }

    const existingCustomerId = profile?.dodo_customer_id as string | null

    // Build customer object for the subscription request
    const customerPayload = existingCustomerId
      ? { customer_id: existingCustomerId }
      : { email: user.email ?? '', name: user.email ?? '' }

    let sub: Awaited<ReturnType<typeof dodo.subscriptions.create>>
    try {
      sub = await dodo.subscriptions.create({
        product_id: productId,
        quantity: 1,
        customer: customerPayload as Parameters<typeof dodo.subscriptions.create>[0]['customer'],
        payment_link: true,
        return_url: `${baseUrl}/dashboard/settings/billing?success=true`,
        metadata: {
          user_id: user.id,
          userId: user.id,
          billing_cycle: selectedCycle,
          billingCycle: selectedCycle,
        },
        billing: { country: 'US' },
      })
    } catch (providerError) {
      const mapped = mapCheckoutProviderError(providerError)
      console.error('[checkout] Dodo provider error:', providerError)
      captureApiException(providerError, {
        route: '/api/v1/subscription/checkout',
        method: 'POST',
      })
      return NextResponse.json({ error: mapped.message }, { status: mapped.status })
    }

    // Persist the Dodo customer ID if it was just created
    const newCustomerId = (sub.customer as { customer_id?: string } | null)?.customer_id ?? existingCustomerId
    if (newCustomerId && !existingCustomerId) {
      const { error: persistCustomerError } = await supabase
        .from('user_profiles')
        .update({ dodo_customer_id: newCustomerId })
        .eq('id', user.id)
      if (persistCustomerError) {
        console.warn('[checkout] Unable to persist dodo_customer_id:', persistCustomerError.message)
      }
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
