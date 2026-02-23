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

  const metadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : null
  const userId =
    (typeof metadata?.user_id === 'string' && metadata.user_id) ||
    (typeof metadata?.userId === 'string' && metadata.userId) ||
    null
  const customerId =
    (typeof data.customer_id === 'string' && data.customer_id) ||
    (typeof data.customer === 'string' && data.customer) ||
    null
  const subscriptionId =
    (typeof data.subscription_id === 'string' && data.subscription_id) ||
    (typeof data.id === 'string' && data.id) ||
    null
  const productId = (typeof data.product_id === 'string' && data.product_id) || null

  try {
    switch (event.type) {
      case 'subscription.active':
      case 'subscription.activated': {
        if (userId) {
          await supabase
            .from('user_profiles')
            .update({
              dodo_customer_id: customerId,
              dodo_subscription_id: subscriptionId,
              dodo_product_id: productId,
              plan_type: 'pro',
              subscription_status: 'active',
            })
            .eq('id', userId)
        } else if (customerId) {
          await supabase
            .from('user_profiles')
            .update({
              dodo_subscription_id: subscriptionId,
              dodo_product_id: productId,
              plan_type: 'pro',
              subscription_status: 'active',
            })
            .eq('dodo_customer_id', customerId)
        }
        break
      }

      case 'subscription.renewed': {
        if (subscriptionId) {
          await supabase
            .from('user_profiles')
            .update({ subscription_status: 'active' })
            .eq('dodo_subscription_id', subscriptionId)
        }
        break
      }

      case 'subscription.updated': {
        const rawStatus = data.status as string | undefined
        const status =
          rawStatus === 'active'
            ? 'active'
            : rawStatus === 'on_hold' || rawStatus === 'past_due'
              ? 'past_due'
              : rawStatus === 'paused'
                ? 'paused'
                : 'cancelled'
        if (subscriptionId) {
          await supabase
            .from('user_profiles')
            .update({ subscription_status: status })
            .eq('dodo_subscription_id', subscriptionId)
        }
        break
      }

      case 'subscription.on_hold': {
        if (subscriptionId) {
          await supabase
            .from('user_profiles')
            .update({ subscription_status: 'past_due' })
            .eq('dodo_subscription_id', subscriptionId)
        }
        break
      }

      case 'subscription.paused': {
        if (subscriptionId) {
          await supabase
            .from('user_profiles')
            .update({ subscription_status: 'paused' })
            .eq('dodo_subscription_id', subscriptionId)
        }
        break
      }

      case 'payment.failed': {
        if (customerId) {
          await supabase
            .from('user_profiles')
            .update({ subscription_status: 'past_due' })
            .eq('dodo_customer_id', customerId)
        }
        break
      }

      case 'subscription.cancelled':
      case 'subscription.expired':
      case 'subscription.failed': {
        if (subscriptionId) {
          await supabase
            .from('user_profiles')
            .update({
              plan_type: 'free',
              subscription_status: 'cancelled',
              dodo_subscription_id: null,
              dodo_product_id: null,
            })
            .eq('dodo_subscription_id', subscriptionId)
        }
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
