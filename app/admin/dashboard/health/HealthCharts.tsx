'use client'

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HealthResponse = Record<string, any>

export function HealthCharts({ data }: { data: HealthResponse }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-medium text-white mb-3">Health Snapshot</h2>
      <p className="text-xs text-gray-400 mb-4">
        Initial payload from the system health endpoint. Detailed visualizations will be added in a follow-up.
      </p>
      <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
=======
=======
>>>>>>> theirs
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type HealthData = Record<string, unknown>

type HealthApiResponse = {
  success?: boolean
  data?: HealthData
}

type HealthChartsProps = {
  initialData: HealthData
  children?: (args: {
    data: HealthData
    isRefreshing: boolean
    error: string | null
    refresh: () => Promise<void>
  }) => ReactNode
}

const FALLBACK_REFRESH_MS = 30_000
const REFRESH_DEBOUNCE_MS = 600
const HEALTH_TABLES = ['api_costs', 'email_lookups', 'api_predictions', 'user_quotas'] as const

export function HealthCharts({ initialData, children }: HealthChartsProps) {
  const [data, setData] = useState<HealthData>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const refreshHealth = useCallback(async () => {
    try {
      if (isMountedRef.current) {
        setIsRefreshing(true)
        setError(null)
      }

      const response = await fetch('/api/admin/health', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Failed to refresh health data (HTTP ${response.status})`)
      }

      const payload = (await response.json()) as HealthApiResponse | HealthData
      const nextData =
        'data' in payload && payload.data && typeof payload.data === 'object'
          ? payload.data
          : (payload as HealthData)

      if (isMountedRef.current) {
        setData(nextData)
      }
    } catch (refreshError) {
      if (isMountedRef.current) {
        setError(refreshError instanceof Error ? refreshError.message : 'Failed to refresh health data')
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false)
      }
    }
  }, [])

  const scheduleDebouncedRefresh = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      void refreshHealth()
    }, REFRESH_DEBOUNCE_MS)
  }, [refreshHealth])

  useEffect(() => {
    isMountedRef.current = true

    const channels = HEALTH_TABLES.map((table) =>
      supabase
        .channel(`admin-health:${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
          },
          () => {
            scheduleDebouncedRefresh()
          }
        )
        .subscribe()
    )

    const interval = setInterval(() => {
      void refreshHealth()
    }, FALLBACK_REFRESH_MS)

    return () => {
      isMountedRef.current = false

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }

      clearInterval(interval)
      channels.forEach((channel) => {
        void supabase.removeChannel(channel)
      })
    }
  }, [refreshHealth, scheduleDebouncedRefresh, supabase])

  if (children) {
    return <>{children({ data, isRefreshing, error, refresh: refreshHealth })}</>
  }

  return (
    <pre className="text-xs text-gray-400 overflow-auto rounded-lg border border-gray-800 bg-gray-900 p-4">
      {JSON.stringify(data, null, 2)}
    </pre>
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type PipelinePoint = {
  time: string
  successRate?: number
  failureRate?: number
  successCount?: number
  failureCount?: number
}

type ProviderLatencyPoint = {
  time: string
  zerobounce?: number
  clearbit?: number
  brandfetch?: number
  gemini?: number
  mistral?: number
}

type QuotaPoint = {
  time: string
  usedQuota?: number
  remainingQuota?: number
  consumedPercent?: number
}

type HealthChartsData = {
  pipeline: PipelinePoint[]
  latency: ProviderLatencyPoint[]
  quota: QuotaPoint[]
}

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
type HealthChartsProps = {
  data: HealthChartsData
  loading?: boolean
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
type ChartLoadingState = {
  pipeline?: boolean
  latency?: boolean
  quota?: boolean
}

type HealthChartsProps = {
  data: Partial<HealthChartsData>
  loading?: boolean | ChartLoadingState
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
}

const tooltipStyle = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 8,
}

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
function hasAnyNumeric<T extends object>(rows: T[], keys: Array<keyof T>): boolean {
  return rows.some(row =>
    keys.some(key => typeof row[key] === 'number' && Number.isFinite(row[key] as number)),
  )
}

<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
function ChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center">
      <p className="text-gray-500 text-sm text-center">{message}</p>
    </div>
  )
}

