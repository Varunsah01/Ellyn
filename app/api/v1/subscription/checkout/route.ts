import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { dodo } from '@/lib/dodo'
import { captureApiException } from '@/lib/monitoring/sentry'
import {
  BILLING_CYCLE,
  DEFAULT_PRICING_REGION,
  getDodoProductId,
  type BillingCycle,
} from '@/lib/pricing-config'
import { createClient as createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

type CheckoutDbClient = Awaited<ReturnType<typeof createServiceRoleClient>>

function extractBearerToken(headers: Headers): string | null {
  const rawAuth = headers.get('authorization')
  if (!rawAuth) return null

  const match = rawAuth.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return null

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

async function createCheckoutDbClient(request: NextRequest): Promise<CheckoutDbClient | null> {
  try {
    return await createServiceRoleClient()
  } catch (error) {
    console.warn('[checkout] Service role client unavailable, falling back to request-scoped auth:', error)
  }

  const token = extractBearerToken(request.headers)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (token && supabaseUrl && supabaseAnonKey) {
    return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }) as unknown as CheckoutDbClient
  }

  try {
    return (await createServerSupabaseClient()) as unknown as CheckoutDbClient
  } catch (error) {
    console.warn('[checkout] Unable to create fallback Supabase client:', error)
    return null
  }
}

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
    const supabase = await createCheckoutDbClient(request)

    const body = await request.json().catch(() => ({}))
    const { billingCycle, planType } = body as { billingCycle?: string; planType?: string }
    const selectedCycle: BillingCycle =
      billingCycle && Object.prototype.hasOwnProperty.call(BILLING_CYCLE, billingCycle)
        ? (billingCycle as BillingCycle)
        : 'monthly'
    const selectedPlan: 'starter' | 'pro' =
      planType === 'starter' ? 'starter' : 'pro'

    // Starter does not offer yearly billing
    if (selectedPlan === 'starter' && selectedCycle === 'yearly') {
      return NextResponse.json(
        { error: 'Starter plan does not offer yearly billing. Please choose monthly or quarterly.' },
        { status: 400 }
      )
    }

    let productId: string
    try {
      productId = getDodoProductId(DEFAULT_PRICING_REGION, selectedCycle, selectedPlan)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Product configuration missing'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      `${request.nextUrl.protocol}//${request.nextUrl.host}`

    // Look up existing Dodo customer ID
    let existingCustomerId: string | null = null
    if (supabase) {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('dodo_customer_id')
        .eq('id', user.id)
        .single()
      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('[checkout] Failed to load existing customer id:', profileError.message)
      } else {
        existingCustomerId = profile?.dodo_customer_id as string | null
      }
    }

    if (!existingCustomerId && !user.email) {
      return NextResponse.json(
        { error: 'Account email is missing. Please update your profile email before checkout.' },
        { status: 400 }
      )
    }

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
          plan_type: selectedPlan,
          planType: selectedPlan,
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
    if (supabase && newCustomerId && !existingCustomerId) {
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
    if (
      message.includes('DODO_') ||
      message.includes('Missing Dodo') ||
      message.includes('SUPABASE_') ||
      message.includes('product ID')
    ) {
      return NextResponse.json({ error: message }, { status: 500 })
    }
    console.error('[checkout] Error:', error)
    captureApiException(error, { route: '/api/v1/subscription/checkout', method: 'POST' })
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
