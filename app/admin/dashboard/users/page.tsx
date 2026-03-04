import { createServiceRoleClient } from '@/lib/supabase/server'

type UserRow = {
  id: string
  full_name: string | null
  email: string | null
  plan_type: string | null
  subscription_status: string | null
  persona: string | null
  created_at: string | null
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

export default async function UsersPage() {
  const supabase = await createServiceRoleClient()

  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, plan_type, subscription_status, persona, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (users ?? []) as UserRow[]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Users</h1>
        <p className="text-sm text-gray-400 mt-1">Last 100 registered accounts</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">#</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Name</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Email</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Plan</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Sub Status</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Persona</th>
                <th className="text-left text-xs text-gray-400 pb-3 pt-3 px-4 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 text-sm">No users found</td>
                </tr>
              ) : (
                rows.map((u, i) => (
                  <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-gray-600 tabular-nums">{i + 1}</td>
                    <td className="py-3 px-4 text-gray-300">{u.full_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{u.email || '—'}</td>
                    <td className={`py-3 px-4 font-medium capitalize ${planColor(u.plan_type)}`}>
                      {u.plan_type || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 capitalize">{u.subscription_status || '—'}</td>
                    <td className="py-3 px-4 text-gray-400 capitalize">{u.persona?.replace('_', ' ') || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 tabular-nums">{fmt(u.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
