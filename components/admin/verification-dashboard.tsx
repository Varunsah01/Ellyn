'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  RefreshCw,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Users,
  Clock,
  DollarSign,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

// ─── Types ────────────────────────────────────────────────────────────────────

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

type DailyPoint = PeriodStats & { date: string }

type LastHourStats = PeriodStats & { activeUsers: number }

type TopDomain = { domain: string; count: number }

type PerUserStat = {
  userId: string
  total: number
  apiCalls: number
  costUsd: number
}

type StatsPayload = {
  success: boolean
  generatedAt: string
  periods: { today: PeriodStats; week: PeriodStats; month: PeriodStats }
  lastHour: LastHourStats
  dailyBreakdown: DailyPoint[]
  topDomains: TopDomain[]
  perUserStats: PerUserStat[]
}

type PeriodKey = 'today' | 'week' | 'month'

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Today',
  week:  'Last 7 days',
  month: 'Last 30 days',
}

const DELIVERABILITY_COLORS = {
  deliverable:   '#22c55e',
  undeliverable: '#ef4444',
  risky:         '#f59e0b',
  unknown:       '#6b7280',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = {
  cost:    (v: number) => `$${v.toFixed(4)}`,
  pct:     (v: number) => `${(v * 100).toFixed(1)}%`,
  num:     (v: number) => v.toLocaleString(),
  date:    (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z')
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  },
  uid:     (id: string) => id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id,
}

function csvEscape(value: string | number): string {
  const s = String(value)
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string
  value: string
  sub: string
  icon: React.ElementType
  accent?: 'green' | 'red' | 'amber' | 'default'
}) {
  const accentClass = {
    green:   'text-green-600',
    red:     'text-red-500',
    amber:   'text-amber-500',
    default: '',
  }[accent ?? 'default']

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${accentClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VerificationDashboard() {
  const [data, setData]               = useState<StatsPayload | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [period, setPeriod]           = useState<PeriodKey>('today')
  const [clearing, setClearing]       = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearResult, setClearResult] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/admin/verification-stats', { cache: 'no-store' })
      const json = await res.json() as StatsPayload
      if (!res.ok || !json.success) throw new Error((json as { error?: string }).error ?? 'Request failed')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Clear cache ────────────────────────────────────────────────────────────

  const handleClearCache = useCallback(async () => {
    if (!clearConfirm) {
      setClearConfirm(true)
      return
    }
    setClearConfirm(false)
    setClearing(true)
    setClearResult(null)
    try {
      const res  = await fetch('/api/admin/verification-cache?scope=all', { method: 'DELETE' })
      const json = await res.json() as { success?: boolean; deleted?: number; error?: string }
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
      setClearResult(`Cleared ${json.deleted ?? 0} cache entries`)
      // Reload stats after clearing
      await load(false)
    } catch (err) {
      setClearResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setClearing(false)
    }
  }, [clearConfirm, load])

  // ── CSV export ─────────────────────────────────────────────────────────────

  const exportCsv = useCallback(() => {
    if (!data) return
    const rows: string[] = [
      'section,metric,value',
      `meta,generated_at,${data.generatedAt}`,
    ]

    const ps = data.periods[period]
    rows.push(`${period},total,${ps.total}`)
    rows.push(`${period},api_calls,${ps.apiCalls}`)
    rows.push(`${period},cache_hits,${ps.cacheHits}`)
    rows.push(`${period},cache_hit_rate,${ps.cacheHitRate}`)
    rows.push(`${period},cost_usd,${ps.costUsd}`)
    rows.push(`${period},deliverable,${ps.deliverable}`)
    rows.push(`${period},undeliverable,${ps.undeliverable}`)
    rows.push(`${period},risky,${ps.risky}`)
    rows.push(`${period},unknown,${ps.unknown}`)
    rows.push(`${period},deliverability_rate,${ps.deliverabilityRate}`)

    rows.push('daily,date,total,api_calls,cache_hits,cost_usd,deliverable,undeliverable,risky,unknown')
    for (const d of data.dailyBreakdown) {
      rows.push([
        'daily',
        csvEscape(d.date),
        d.total, d.apiCalls, d.cacheHits, d.costUsd,
        d.deliverable, d.undeliverable, d.risky, d.unknown,
      ].join(','))
    }

    rows.push('top_domains,domain,count')
    for (const t of data.topDomains) {
      rows.push(['top_domains', csvEscape(t.domain), t.count].join(','))
    }

    rows.push('per_user,user_id,total,api_calls,cost_usd')
    for (const u of data.perUserStats) {
      rows.push(['per_user', csvEscape(u.userId), u.total, u.apiCalls, u.costUsd].join(','))
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href     = url
    link.download = `verification-stats-${period}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [data, period])

  // ── Derived data ───────────────────────────────────────────────────────────

  const ps = data?.periods[period]

  const delivPieData = ps
    ? [
        { name: 'Deliverable',   value: ps.deliverable,   color: DELIVERABILITY_COLORS.deliverable },
        { name: 'Undeliverable', value: ps.undeliverable, color: DELIVERABILITY_COLORS.undeliverable },
        { name: 'Risky',         value: ps.risky,         color: DELIVERABILITY_COLORS.risky },
        { name: 'Unknown',       value: ps.unknown,        color: DELIVERABILITY_COLORS.unknown },
      ].filter(d => d.value > 0)
    : []

  const dailyChartData = (data?.dailyBreakdown ?? []).map(d => ({
    date:        fmt.date(d.date),
    'API Calls':  d.apiCalls,
    'Cache Hits': d.cacheHits,
    costUsd:      d.costUsd,
  }))

  const lh = data?.lastHour

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Verification Stats</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Abstract API usage, costs, and deliverability
            {data && (
              <span className="ml-2 text-xs">
                · Updated {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period tabs */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(key => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 transition-colors ${
                  period === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {PERIOD_LABELS[key]}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-7 w-24 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── KPI cards — selected period ── */}
      {ps && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Verifications"
            value={fmt.num(ps.total)}
            sub={`${fmt.num(ps.apiCalls)} live · ${fmt.num(ps.cacheHits)} cached`}
            icon={Activity}
          />
          <KpiCard
            title="Cost Incurred"
            value={fmt.cost(ps.costUsd)}
            sub="$0.001 per live call"
            icon={DollarSign}
          />
          <KpiCard
            title="Cache Hit Rate"
            value={fmt.pct(ps.cacheHitRate)}
            sub="7-day address cache"
            icon={CheckCircle2}
            accent={ps.cacheHitRate >= 0.4 ? 'green' : ps.cacheHitRate >= 0.2 ? 'amber' : 'red'}
          />
          <KpiCard
            title="Deliverability Rate"
            value={fmt.pct(ps.deliverabilityRate)}
            sub="Deliverable / (Deliverable + Undeliverable)"
            icon={CheckCircle2}
            accent={ps.deliverabilityRate >= 0.6 ? 'green' : ps.deliverabilityRate >= 0.3 ? 'amber' : 'default'}
          />
        </div>
      )}

      {/* ── Last-hour pulse ── */}
      {lh && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Verifs last hour',
              value: fmt.num(lh.total),
              icon: Clock,
            },
            {
              label: 'Live API calls',
              value: fmt.num(lh.apiCalls),
              icon: Activity,
            },
            {
              label: 'Active users',
              value: fmt.num(lh.activeUsers),
              icon: Users,
            },
            {
              label: 'Cost last hour',
              value: fmt.cost(lh.costUsd),
              icon: DollarSign,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3"
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-base font-semibold">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts row ── */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Daily verifications — stacked bar */}
          <SectionCard
            title="Daily Verifications (7 days)"
            description="Live API calls vs cache hits per day"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyChartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="API Calls"  stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Cache Hits" stackId="a" fill="#86efac" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Daily cost — area chart */}
          <SectionCard
            title="Daily Cost (7 days)"
            description="USD spent on Abstract API calls per day"
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dailyChartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => `$${Number(v).toFixed(3)}`}
                />
                <Tooltip formatter={(v: any) => [`$${Number(v ?? 0).toFixed(4)}`, 'Cost']} />
                <Area
                  type="monotone"
                  dataKey="costUsd"
                  name="Cost (USD)"
                  stroke="#8b5cf6"
                  fill="#ddd6fe"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Deliverability breakdown — pie */}
          <SectionCard
            title="Deliverability Breakdown"
            description={`Distribution for ${PERIOD_LABELS[period].toLowerCase()}`}
          >
            {delivPieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={delivPieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {delivPieData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [fmt.num(Number(v ?? 0)), 'Addresses']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}

            {/* Legend row with icons */}
            {ps && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: 'Deliverable',   icon: CheckCircle2, count: ps.deliverable,   cls: 'text-green-600' },
                  { label: 'Undeliverable', icon: XCircle,      count: ps.undeliverable, cls: 'text-red-500'   },
                  { label: 'Risky',         icon: AlertTriangle, count: ps.risky,         cls: 'text-amber-500' },
                  { label: 'Unknown',       icon: HelpCircle,   count: ps.unknown,        cls: 'text-muted-foreground' },
                ].map(({ label, icon: Icon, count, cls }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${cls}`} />
                    <span className="text-muted-foreground">{label}:</span>
                    <span className="font-medium">{fmt.num(count)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Top domains */}
          <SectionCard
            title="Top Verified Domains"
            description="Most-verified domains over last 30 days (live API calls only)"
          >
            {data.topDomains.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No domain data yet</p>
            ) : (
              <div className="space-y-1.5">
                {data.topDomains.map((row, i) => {
                  const max = data.topDomains[0]?.count ?? 1
                  const pct = (row.count / max) * 100
                  return (
                    <div key={row.domain} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-right text-muted-foreground text-xs">{i + 1}</span>
                      <span className="w-40 truncate font-mono text-xs">{row.domain}</span>
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-muted-foreground text-xs">
                        {fmt.num(row.count)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Per-user table ── */}
      {data && data.perUserStats.length > 0 && (
        <SectionCard
          title="Per-User Usage"
          description="Top users by live API call volume (last 30 days)"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">#</th>
                  <th className="pb-2 pr-4 font-medium">User ID</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total</th>
                  <th className="pb-2 pr-4 font-medium text-right">Live calls</th>
                  <th className="pb-2 pr-4 font-medium text-right">Cache hits</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.perUserStats.map((row, i) => (
                  <tr key={row.userId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{fmt.uid(row.userId)}</td>
                    <td className="py-2 pr-4 text-right">{fmt.num(row.total)}</td>
                    <td className="py-2 pr-4 text-right">{fmt.num(row.apiCalls)}</td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {fmt.num(row.total - row.apiCalls)}
                    </td>
                    <td className="py-2 text-right font-medium">{fmt.cost(row.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Cache management ── */}
      <div className="flex items-center gap-4 pt-2">
        <div className="flex items-center gap-2">
          <Button
            variant={clearConfirm ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => void handleClearCache()}
            disabled={clearing}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {clearing
              ? 'Clearing…'
              : clearConfirm
              ? 'Confirm — clear all verification cache'
              : 'Clear verification cache'}
          </Button>

          {clearConfirm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearConfirm(false)}
            >
              Cancel
            </Button>
          )}
        </div>

        {clearResult && (
          <p className="text-sm text-muted-foreground">{clearResult}</p>
        )}

        {!clearConfirm && !clearResult && (
          <p className="text-xs text-muted-foreground">
            Purges email:verification:* and mx:* Redis keys. Next lookups re-populate the cache.
          </p>
        )}
      </div>
    </div>
  )
}
