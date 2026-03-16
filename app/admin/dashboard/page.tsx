import Link from 'next/link'
import { createServiceRoleClient } from '@/lib/supabase/server'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="block bg-gray-900 border border-gray-800 rounded-xl p-4
                 hover:border-violet-500/50 hover:bg-gray-800/50 transition-all"
    >
      <p className="text-sm font-medium text-white">{title} →</p>
      <p className="text-xs text-gray-400 mt-0.5">{description}</p>
    </Link>
  )
}

export default async function AdminDashboardPage() {
  const supabase = await createServiceRoleClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: totalContacts },
    { data: costs },
    { data: activeUsers },
  ] = await Promise.all([
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('api_costs').select('cost_usd').gte('created_at', thirtyDaysAgo),
    supabase.from('api_costs').select('user_id').gte('created_at', oneDayAgo),
  ])

  const totalCost = costs?.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0) ?? 0
  const activeTodayCount = new Set((activeUsers ?? []).map(r => r.user_id)).size

  const now = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
        <p className="text-xs text-gray-500">Last updated {now}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Users"
          value={(totalUsers ?? 0).toLocaleString()}
          sub="registered accounts"
        />
        <StatCard
          label="Active Today"
          value={activeTodayCount.toLocaleString()}
          sub="API calls in last 24h"
        />
        <StatCard
          label="Emails Found"
          value={(totalContacts ?? 0).toLocaleString()}
          sub="total contacts"
        />
        <StatCard
          label="API Cost / 30d"
          value={`$${totalCost.toFixed(4)}`}
          sub="all services"
        />
      </div>

      {/* Quick links */}
      <h2 className="text-xs text-gray-400 uppercase tracking-wide mb-3 font-medium">Quick Links</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickLink
          href="/admin/dashboard/users"
          title="Users"
          description="Browse all registered accounts"
        />
        <QuickLink
          href="/admin/dashboard/integrations"
          title="Integrations"
          description="Gmail & Outlook OAuth health"
        />
        <QuickLink
          href="/admin/dashboard/domain-accuracy"
          title="Domain Accuracy"
          description="Resolution pipeline stats"
        />
        <QuickLink
          href="/admin/dashboard/verification"
          title="Verification"
          description="Abstract API usage & costs"
        />
        <QuickLink
          href="/admin/dashboard/health"
          title="Health"
          description="Pipeline reliability, latency, and quota trends"
        />
        <QuickLink
          href="/admin/dashboard/webhooks"
          title="Webhooks"
          description="Billing and integration event logs"
        />
      </div>
    </div>
  )
}
