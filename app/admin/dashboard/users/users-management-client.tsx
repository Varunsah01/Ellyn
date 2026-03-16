'use client'

import { useMemo, useState, useTransition } from 'react'

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

function planColor(plan: string | null) {
  if (plan === 'pro') return 'text-amber-400'
  if (plan === 'starter') return 'text-violet-400'
  return 'text-gray-500'
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function UsersManagementClient({
  users,
  applyBulkAction,
  getUserProfileDetails,
  impersonateUser,
}: {
  users: UserRow[]
  applyBulkAction: (input: {
    userIds: string[]
    action: 'reset_quota' | 'set_plan'
    planType?: 'starter' | 'pro' | 'free'
  }) => Promise<void>
  getUserProfileDetails: (userId: string) => Promise<UserProfileDetails>
  impersonateUser: (userId: string) => Promise<void>
}) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [profileUser, setProfileUser] = useState<UserRow | null>(null)
  const [profileData, setProfileData] = useState<UserProfileDetails | null>(null)

  const allSelected = useMemo(
    () => users.length > 0 && selectedUserIds.length === users.length,
    [users.length, selectedUserIds.length]
  )

  const toggleAll = () => {
    setSelectedUserIds(allSelected ? [] : users.map((u) => u.id))
  }

  const toggleOne = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const runBulkQuotaReset = () => {
    startTransition(async () => {
      await applyBulkAction({ userIds: selectedUserIds, action: 'reset_quota' })
      setSelectedUserIds([])
    })
  }

  const runBulkPlanChange = (planType: 'starter' | 'pro' | 'free') => {
    startTransition(async () => {
      await applyBulkAction({ userIds: selectedUserIds, action: 'set_plan', planType })
      setSelectedUserIds([])
    })
  }

  const openProfile = (user: UserRow) => {
    setProfileUser(user)
    setProfileData(null)
    startTransition(async () => {
      const details = await getUserProfileDetails(user.id)
      setProfileData(details)
    })
  }

  const runImpersonation = (userId: string) => {
    startTransition(async () => {
      await impersonateUser(userId)
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Users</h1>
        <p className="text-sm text-gray-400 mt-1">Last 100 registered accounts</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-2">
        <p className="text-xs text-gray-400 mr-2">{selectedUserIds.length} selected</p>
        <button
          disabled={selectedUserIds.length === 0 || isPending}
          onClick={runBulkQuotaReset}
          className="px-3 py-1.5 text-xs rounded-md bg-gray-800 text-white disabled:opacity-50"
        >
          Reset quotas
        </button>
        <button
          disabled={selectedUserIds.length === 0 || isPending}
          onClick={() => runBulkPlanChange('starter')}
          className="px-3 py-1.5 text-xs rounded-md bg-violet-700/80 text-white disabled:opacity-50"
        >
          Set Starter
        </button>
        <button
          disabled={selectedUserIds.length === 0 || isPending}
          onClick={() => runBulkPlanChange('pro')}
          className="px-3 py-1.5 text-xs rounded-md bg-amber-700/80 text-white disabled:opacity-50"
        >
          Set Pro
        </button>
        <button
          disabled={selectedUserIds.length === 0 || isPending}
          onClick={() => runBulkPlanChange('free')}
          className="px-3 py-1.5 text-xs rounded-md bg-slate-700 text-white disabled:opacity-50"
        >
          Set Free
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">#</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Name</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Email</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Plan</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Sub Status</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Persona</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Joined</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500 text-sm">No users found</td>
                </tr>
              ) : (
                users.map((u, i) => (
                  <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={() => toggleOne(u.id)}
                      />
                    </td>
                    <td className="py-3 px-4 text-gray-600 tabular-nums">{i + 1}</td>
                    <td className="py-3 px-4 text-gray-300">{u.full_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{u.email || '—'}</td>
                    <td className={`py-3 px-4 font-medium capitalize ${planColor(u.plan_type)}`}>
                      {u.plan_type || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 capitalize">{u.subscription_status || '—'}</td>
                    <td className="py-3 px-4 text-gray-400 capitalize">{u.persona?.replace('_', ' ') || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 tabular-nums">{fmt(u.created_at)}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openProfile(u)}
                          className="text-xs px-2 py-1 rounded bg-gray-800 text-white"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => runImpersonation(u.id)}
                          className="text-xs px-2 py-1 rounded bg-violet-700 text-white"
                        >
                          Impersonate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {profileUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setProfileUser(null)}>
          <div
            className="h-full w-full max-w-xl bg-gray-950 border-l border-gray-800 p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white">User Profile</h2>
            <p className="text-sm text-gray-400 mt-1">{profileUser.email ?? profileUser.id}</p>

            {!profileData ? (
              <p className="text-gray-400 text-sm mt-6">Loading profile details…</p>
            ) : (
              <div className="mt-6 space-y-6 text-sm">
                <section>
                  <h3 className="text-white font-medium mb-2">User Quota</h3>
                  <div className="bg-gray-900 border border-gray-800 rounded-md p-3 text-gray-300 space-y-1">
                    <p>Plan: <span className="capitalize">{profileData.quota?.plan_type ?? '—'}</span></p>
                    <p>Usage: {profileData.quota?.email_lookups_used ?? 0} / {profileData.quota?.email_lookups_limit ?? 0}</p>
                    <p>Period: {fmt(profileData.quota?.period_start ?? null)} → {fmt(profileData.quota?.period_end ?? null)}</p>
                  </div>
                </section>

                <section>
                  <h3 className="text-white font-medium mb-2">Connected Email Accounts</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-gray-400 mb-1">Gmail</p>
                      {profileData.gmailAccounts.length === 0 ? (
                        <p className="text-gray-500">No Gmail accounts</p>
                      ) : (
                        profileData.gmailAccounts.map((acc, idx) => (
                          <p key={`gmail-${idx}`} className="text-gray-300">{acc.email ?? '—'} · {fmt(acc.connectedAt)}</p>
                        ))
                      )}
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Outlook</p>
                      {profileData.outlookAccounts.length === 0 ? (
                        <p className="text-gray-500">No Outlook accounts</p>
                      ) : (
                        profileData.outlookAccounts.map((acc, idx) => (
                          <p key={`outlook-${idx}`} className="text-gray-300">{acc.email ?? '—'} · {fmt(acc.connectedAt)}</p>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-white font-medium mb-2">Sequence History</h3>
                  {profileData.sequenceHistory.length === 0 ? (
                    <p className="text-gray-500">No sequence activity</p>
                  ) : (
                    <div className="space-y-2">
                      {profileData.sequenceHistory.map((row) => (
                        <div key={row.id} className="border border-gray-800 rounded-md p-2">
                          <p className="text-gray-200">{row.sequence_name}</p>
                          <p className="text-xs text-gray-400 capitalize">{row.status ?? 'unknown'} · {fmt(row.enrolled_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
