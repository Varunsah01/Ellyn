'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import type { AdminDomainStats } from '@/lib/domain-resolution-analytics'

const COLORS = ['#8b5cf6', '#7c3aed', '#6d28d9', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe']

export function DomainAccuracyCharts({ data }: { data: AdminDomainStats }) {
  const pieData = data.sourceBreakdown.map(s => ({
    name: s.domain_source,
    value: s.count,
  }))

  const barData = data.sourceBreakdown.map(s => ({
    name: s.domain_source.replace('_', ' '),
    'Success Rate': Math.round(s.success_rate),
  }))

  return (
    <div className="space-y-8">
      {/* Summary numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Logs</p>
          <p className="text-2xl font-bold text-white">{data.totalLogs.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">MX Failure Rate</p>
          <p className="text-2xl font-bold text-red-400">{data.mxFailureRate.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Heuristic Fallback</p>
          <p className="text-2xl font-bold text-amber-400">{data.heuristicFallbackRate.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sources</p>
          <p className="text-2xl font-bold text-white">{data.sourceBreakdown.length}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie — source breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-4">Source Breakdown</h3>
          {pieData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar — success rate per source */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-4">Success Rate by Source (%)</h3>
          {barData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="Success Rate" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top failed lookups */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Top Failed Lookups</h3>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Company</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Attempts</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Last Seen</th>
                <th className="text-left text-xs text-gray-400 py-3 px-4 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {data.topFailedLookups.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-gray-500">No failed lookups</td></tr>
              ) : (
                data.topFailedLookups.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-gray-300 capitalize">{row.company_name}</td>
                    <td className="py-3 px-4 text-red-400 font-medium">{row.attempts}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(row.last_seen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 text-gray-400 capitalize">{row.last_source.replace('_', ' ')}</td>
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
