import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase'

type DodoEvent = {
  id?: string
  type?: string
  data?: Record<string, unknown>
}

type DodoSubscriptionData = {
  id?: string
  customer_id?: string
  product_id?: string
  current_period_start?: string
  current_period_end?: string
  metadata?: Record<string, unknown>
}

type DodoPaymentData = {
  customer_id?: string
}

// Dodo sends a signature header - verify it to reject forged requests.
function verifyDodoSignature(payload: string, signature: string, secret: string): boolean {
  if (!payload || !signature || !secret) return false

  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  const normalizedSignature = signature.trim().replace(/^sha256=/i, '')

  const receivedBuffer = Buffer.from(normalizedSignature)
  const expectedBuffer = Buffer.from(expected)
  if (receivedBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

function extractUserId(metadata: Record<string, unknown> | undefined): string | null {
  const fromSnake = metadata?.user_id
  const fromCamel = metadata?.userId
  if (typeof fromSnake === 'string' && fromSnake.trim()) return fromSnake
  if (typeof fromCamel === 'string' && fromCamel.trim()) return fromCamel
  return null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-dodo-signature') ?? ''
  const secret = process.env.DODO_WEBHOOK_SECRET ?? process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? ''

  if (!verifyDodoSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: DodoEvent
  try {
    event = JSON.parse(rawBody) as DodoEvent
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const eventId = typeof event.id === 'string' ? event.id : ''
  const eventType = typeof event.type === 'string' ? event.type : ''
  const eventData = event.data && typeof event.data === 'object' ? event.data : {}

  if (!eventId || !eventType) {
    return NextResponse.json({ error: 'Missing event id or type' }, { status: 400 })
  }

  const db = createServiceClient()

  // 1. Store raw event for audit + idempotency.
  const { error: insertError } = await db.from('dodo_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    payload: event as unknown as Record<string, unknown>,
  })

  if (insertError?.code === '23505') {
    // Duplicate event - already processed.
    return NextResponse.json({ received: true })
  }

  if (insertError) {
    return NextResponse.json(
      { error: 'Failed to persist webhook event', details: insertError.message },
      { status: 500 }
    )
  }

  // 2. Handle event types.
  try {
    switch (eventType) {
      case 'subscription.activated':
      case 'subscription.renewed': {
        const sub = eventData as DodoSubscriptionData
        const metadata = sub.metadata && typeof sub.metadata === 'object' ? sub.metadata : undefined
        const userId = extractUserId(metadata)

        const profileUpdate = {
          plan_type: 'pro' as const,
          subscription_status: 'active' as const,
          dodo_subscription_id: sub.id ?? null,
          dodo_customer_id: sub.customer_id ?? null,
          dodo_product_id: sub.product_id ?? null,
          subscription_period_start: sub.current_period_start ?? null,
          subscription_period_end: sub.current_period_end ?? null,
        }

        if (userId) {
          await db.from('user_profiles').update(profileUpdate).eq('id', userId)
        } else if (sub.customer_id) {
          await db.from('user_profiles').update(profileUpdate).eq('dodo_customer_id', sub.customer_id)
        }

        if (userId) {
          await db
            .from('user_quotas')
            .update({
              ai_generations_limit: 500,
              email_lookups_limit: 200,
            })
            .eq('user_id', userId)
        }
        break
      }

      case 'subscription.cancelled':
      case 'subscription.expired': {
        const sub = eventData as DodoSubscriptionData
        const metadata = sub.metadata && typeof sub.metadata === 'object' ? sub.metadata : undefined
        const userId = extractUserId(metadata)

        if (sub.id) {
          await db
            .from('user_profiles')
            .update({
              plan_type: 'free',
              subscription_status: 'cancelled',
            })
            .eq('dodo_subscription_id', sub.id)
        }

        if (userId) {
          await db
            .from('user_quotas')
            .update({
              ai_generations_limit: 50,
              email_lookups_limit: 20,
            })
            .eq('user_id', userId)
        }
        break
      }

      case 'subscription.paused': {
        const sub = eventData as DodoSubscriptionData
        if (sub.id) {
          await db
            .from('user_profiles')
            .update({
              subscription_status: 'paused',
            })
            .eq('dodo_subscription_id', sub.id)
        }
        break
      }

      case 'payment.failed': {
        const payment = eventData as DodoPaymentData
        if (payment.customer_id) {
          await db
            .from('user_profiles')
            .update({
              subscription_status: 'past_due',
            })
            .eq('dodo_customer_id', payment.customer_id)
        }
        break
      }

      default:
        break
    }

    // Mark event processed.
    await db
      .from('dodo_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error'
    await db.from('dodo_webhook_events').update({ error: message }).eq('event_id', eventId)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
