'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type PeriodStats = {
  total: number
  apiCalls: number
  cacheHits: number
  cacheHitRate: number
  costUsd: number
  deliverable: number
  undeliverable: number
  risky: number
  unknown: number
  deliverabilityRate: number
}

type DailyBreakdown = { date: string } & PeriodStats

type VerificationData = {
  success: boolean
  generatedAt: string
  periods: { today: PeriodStats; week: PeriodStats; month: PeriodStats }
  lastHour: PeriodStats & { activeUsers: number }
  dailyBreakdown: DailyBreakdown[]
  topDomains: Array<{ domain: string; count: number }>
  perUserStats: Array<{ userId: string; total: number; apiCalls: number; costUsd: number }>
}

function PeriodCard({ label, stats }: { label: string; stats: PeriodStats }) {
  const avgCost = stats.apiCalls > 0 ? stats.costUsd / stats.apiCalls : 0
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 font-medium">{label}</p>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total calls</span>
          <span className="text-white font-medium">{stats.total.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">API calls</span>
          <span className="text-white font-medium">{stats.apiCalls.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Cost</span>
          <span className="text-white font-medium">${stats.costUsd.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Avg cost/call</span>
          <span className="text-gray-300">${avgCost.toFixed(5)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Deliverability</span>
          <span className="text-emerald-400">{(stats.deliverabilityRate * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

export function VerificationCharts({ data }: { data: VerificationData }) {
  const barData = data.dailyBreakdown.map(d => ({
    date: d.date.slice(5), // MM-DD
    'API Calls': d.apiCalls,
    'Cache Hits': d.cacheHits,
  }))

  return (
    <div className="space-y-8">
      {/* Period cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PeriodCard label="Today" stats={data.periods.today} />
        <PeriodCard label="This Week" stats={data.periods.week} />
        <PeriodCard label="This Month" stats={data.periods.month} />
      </div>

      {/* Daily bar chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-4">Daily API Calls (last 7 days)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="API Calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Cache Hits" fill="#6d28d9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top domains */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Top Domains (last 30d)</h3>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Domain</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">API Calls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {data.topDomains.length === 0 ? (
                <tr><td colSpan={2} className="py-6 text-center text-gray-500">No data</td></tr>
              ) : (
                data.topDomains.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-gray-300 font-mono text-xs">{row.domain}</td>
                    <td className="py-3 px-4 text-violet-400 font-medium">{row.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-user stats */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Top Users by API Usage (last 30d)</h3>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">User ID</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Total</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">API Calls</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {data.perUserStats.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-gray-500">No data</td></tr>
              ) : (
                data.perUserStats.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-gray-400 font-mono text-xs">{row.userId}</td>
                    <td className="py-3 px-4 text-gray-300">{row.total}</td>
                    <td className="py-3 px-4 text-violet-400">{row.apiCalls}</td>
                    <td className="py-3 px-4 text-gray-300">${row.costUsd.toFixed(4)}</td>
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
