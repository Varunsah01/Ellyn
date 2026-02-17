'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Database, Gauge, RefreshCw, Server } from 'lucide-react'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { showToast } from '@/lib/toast'

type EndpointSummary = {
  route: string
  method: string
  requests: number
  avgResponseMs: number
  maxResponseMs: number
  slowRequests: number
  errorRatePercent: number
}

type DatabaseSummary = {
  key: string
  source: string
  operation: string
  target: string
  queries: number
  avgDurationMs: number
  maxDurationMs: number
  slowQueries: number
  errorRatePercent: number
}

type AlertRow = {
  id: string
  type: string
  severity: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: number
}

type ExternalBudgetSummary = {
  service: string
  spentUsd: number
  budgetUsd: number | null
  remainingUsd: number | null
  utilizationPercent: number | null
}

type PerformanceSnapshot = {
  generatedAt: string
  windowMs: number
  api: {
    totalRequests: number
    avgResponseMs: number
    errorRatePercent: number
    endpointAverages: EndpointSummary[]
    slowestEndpoints: EndpointSummary[]
  }
  database: {
    totalQueries: number
    avgDurationMs: number
    slowQueries: number
    activeQueries: number
    maxConcurrentQueries: number
    failedQueries: number
    slowestTargets: DatabaseSummary[]
  }
  cache: {
    hits: number
    misses: number
    hitRatePercent: number
  }
  externalApis: {
    calls: number
    totalCostUsd: number
    budgets: ExternalBudgetSummary[]
  }
  alerts: AlertRow[]
}

type PerformanceResponse = {
  success: boolean
  error?: string
  data?: PerformanceSnapshot
}

const WINDOW_OPTIONS = [
  { label: '1h', value: 60 * 60 * 1000 },
  { label: '24h', value: 24 * 60 * 60 * 1000 },
  { label: '7d', value: 7 * 24 * 60 * 60 * 1000 },
]

function formatMs(value: number): string {
  return `${Math.round(value)}ms`
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString()
}