function ChartCard({
  title,
  loading,
  hasData,
  children,
}: {
  title: string
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
  loading?: boolean
=======
  loading: boolean
>>>>>>> theirs
=======
  loading: boolean
>>>>>>> theirs
=======
  loading: boolean
>>>>>>> theirs
  hasData: boolean
  children: ReactNode
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-white mb-4">{title}</h3>
      {loading ? <ChartState message="Loading chart data..." /> : hasData ? children : <ChartState message="No data" />}
    </div>
  )
}

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
export function HealthCharts({ data, loading = false }: HealthChartsProps) {
  const hasPipelineData = data.pipeline.length > 0
  const hasLatencyData = data.latency.length > 0
  const hasQuotaData = data.quota.length > 0
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
function resolveLoadingState(loading: HealthChartsProps['loading']): Required<ChartLoadingState> {
  if (typeof loading === 'boolean') {
    return { pipeline: loading, latency: loading, quota: loading }
  }

  return {
    pipeline: loading?.pipeline ?? false,
    latency: loading?.latency ?? false,
    quota: loading?.quota ?? false,
  }
}

export function HealthCharts({ data, loading = false }: HealthChartsProps) {
  const pipelineData = data.pipeline ?? []
  const latencyData = data.latency ?? []
  const quotaData = data.quota ?? []

  const loadingState = resolveLoadingState(loading)

  const pipelineHasRates = hasAnyNumeric(pipelineData, ['successRate', 'failureRate'])
  const pipelineHasCounts = hasAnyNumeric(pipelineData, ['successCount', 'failureCount'])
  const hasPipelineData = pipelineHasRates || pipelineHasCounts

  const hasLatencyData = hasAnyNumeric(latencyData, ['zerobounce', 'clearbit', 'brandfetch', 'gemini', 'mistral'])
  const hasQuotaData = hasAnyNumeric(quotaData, ['usedQuota', 'remainingQuota', 'consumedPercent'])
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs

  return (
    <div className="space-y-6">
      <ChartCard
        title="Pipeline Success vs Failure Over Time"
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
        loading={loading}
        hasData={hasPipelineData}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data.pipeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
        loading={loadingState.pipeline}
        hasData={hasPipelineData}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={pipelineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e5e7eb' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
            <Area type="monotone" dataKey="successRate" name="Success Rate" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
            <Area type="monotone" dataKey="failureRate" name="Failure Rate" stroke="#f87171" fill="#f8717133" strokeWidth={2} />
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
            {pipelineHasRates ? (
              <>
                <Area type="monotone" dataKey="successRate" name="Success Rate" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
                <Area type="monotone" dataKey="failureRate" name="Failure Rate" stroke="#f87171" fill="#f8717133" strokeWidth={2} />
              </>
            ) : (
              <>
                <Area type="monotone" dataKey="successCount" name="Success" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
                <Area type="monotone" dataKey="failureCount" name="Failure" stroke="#f87171" fill="#f8717133" strokeWidth={2} />
              </>
            )}
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="API Latency per Provider Over Time"
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
        loading={loading}
        hasData={hasLatencyData}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.latency} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
        loading={loadingState.latency}
        hasData={hasLatencyData}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={latencyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e5e7eb' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line type="monotone" dataKey="zerobounce" name="ZeroBounce" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="clearbit" name="Clearbit" stroke="#6366f1" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="brandfetch" name="Brandfetch" stroke="#06b6d4" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="gemini" name="Gemini" stroke="#22c55e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="mistral" name="Mistral" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Quota Consumption Trend Across User Base"
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
        loading={loading}
        hasData={hasQuotaData}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data.quota} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
        loading={loadingState.quota}
        hasData={hasQuotaData}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={quotaData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e5e7eb' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Area type="monotone" dataKey="usedQuota" name="Used Quota" stroke="#a78bfa" fill="#a78bfa4d" strokeWidth={2} />
            <Area type="monotone" dataKey="remainingQuota" name="Remaining Quota" stroke="#60a5fa" fill="#60a5fa33" strokeWidth={2} />
            <Line type="monotone" dataKey="consumedPercent" name="Consumed %" stroke="#f43f5e" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
  )
}
