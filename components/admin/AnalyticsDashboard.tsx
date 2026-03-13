"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Download, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"

type Period = "day" | "week" | "month" | "all"

type AdminSummary = {
  totalUsers: number
  totalLookups: number
  totalCostUsd: number
  avgCostPerLookup: number
  successRate: number
  cacheHitRate: number
  anthropicCost: number
  burnRateUsdPerHour: number
}

type TrendPoint = {
  bucket: string
  lookups: number
  successRate: number
  cacheHitRate: number
  costUsd: number
}

type DomainPoint = {
  domain: string
  lookups: number
}

type ServiceCost = {
  service: string
  costUsd: number
}

type AdminAnalyticsPayload = {
  success: boolean
  period: Period
  generatedAt: string
  summary: AdminSummary
  trends: TrendPoint[]
  topDomains: DomainPoint[]
  costByService: ServiceCost[]
  error?: string
}

const POLL_INTERVAL_MS = 30_000
const SERVICE_COLORS = ["#2563EB", "#8B5CF6", "#10B981", "#F97316", "#64748B"]

/**
 * Render the AnalyticsDashboard component.
 * @returns {unknown} JSX output for AnalyticsDashboard.
 * @example
 * <AnalyticsDashboard />
 */
export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>("day")
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAnalytics = useCallback(
    async (showRefreshState = false) => {
      if (showRefreshState) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const response = await fetch(`/api/v1/analytics/admin?period=${encodeURIComponent(period)}`, {
          method: "GET",
          cache: "no-store",
        })

        const payload = (await response.json()) as AdminAnalyticsPayload
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to load admin analytics")
        }

        setData(payload)
        setError(null)
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to load analytics"
        setError(message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [period]
  )

  useEffect(() => {
    void fetchAnalytics(false)
    const interval = setInterval(() => {
      void fetchAnalytics(true)
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [fetchAnalytics])

  const summary = data?.summary

  const formattedGeneratedAt = useMemo(() => {
    if (!data?.generatedAt) return "N/A"
    const date = new Date(data.generatedAt)
    if (Number.isNaN(date.getTime())) return "N/A"
    return date.toLocaleString()
  }, [data?.generatedAt])

  const exportCsv = useCallback(() => {
    if (!data) return

    const rows: string[] = [
      "section,metric,value",
      `summary,period,${data.period}`,
      `summary,generated_at_utc,${data.generatedAt}`,
      `summary,total_users,${data.summary.totalUsers}`,
      `summary,total_lookups,${data.summary.totalLookups}`,
      `summary,total_cost_usd,${data.summary.totalCostUsd}`,
      `summary,avg_cost_per_lookup_usd,${data.summary.avgCostPerLookup}`,
      `summary,success_rate_percent,${data.summary.successRate}`,
      `summary,cache_hit_rate_percent,${data.summary.cacheHitRate}`,
      `summary,burn_rate_usd_per_hour,${data.summary.burnRateUsdPerHour}`,
      "trends,bucket,lookups,success_rate_percent,cache_hit_rate_percent,cost_usd",
    ]

    for (const point of data.trends) {
      rows.push(
        [
          "trends",
          csvEscape(point.bucket),
          point.lookups,
          point.successRate,
          point.cacheHitRate,
          point.costUsd,
        ].join(",")
      )
    }

    rows.push("top_domains,domain,lookups")
    for (const domain of data.topDomains) {
      rows.push(["top_domains", csvEscape(domain.domain), domain.lookups].join(","))
    }

    rows.push("cost_by_service,service,cost_usd")
    for (const service of data.costByService) {
      rows.push(["cost_by_service", csvEscape(service.service), service.costUsd].join(","))
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `ellyn-admin-analytics-${data.period}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground">Last updated: {formattedGeneratedAt}</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="day">Last 24 hours</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchAnalytics(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button type="button" variant="outline" onClick={exportCsv} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Users" value={summary?.totalUsers} loading={loading} />
        <MetricCard title="Total Lookups" value={summary?.totalLookups} loading={loading} />
        <MetricCard title="Success Rate" value={formatPercent(summary?.successRate)} loading={loading} />
        <MetricCard title="Cache Hit Rate" value={formatPercent(summary?.cacheHitRate)} loading={loading} />
        <MetricCard title="Total Cost" value={formatCurrency(summary?.totalCostUsd)} loading={loading} />
        <MetricCard title="Avg Cost / Lookup" value={formatCurrency(summary?.avgCostPerLookup)} loading={loading} />
        <MetricCard title="Anthropic Cost" value={formatCurrency(summary?.anthropicCost)} loading={loading} />
        <MetricCard title="Cost Burn Rate" value={`${formatCurrency(summary?.burnRateUsdPerHour)}/hr`} loading={loading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Real-Time Cost Burn Rate">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data?.trends || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="costUsd" stroke="#2563EB" fill="#93C5FD" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Success and Cache Effectiveness">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data?.trends || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="successRate" stroke="#10B981" strokeWidth={2} name="Success Rate %" />
              <Line type="monotone" dataKey="cacheHitRate" stroke="#8B5CF6" strokeWidth={2} name="Cache Hit Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Domains by Lookup Volume">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.topDomains || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="domain" tick={{ fontSize: 12 }} interval={0} angle={-20} height={80} textAnchor="end" />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="lookups" fill="#2563EB" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cost Breakdown by Service">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data?.costByService || []}
                dataKey="costUsd"
                nameKey="service"
                outerRadius={100}
                label
              >
                {(data?.costByService || []).map((entry, index) => (
                  <Cell
                    key={`${entry.service}-${index}`}
                    fill={SERVICE_COLORS[index % SERVICE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

export default AnalyticsDashboard

function MetricCard({ title, value, loading }: { title: string; value: string | number | undefined; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <div className="h-7 w-24 animate-pulse rounded bg-muted" /> : <p className="text-2xl font-semibold">{value ?? "N/A"}</p>}
      </CardContent>
    </Card>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function formatCurrency(value: number | undefined): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return "$0.000000"
  return `$${amount.toFixed(6)}`
}

function formatPercent(value: number | undefined): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return "0.00%"
  return `${amount.toFixed(2)}%`
}

function csvEscape(value: string): string {
  if (/[,"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