export default function PerformanceDashboardPage() {
  const [windowMs, setWindowMs] = useState<number>(24 * 60 * 60 * 1000)
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const fetchSnapshot = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')

    try {
      const response = await fetch(`/api/analytics/performance?windowMs=${windowMs}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = (await response.json()) as PerformanceResponse

      if (!response.ok || payload.success !== true || !payload.data) {
        throw new Error(payload.error || 'Failed to load performance data')
      }

      setSnapshot(payload.data)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load performance data'
      setError(message)
      showToast.error(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [windowMs])

  useEffect(() => {
    void fetchSnapshot(false)
  }, [fetchSnapshot])

  const generatedAt = useMemo(() => {
    if (!snapshot?.generatedAt) return 'n/a'
    return new Date(snapshot.generatedAt).toLocaleString()
  }, [snapshot])

  const endpointErrorRows = useMemo(() => {
    if (!snapshot) return []
    return snapshot.api.endpointAverages.filter((row) => row.errorRatePercent > 0)
  }, [snapshot])

  return (
    <DashboardShell breadcrumbs={[{ label: 'Performance' }]} loading={loading}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-fraunces font-bold">Performance Monitoring</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live API, database, cache, web vitals, and external budget telemetry.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Last updated: {generatedAt}</p>
          </div>
          <div className="flex items-center gap-2">
            {WINDOW_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={windowMs === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWindowMs(option.value)}
              >
                {option.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchSnapshot(true)
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Failed to load dashboard</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {snapshot ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    API Avg Response
                  </CardDescription>
                  <CardTitle>{formatMs(snapshot.api.avgResponseMs)}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {snapshot.api.totalRequests} requests, {formatPercent(snapshot.api.errorRatePercent)} errors
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    DB Avg Query
                  </CardDescription>
                  <CardTitle>{formatMs(snapshot.database.avgDurationMs)}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {snapshot.database.totalQueries} queries, {snapshot.database.slowQueries} slow
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    Cache Hit Rate
                  </CardDescription>
                  <CardTitle>{formatPercent(snapshot.cache.hitRatePercent)}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {snapshot.cache.hits} hits, {snapshot.cache.misses} misses
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Alerts
                  </CardDescription>
                  <CardTitle>{snapshot.alerts.length}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {snapshot.externalApis.calls} external API calls, {formatUsd(snapshot.externalApis.totalCostUsd)} spent
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Average Response Time by Endpoint</CardTitle>
                  <CardDescription>Windowed view of request count, latency, and error rate.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-3">Endpoint</th>
                        <th className="pb-2 pr-3">Requests</th>
                        <th className="pb-2 pr-3">Avg</th>
                        <th className="pb-2 pr-3">Max</th>
                        <th className="pb-2">Error Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.api.endpointAverages.slice(0, 10).map((row) => (
                        <tr key={`${row.method}:${row.route}`} className="border-t">
                          <td className="py-2 pr-3 font-mono text-xs">{row.method} {row.route}</td>
                          <td className="py-2 pr-3">{row.requests}</td>
                          <td className="py-2 pr-3">{formatMs(row.avgResponseMs)}</td>
                          <td className="py-2 pr-3">{formatMs(row.maxResponseMs)}</td>
                          <td className="py-2">{formatPercent(row.errorRatePercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Slowest Endpoints</CardTitle>
                  <CardDescription>Highest average latency over the selected window.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-3">Endpoint</th>
                        <th className="pb-2 pr-3">Avg</th>
                        <th className="pb-2 pr-3">Slow Requests</th>
                        <th className="pb-2">Error Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.api.slowestEndpoints.map((row) => (
                        <tr key={`slow:${row.method}:${row.route}`} className="border-t">
                          <td className="py-2 pr-3 font-mono text-xs">{row.method} {row.route}</td>
                          <td className="py-2 pr-3">{formatMs(row.avgResponseMs)}</td>
                          <td className="py-2 pr-3">{row.slowRequests}</td>
                          <td className="py-2">{formatPercent(row.errorRatePercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Database Query Performance</CardTitle>
                  <CardDescription>Slow queries and Supabase operation latency.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Active queries: {snapshot.database.activeQueries} | Max concurrent: {snapshot.database.maxConcurrentQueries} | Failed: {snapshot.database.failedQueries}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="pb-2 pr-3">Source/Target</th>
                          <th className="pb-2 pr-3">Operation</th>
                          <th className="pb-2 pr-3">Avg</th>
                          <th className="pb-2 pr-3">Max</th>
                          <th className="pb-2">Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.database.slowestTargets.map((row) => (
                          <tr key={row.key} className="border-t">
                            <td className="py-2 pr-3 font-mono text-xs">{row.source}:{row.target}</td>
                            <td className="py-2 pr-3">{row.operation}</td>
                            <td className="py-2 pr-3">{formatMs(row.avgDurationMs)}</td>
                            <td className="py-2 pr-3">{formatMs(row.maxDurationMs)}</td>
                            <td className="py-2">{formatPercent(row.errorRatePercent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Rates and Alerts</CardTitle>
                  <CardDescription>Alert stream for API, database, and budget thresholds.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Global API error rate: {formatPercent(snapshot.api.errorRatePercent)}
                  </div>
                  <div className="max-h-72 space-y-2 overflow-auto">
                    {snapshot.alerts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active alerts in this window.</p>
                    ) : (
                      snapshot.alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`rounded-md border p-3 ${
                            alert.severity === 'critical' ? 'border-destructive/40' : 'border-yellow-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{alert.message}</p>
                            <span className="text-xs uppercase text-muted-foreground">{alert.severity}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {alert.type} | value {alert.value} | threshold {alert.threshold} | {formatTimestamp(alert.timestamp)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  {endpointErrorRows.length > 0 ? (
                    <div className="pt-2 text-xs text-muted-foreground">
                      Endpoints with non-zero errors: {endpointErrorRows.length}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>External API Budget Monitoring</CardTitle>
                <CardDescription>Daily spend and budget utilization by service.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-3">Service</th>
                      <th className="pb-2 pr-3">Spent</th>
                      <th className="pb-2 pr-3">Budget</th>
                      <th className="pb-2 pr-3">Remaining</th>
                      <th className="pb-2">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.externalApis.budgets.length === 0 ? (
                      <tr>
                        <td className="py-2 text-muted-foreground" colSpan={5}>
                          No external API usage recorded in this window.
                        </td>
                      </tr>
                    ) : (
                      snapshot.externalApis.budgets.map((row) => (
                        <tr key={row.service} className="border-t">
                          <td className="py-2 pr-3">{row.service}</td>
                          <td className="py-2 pr-3">{formatUsd(row.spentUsd)}</td>
                          <td className="py-2 pr-3">{row.budgetUsd === null ? 'n/a' : formatUsd(row.budgetUsd)}</td>
                          <td className="py-2 pr-3">{row.remainingUsd === null ? 'n/a' : formatUsd(row.remainingUsd)}</td>
                          <td className="py-2">
                            {row.utilizationPercent === null ? 'n/a' : formatPercent(row.utilizationPercent)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardShell>
  )
}
