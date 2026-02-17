'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { RefreshCw, AlertTriangle, CheckCircle, TrendingDown, Database } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceBreakdown {
  domain_source: string
  count: number
  success_rate: number
  avg_confidence: number
}

interface FailedLookup {
  company_name: string
  attempts: number
  last_seen: string
  last_source: string
}

interface AdminDomainStats {
  sourceBreakdown: SourceBreakdown[]
  topFailedLookups: FailedLookup[]
  mxFailureRate: number
  heuristicFallbackRate: number
  totalLogs: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, string> = {
  known_database: '#22c55e',
  clearbit:       '#3b82f6',
  brandfetch:     '#a855f7',
  google_search:  '#f59e0b',
  heuristic:      '#ef4444',
  unknown:        '#6b7280',
}

const SOURCE_LABELS: Record<string, string> = {
  known_database: 'Known DB',
  clearbit:       'Clearbit',
  brandfetch:     'Brandfetch',
  google_search:  'Google Search',
  heuristic:      'Heuristic',
  unknown:        'Unknown',
}

const WINDOW_OPTIONS = [7, 14, 30, 90] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(n: number) {
  return `${n.toFixed(1)}%`
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  warning,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
  warning?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${warning ? 'text-red-500' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${warning ? 'text-red-500' : ''}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DomainAccuracyPage() {
  const [stats, setStats] = useState<AdminDomainStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/domain-accuracy?days=${windowDays}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Request failed')
      setStats(json.data as AdminDomainStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [windowDays])

  useEffect(() => {
    void load()
  }, [load])

  // Pie data — count by source
  const pieData =
    stats?.sourceBreakdown.map((row) => ({
      name: SOURCE_LABELS[row.domain_source] ?? row.domain_source,
      value: row.count,
      color: SOURCE_COLORS[row.domain_source] ?? SOURCE_COLORS.unknown,
    })) ?? []

  // Bar data — avg confidence by source
  const barData =
    stats?.sourceBreakdown.map((row) => ({
      source: SOURCE_LABELS[row.domain_source] ?? row.domain_source,
      confidence: Number(row.avg_confidence.toFixed(1)),
      successRate: Number(row.success_rate.toFixed(1)),
    })) ?? []

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Domain Resolution Accuracy</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Observability for the enrichment cascade — which layers are working?
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time window selector */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            {WINDOW_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                className={`px-3 py-1.5 transition-colors ${
                  windowDays === d
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Resolutions"
            value={stats.totalLogs.toLocaleString()}
            description={`Last ${windowDays} days`}
            icon={Database}
          />
          <StatCard
            title="Heuristic Fallback Rate"
            value={pct(stats.heuristicFallbackRate)}
            description="% resolved via guessing"
            icon={TrendingDown}
            warning={stats.heuristicFallbackRate > 30}
          />
          <StatCard
            title="MX Validation Failure"
            value={pct(stats.mxFailureRate)}
            description="% with no valid MX records"
            icon={AlertTriangle}
            warning={stats.mxFailureRate > 20}
          />
          <StatCard
            title="Known DB Hit Rate"
            value={pct(
              stats.totalLogs > 0
                ? ((stats.sourceBreakdown.find((s) => s.domain_source === 'known_database')?.count ?? 0) /
                    stats.totalLogs) *
                    100
                : 0
            )}
            description="% resolved instantly (best accuracy)"
            icon={CheckCircle}
          />
        </div>
      )}

      {loading && !stats && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading stats…
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie chart — source distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolution Source Distribution</CardTitle>
              <CardDescription>Which layer resolved each domain</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Resolutions']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Bar chart — avg confidence + MX success rate by source */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avg Confidence &amp; MX Success by Source</CardTitle>
              <CardDescription>Higher is better — heuristic should be lowest</CardDescription>
            </CardHeader>
            <CardContent>
              {barData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip unit="%" />
                    <Legend />
                    <Bar dataKey="confidence" name="Avg Confidence" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="successRate" name="MX Success Rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Source breakdown table */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Layer Performance Breakdown</CardTitle>
            <CardDescription>Detailed stats per resolution source</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium text-right">Resolutions</th>
                  <th className="pb-2 pr-4 font-medium text-right">Share</th>
                  <th className="pb-2 pr-4 font-medium text-right">MX Success</th>
                  <th className="pb-2 font-medium text-right">Avg Confidence</th>
                </tr>
              </thead>
              <tbody>
                {stats.sourceBreakdown
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <tr key={row.domain_source} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              SOURCE_COLORS[row.domain_source] ?? SOURCE_COLORS.unknown,
                          }}
                        />
                        {SOURCE_LABELS[row.domain_source] ?? row.domain_source}
                      </td>
                      <td className="py-2 pr-4 text-right">{row.count.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right">
                        {pct(stats.totalLogs > 0 ? (row.count / stats.totalLogs) * 100 : 0)}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right font-medium ${
                          row.success_rate < 50 ? 'text-red-500' : 'text-green-600'
                        }`}
                      >
                        {pct(row.success_rate)}
                      </td>
                      <td className="py-2 text-right">{row.avg_confidence.toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Top failed lookups */}
      {stats && stats.topFailedLookups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 20 Failed Company Lookups</CardTitle>
            <CardDescription>
              Companies where MX validation repeatedly fails — candidates for the known DB
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">#</th>
                  <th className="pb-2 pr-4 font-medium">Company</th>
                  <th className="pb-2 pr-4 font-medium text-right">Failures</th>
                  <th className="pb-2 pr-4 font-medium">Last Source</th>
                  <th className="pb-2 font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {stats.topFailedLookups.map((row, i) => (
                  <tr key={row.company_name} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium capitalize">{row.company_name}</td>
                    <td className="py-2 pr-4 text-right text-red-500 font-medium">
                      {row.attempts}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {SOURCE_LABELS[row.last_source] ?? row.last_source}
                    </td>
                    <td className="py-2 text-muted-foreground">{fmt(row.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
