import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('plan_type, subscription_status')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[subscription/status] profile error:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    const planType: string = profile?.plan_type ?? 'free'
    const subscriptionStatus: string = profile?.subscription_status ?? 'inactive'

    const { data: quotaData } = await supabase
      .from('user_quotas')
      .select('email_lookups_used, email_lookups_limit, ai_draft_generations_used, reset_date')
      .eq('user_id', user.id)
      .single()

    const emailUsed = Number(quotaData?.email_lookups_used ?? 0)
    const emailLimit = Number(quotaData?.email_lookups_limit ?? 25)
    const aiDraftUsed = Number(quotaData?.ai_draft_generations_used ?? 0)
    const aiDraftLimit = planType === 'pro' ? 999999 : 15

    return NextResponse.json({
      plan_type: planType,
      subscription_status: subscriptionStatus,
      current_period_end: null,
      quota: {
        email: { used: emailUsed, limit: emailLimit },
        ai_draft: { used: aiDraftUsed, limit: aiDraftLimit },
        reset_date: quotaData?.reset_date ?? null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[subscription/status] Error:', error)
    return NextResponse.json({ error: 'Failed to get subscription status' }, { status: 500 })
  }
}
