import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { dodo } from '@/lib/dodo'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('dodo_customer_id')
      .eq('id', user.id)
      .single()

    const customerId = profile?.dodo_customer_id as string | null
    if (!customerId) {
      return NextResponse.json([])
    }

    const payments = await dodo.payments.list({ customer_id: customerId, page_size: 10 })
    const items = (payments as unknown as { items?: unknown[] }).items ?? []

    const result = items.map((p) => {
      const payment = p as {
        payment_id?: string
        created_at?: string
        total_amount?: number
        currency?: string
        status?: string
        receipt_url?: string
      }
      return {
        id: payment.payment_id ?? '',
        date: payment.created_at ?? '',
        amount_paid: payment.total_amount ?? 0,
        currency: payment.currency ?? 'usd',
        status: payment.status ?? null,
        invoice_pdf: null,
        hosted_invoice_url: payment.receipt_url ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[invoices] Error:', error)
    captureApiException(error, { route: '/api/v1/subscription/invoices', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 })
  }
}
