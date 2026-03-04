import { createServiceRoleClient } from '@/lib/supabase/server'

type GmailRow = {
  gmail_email: string | null
  created_at: string | null
  token_expires_at: string | null
}

function statusLabel(total: number, expiringSoon: number) {
  if (total === 0) return { label: 'No connections', color: 'text-gray-500' }
  if (expiringSoon > 5) return { label: 'Attention needed', color: 'text-amber-400' }
  return { label: 'Operational', color: 'text-emerald-400' }
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function tokenStatus(expiresAt: string | null) {
  if (!expiresAt) return <span className="text-gray-500">Unknown</span>
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms < 0) return <span className="text-red-400">Expired</span>
  if (ms < 24 * 60 * 60 * 1000) return <span className="text-amber-400">Expiring soon</span>
  return <span className="text-emerald-400">Valid</span>
}

export default async function IntegrationsPage() {
  const supabase = await createServiceRoleClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const [
    { count: gmailCount },
    { count: outlookCount },
    { count: gmailRecent },
    { count: outlookRecent },
    { count: gmailExpiring },
    { count: outlookExpiring },
    { data: recentGmail },
    { data: recentOutlook },
  ] = await Promise.all([
    supabase.from('gmail_credentials').select('*', { count: 'exact', head: true }),
    supabase.from('outlook_credentials').select('*', { count: 'exact', head: true }),
    supabase.from('gmail_credentials').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('outlook_credentials').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('gmail_credentials').select('*', { count: 'exact', head: true }).lte('token_expires_at', in24h).gte('token_expires_at', now),
    supabase.from('outlook_credentials').select('*', { count: 'exact', head: true }).lte('token_expires_at', in24h).gte('token_expires_at', now),
    supabase.from('gmail_credentials').select('gmail_email, created_at, token_expires_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('outlook_credentials').select('outlook_email, created_at, token_expires_at').order('created_at', { ascending: false }).limit(20),
  ])

  const gmailStatus = statusLabel(gmailCount ?? 0, gmailExpiring ?? 0)
  const outlookStatus = statusLabel(outlookCount ?? 0, outlookExpiring ?? 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Integrations</h1>
        <p className="text-sm text-gray-400 mt-1">Gmail &amp; Outlook OAuth connection health</p>
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Gmail */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📧</span>
            <h2 className="text-base font-semibold text-white">Gmail</h2>
          </div>
          <dl className="space-y-2">
            <div className="flex justify-between text-sm">
              <dt className="text-gray-400">Connected accounts</dt>
              <dd className="text-white font-medium">{gmailCount ?? 0}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-400">Connected last 7d</dt>
              <dd className="text-white font-medium">{gmailRecent ?? 0}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-400">Tokens expiring soon</dt>
              <dd className="text-white font-medium">{gmailExpiring ?? 0}</dd>
            </div>
          </dl>
          <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-current inline-block" style={{ color: 'inherit' }} />
            <span className={`text-sm font-medium ${gmailStatus.color}`}>● {gmailStatus.label}</span>
          </div>
        </div>

        {/* Outlook */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📨</span>
            <h2 className="text-base font-semibold text-white">Outlook</h2>
          </div>
          <dl className="space-y-2">
            <div className="flex justify-between text-sm">
              <dt className="text-gray-400">Connected accounts</dt>
              <dd className="text-white font-medium">{outlookCount ?? 0}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-400">Connected last 7d</dt>
              <dd className="text-white font-medium">{outlookRecent ?? 0}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-400">Tokens expiring soon</dt>
              <dd className="text-white font-medium">{outlookExpiring ?? 0}</dd>
            </div>
          </dl>
          <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-1.5">
            <span className={`text-sm font-medium ${outlookStatus.color}`}>● {outlookStatus.label}</span>
          </div>
        </div>
      </div>

      {/* Recent Gmail connections */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-white mb-3">Recent Gmail Connections</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Email</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Connected At</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Token Expires</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {(recentGmail ?? []).length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-gray-500">No Gmail connections</td></tr>
              ) : (
                (recentGmail as GmailRow[]).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.gmail_email || '—'}</td>
                    <td className="py-3 px-4 text-gray-400">{fmt(row.created_at)}</td>
                    <td className="py-3 px-4 text-gray-400">{fmt(row.token_expires_at)}</td>
                    <td className="py-3 px-4">{tokenStatus(row.token_expires_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Outlook connections */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Recent Outlook Connections</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Email</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Connected At</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Token Expires</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {(recentOutlook ?? []).length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-gray-500">No Outlook connections</td></tr>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (recentOutlook as any[]).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.outlook_email || '—'}</td>
                    <td className="py-3 px-4 text-gray-400">{fmt(row.created_at)}</td>
                    <td className="py-3 px-4 text-gray-400">{fmt(row.token_expires_at)}</td>
                    <td className="py-3 px-4">{tokenStatus(row.token_expires_at)}</td>
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
