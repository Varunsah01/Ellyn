import { NextRequest, NextResponse } from 'next/server'

import { getDodoClient } from '@/lib/dodo'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const webhookId = request.headers.get('webhook-id') ?? ''
  const webhookSig = request.headers.get('webhook-signature') ?? ''
  const webhookTs = request.headers.get('webhook-timestamp') ?? ''

  if (!webhookSig) {
    return NextResponse.json({ error: 'Missing webhook-signature header' }, { status: 400 })
  }

  let event: { type: string; data: Record<string, unknown> }
  try {
    const client = getDodoClient()
    event = client.webhooks.unwrap(rawBody, {
      headers: {
        'webhook-id': webhookId,
        'webhook-signature': webhookSig,
        'webhook-timestamp': webhookTs,
      },
    }) as unknown as { type: string; data: Record<string, unknown> }
  } catch (err) {
    console.error('[dodo-webhook] Signature verification failed:', err)
    captureApiException(err, { route: '/api/v1/dodo/webhook', method: 'POST' })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createServiceRoleClient()
  const data = event.data

  try {
    switch (event.type) {
      case 'subscription.active': {
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const userId = (data.metadata as Record<string, string> | null)?.userId

        if (userId) {
          await supabase
            .from('user_profiles')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan_type: 'pro',
              subscription_status: 'active',
            })
            .eq('id', userId)
        } else if (customerId) {
          await supabase
            .from('user_profiles')
            .update({
              stripe_subscription_id: subscriptionId,
              plan_type: 'pro',
              subscription_status: 'active',
            })
            .eq('stripe_customer_id', customerId)
        }
        break
      }

      case 'subscription.renewed': {
        const subscriptionId = data.subscription_id as string
        await supabase
          .from('user_profiles')
          .update({ subscription_status: 'active' })
          .eq('stripe_subscription_id', subscriptionId)
        break
      }

      case 'subscription.updated': {
        const subscriptionId = data.subscription_id as string
        const rawStatus = data.status as string | undefined
        const status =
          rawStatus === 'active' ? 'active' : rawStatus === 'on_hold' ? 'past_due' : 'canceled'
        await supabase
          .from('user_profiles')
          .update({ subscription_status: status })
          .eq('stripe_subscription_id', subscriptionId)
        break
      }

      case 'subscription.on_hold': {
        const subscriptionId = data.subscription_id as string
        await supabase
          .from('user_profiles')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId)
        break
      }

      case 'subscription.cancelled':
      case 'subscription.expired':
      case 'subscription.failed': {
        const subscriptionId = data.subscription_id as string
        await supabase
          .from('user_profiles')
          .update({
            plan_type: 'free',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
          })
          .eq('stripe_subscription_id', subscriptionId)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`[dodo-webhook] Error handling ${event.type}:`, err)
    captureApiException(err, { route: '/api/v1/dodo/webhook', method: 'POST' })
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
