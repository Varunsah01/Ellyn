import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getAdminSession } from '@/lib/auth/admin-session'
import { IMPERSONATION_COOKIE_NAME } from '@/lib/auth/admin-impersonation'
import { createServiceRoleClient } from '@/lib/supabase/server'

import { UsersManagementClient } from './users-management-client'

type UserRow = {
  id: string
  full_name: string | null
  email: string | null
  plan_type: string | null
  subscription_status: string | null
  persona: string | null
  created_at: string | null
}

type UserProfileDetails = {
  quota: {
    plan_type: string | null
    email_lookups_used: number | null
    email_lookups_limit: number | null
    period_start: string | null
    period_end: string | null
  } | null
  gmailAccounts: Array<{ email: string | null; connectedAt: string | null }>
  outlookAccounts: Array<{ email: string | null; connectedAt: string | null }>
  sequenceHistory: Array<{ id: string; sequence_name: string; status: string | null; enrolled_at: string | null }>
}

export default async function UsersPage() {
  const supabase = await createServiceRoleClient()

  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, plan_type, subscription_status, persona, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (users ?? []) as UserRow[]

  async function applyBulkAction(input: {
    userIds: string[]
    action: 'reset_quota' | 'set_plan'
    planType?: 'starter' | 'pro' | 'free'
  }) {
    'use server'

    if (!input.userIds.length) return

    const adminSupabase = await createServiceRoleClient()

    if (input.action === 'reset_quota') {
      const now = new Date()
      const periodEnd = new Date(now.getTime())
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      await adminSupabase
        .from('user_quotas')
        .update({
          email_lookups_used: 0,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .in('user_id', input.userIds)

      return
    }

    if (!input.planType) return

    await Promise.all([
      adminSupabase
        .from('user_profiles')
        .update({ plan_type: input.planType })
        .in('id', input.userIds),
      adminSupabase
        .from('user_quotas')
        .update({ plan_type: input.planType, updated_at: new Date().toISOString() })
        .in('user_id', input.userIds),
    ])
  }

  async function getUserProfileDetails(userId: string): Promise<UserProfileDetails> {
    'use server'

    const adminSupabase = await createServiceRoleClient()

    const [quotaResult, gmailResult, outlookResult, enrollmentsResult] = await Promise.all([
      adminSupabase
        .from('user_quotas')
        .select('plan_type, email_lookups_used, email_lookups_limit, period_start, period_end')
        .eq('user_id', userId)
        .maybeSingle(),
      adminSupabase
        .from('gmail_credentials')
        .select('gmail_email, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      adminSupabase
        .from('outlook_credentials')
        .select('outlook_email, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      adminSupabase
        .from('sequence_enrollments')
        .select('id, sequence_id, status, enrolled_at')
        .eq('user_id', userId)
        .order('enrolled_at', { ascending: false })
        .limit(10),
    ])

    const sequenceIds = (enrollmentsResult.data ?? []).map((row) => row.sequence_id).filter(Boolean)
    const sequenceMap = new Map<string, string>()
    if (sequenceIds.length > 0) {
      const { data: sequences } = await adminSupabase
        .from('sequences')
        .select('id, name')
        .in('id', sequenceIds)
      for (const sequence of sequences ?? []) {
        sequenceMap.set(sequence.id, sequence.name ?? 'Untitled sequence')
      }
    }

    return {
      quota: quotaResult.data
        ? {
            plan_type: quotaResult.data.plan_type,
            email_lookups_used: quotaResult.data.email_lookups_used,
            email_lookups_limit: quotaResult.data.email_lookups_limit,
            period_start: quotaResult.data.period_start,
            period_end: quotaResult.data.period_end,
          }
        : null,
      gmailAccounts: (gmailResult.data ?? []).map((item) => ({
        email: item.gmail_email,
        connectedAt: item.created_at,
      })),
      outlookAccounts: (outlookResult.data ?? []).map((item) => ({
        email: item.outlook_email,
        connectedAt: item.created_at,
      })),
      sequenceHistory: (enrollmentsResult.data ?? []).map((enrollment) => ({
        id: enrollment.id,
        sequence_name: sequenceMap.get(enrollment.sequence_id) ?? 'Unknown sequence',
        status: enrollment.status,
        enrolled_at: enrollment.enrolled_at,
      })),
    }
  }

  async function impersonateUser(userId: string) {
    'use server'

    const adminSession = await getAdminSession()
    if (!adminSession) {
      throw new Error('Admin session required')
    }

    const adminToken = process.env.SECRET_ADMIN_TOKEN?.trim()
    if (!adminToken) {
      throw new Error('SECRET_ADMIN_TOKEN is not configured')
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/admin/impersonate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ userId, adminUsername: adminSession.username }),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('Failed to create impersonation session')
    }

    const data = (await response.json()) as { token: string; expiresInSeconds: number }

    const cookieStore = await cookies()
    cookieStore.set(IMPERSONATION_COOKIE_NAME, data.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: data.expiresInSeconds,
    })

    redirect('/dashboard')
  }

  return (
    <UsersManagementClient
      users={rows}
      applyBulkAction={applyBulkAction}
      getUserProfileDetails={getUserProfileDetails}
      impersonateUser={impersonateUser}
    />
  )
}
