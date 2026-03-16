import { NextRequest, NextResponse } from 'next/server'

import { requireAdminApiSecret } from '@/lib/auth/admin-api-secret'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type HealthWindowKey = '24h' | '7d' | '30d'
type ProviderName = 'clearbit' | 'brandfetch' | 'zerobounce' | 'gemini' | 'mistral'
type ProviderHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'no_data'

type EmailLookupRow = {
  created_at: string
  success: boolean
  duration_ms: number | null
  source: string | null
}

type ApiPredictionRow = {
  created_at: string
  ai_latency_ms: number | null
}

type ApiCostRow = {
  created_at: string
  service: string
  metadata: Record<string, unknown> | null
}

type QuotaRow = {
  user_id: string
  updated_at: string
  email_lookups_used: number | null
  email_lookups_limit: number | null
}

type PipelineSeriesPoint = {
  bucket: string
  total: number
  successCount: number
  failureCount: number
  successRate: number
  failureRate: number
}

type ProviderLatencyPoint = {
  bucket: string
  avgLatencyMs: number
  p95LatencyMs: number
  sampleCount: number
}

type QuotaTrendPoint = {
  bucket: string
  users: number
  used: number
  limit: number
  utilizationRate: number
}

type HealthWindowPayload = {
  bucketSize: 'hour' | 'day'
  pipeline: PipelineSeriesPoint[]
  providers: Record<ProviderName, ProviderLatencyPoint[]>
  quotaConsumption: QuotaTrendPoint[]
}

type ProviderSummary = {
  status: ProviderHealthStatus
  sampleCount24h: number
  avgLatencyMs24h: number | null
  p95LatencyMs24h: number | null
  latestBucketAt: string | null
}

type HealthResponse = {
  success: true
  generatedAt: string
  providerHealth: {
    overallStatus: ProviderHealthStatus
    providers: Record<ProviderName, ProviderSummary>
  }
  windows: Record<HealthWindowKey, HealthWindowPayload>
}

type BucketConfig = {
  hours: number
  bucketMs: number
  maxPoints: number
  bucketSize: 'hour' | 'day'
}

const PROVIDERS: ProviderName[] = ['clearbit', 'brandfetch', 'zerobounce', 'gemini', 'mistral']

const WINDOW_CONFIG: Record<HealthWindowKey, BucketConfig> = {
  '24h': {
    hours: 24,
    bucketMs: 60 * 60 * 1000,
    maxPoints: 24,
    bucketSize: 'hour',
  },
  '7d': {
    hours: 7 * 24,
    bucketMs: 6 * 60 * 60 * 1000,
    maxPoints: 28,
    bucketSize: 'hour',
  },
  '30d': {
    hours: 30 * 24,
    bucketMs: 24 * 60 * 60 * 1000,
    maxPoints: 30,
    bucketSize: 'day',
  },
}

const MAX_ROWS_PER_TABLE = 25_000

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function toIsoBucket(createdAt: string, bucketMs: number): string {
  const ts = Date.parse(createdAt)
  if (!Number.isFinite(ts)) return new Date(0).toISOString()
  return new Date(Math.floor(ts / bucketMs) * bucketMs).toISOString()
}

function trimAndSort<T extends { bucket: string }>(rows: T[], maxPoints: number): T[] {
  return [...rows].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-maxPoints)
}

function extractLatencyMs(metadata: Record<string, unknown> | null): number | null {
  if (!metadata || typeof metadata !== 'object') return null
  const directKeys = ['durationMs', 'duration_ms', 'latencyMs', 'latency_ms', 'aiLatencyMs', 'ai_latency_ms']
  for (const key of directKeys) {
    const value = toFiniteNumber(metadata[key])
    if (value !== null && value >= 0) return value
  }

  const nestedKeys = ['timing', 'metrics', 'performance']
  for (const key of nestedKeys) {
    const nested = metadata[key]
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue
    const nestedRecord = nested as Record<string, unknown>
    for (const nestedKey of directKeys) {
      const value = toFiniteNumber(nestedRecord[nestedKey])
      if (value !== null && value >= 0) return value
    }
  }

  return null
}

function normalizeProvider(service: string): ProviderName | null {
  const normalized = service.toLowerCase().trim()
  if (normalized.includes('clearbit')) return 'clearbit'
  if (normalized.includes('brandfetch')) return 'brandfetch'
  if (normalized.includes('zerobounce') || normalized.includes('zero-bounce')) return 'zerobounce'
  if (normalized.includes('gemini')) return 'gemini'
  if (normalized.includes('mistral')) return 'mistral'
  return null
}

function providerStatusFromLatency(avg: number | null, p95: number | null): ProviderHealthStatus {
  if (avg === null || p95 === null) return 'no_data'
  if (p95 >= 7000 || avg >= 4000) return 'unhealthy'
  if (p95 >= 3000 || avg >= 1500) return 'degraded'
  return 'healthy'
}

function combineOverallStatus(statuses: ProviderHealthStatus[]): ProviderHealthStatus {
  if (statuses.some((status) => status === 'unhealthy')) return 'unhealthy'
  if (statuses.some((status) => status === 'degraded')) return 'degraded'
  if (statuses.some((status) => status === 'healthy')) return 'healthy'
  return 'no_data'
}

function percentile95(samples: number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1))
  return Math.round(sorted[idx] * 100) / 100
}

function avg(samples: number[]): number {
  if (samples.length === 0) return 0
  return Math.round((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 100) / 100
}

export async function GET(request: NextRequest) {
  const guardResponse = requireAdminApiSecret(request)
  if (guardResponse) {
    return guardResponse
  }

  try {
    const serviceClient = await createServiceRoleClient()
    const now = Date.now()
    const earliestWindowStart = new Date(now - WINDOW_CONFIG['30d'].hours * 60 * 60 * 1000).toISOString()

    const [lookupRes, predictionRes, costRes, quotaRes] = await Promise.all([
      serviceClient
        .from('email_lookups')
        .select('created_at, success, duration_ms, source')
        .gte('created_at', earliestWindowStart)
        .order('created_at', { ascending: true })
        .limit(MAX_ROWS_PER_TABLE),
      serviceClient
        .from('api_predictions')
        .select('created_at, ai_latency_ms')
        .gte('created_at', earliestWindowStart)
        .order('created_at', { ascending: true })
        .limit(MAX_ROWS_PER_TABLE),
      serviceClient
        .from('api_costs')
        .select('created_at, service, metadata')
        .in('service', PROVIDERS)
        .gte('created_at', earliestWindowStart)
        .order('created_at', { ascending: true })
        .limit(MAX_ROWS_PER_TABLE),
      serviceClient
        .from('user_quotas')
        .select('user_id, updated_at, email_lookups_used, email_lookups_limit')
        .gte('updated_at', earliestWindowStart)
        .order('updated_at', { ascending: true })
        .limit(MAX_ROWS_PER_TABLE),
    ])

    if (lookupRes.error || predictionRes.error || costRes.error || quotaRes.error) {
      console.error('[admin/health] Failed query', {
        lookupError: lookupRes.error?.message,
        predictionError: predictionRes.error?.message,
        costError: costRes.error?.message,
        quotaError: quotaRes.error?.message,
      })
      return NextResponse.json({ error: 'Failed to fetch health metrics' }, { status: 500 })
    }

    const lookups = (lookupRes.data ?? []) as EmailLookupRow[]
    const predictions = (predictionRes.data ?? []) as ApiPredictionRow[]
    const costs = (costRes.data ?? []) as ApiCostRow[]
    const quotas = (quotaRes.data ?? []) as QuotaRow[]

    const windows = {} as Record<HealthWindowKey, HealthWindowPayload>

    for (const [windowKey, config] of Object.entries(WINDOW_CONFIG) as Array<[HealthWindowKey, BucketConfig]>) {
      const windowStart = new Date(now - config.hours * 60 * 60 * 1000).toISOString()

      const windowLookups = lookups.filter((row) => row.created_at >= windowStart)
      const windowPredictions = predictions.filter((row) => row.created_at >= windowStart)
      const windowCosts = costs.filter((row) => row.created_at >= windowStart)
      const windowQuotas = quotas.filter((row) => row.updated_at >= windowStart)

      const pipelineMap = new Map<string, { total: number; success: number; failure: number }>()
      for (const row of windowLookups) {
        const bucket = toIsoBucket(row.created_at, config.bucketMs)
        const current = pipelineMap.get(bucket) ?? { total: 0, success: 0, failure: 0 }
        current.total += 1
        if (row.success) current.success += 1
        else current.failure += 1
        pipelineMap.set(bucket, current)
      }

      const pipeline = trimAndSort(
        [...pipelineMap.entries()].map(([bucket, values]) => ({
          bucket,
          total: values.total,
          successCount: values.success,
          failureCount: values.failure,
          successRate: values.total > 0 ? Math.round((values.success / values.total) * 10000) / 100 : 0,
          failureRate: values.total > 0 ? Math.round((values.failure / values.total) * 10000) / 100 : 0,
        })),
        config.maxPoints
      )

      const providerLatencySamples = new Map<ProviderName, Map<string, number[]>>()
      for (const provider of PROVIDERS) {
        providerLatencySamples.set(provider, new Map())
      }

      for (const row of windowLookups) {
        const source = String(row.source || '').toLowerCase().trim()
        if (source !== 'zerobounce') continue
        const latency = toFiniteNumber(row.duration_ms)
        if (latency === null || latency < 0) continue
        const bucket = toIsoBucket(row.created_at, config.bucketMs)
        const byBucket = providerLatencySamples.get('zerobounce')
        const samples = byBucket?.get(bucket) ?? []
        samples.push(latency)
        byBucket?.set(bucket, samples)
      }

      for (const row of windowCosts) {
        const provider = normalizeProvider(row.service)
        if (!provider) continue
        const latency = extractLatencyMs(row.metadata)
        if (latency === null || latency < 0) continue
        const bucket = toIsoBucket(row.created_at, config.bucketMs)
        const byBucket = providerLatencySamples.get(provider)
        const samples = byBucket?.get(bucket) ?? []
        samples.push(latency)
        byBucket?.set(bucket, samples)
      }

      for (const row of windowPredictions) {
        const latency = toFiniteNumber(row.ai_latency_ms)
        if (latency === null || latency < 0) continue
        const bucket = toIsoBucket(row.created_at, config.bucketMs)
        const geminiSamples = providerLatencySamples.get('gemini')?.get(bucket) ?? []
        geminiSamples.push(latency)
        providerLatencySamples.get('gemini')?.set(bucket, geminiSamples)
      }

      const providers = {} as Record<ProviderName, ProviderLatencyPoint[]>
      for (const provider of PROVIDERS) {
        const byBucket = providerLatencySamples.get(provider) ?? new Map<string, number[]>()
        providers[provider] = trimAndSort(
          [...byBucket.entries()].map(([bucket, samples]) => ({
            bucket,
            avgLatencyMs: avg(samples),
            p95LatencyMs: percentile95(samples),
            sampleCount: samples.length,
          })),
          config.maxPoints
        )
      }

      const quotaMap = new Map<string, { users: Set<string>; used: number; limit: number }>()
      for (const row of windowQuotas) {
        const bucket = toIsoBucket(row.updated_at, config.bucketMs)
        const current = quotaMap.get(bucket) ?? { users: new Set<string>(), used: 0, limit: 0 }
        current.users.add(row.user_id)
        current.used += Math.max(0, toFiniteNumber(row.email_lookups_used) ?? 0)
        current.limit += Math.max(0, toFiniteNumber(row.email_lookups_limit) ?? 0)
        quotaMap.set(bucket, current)
      }

      const quotaConsumption = trimAndSort(
        [...quotaMap.entries()].map(([bucket, values]) => ({
          bucket,
          users: values.users.size,
          used: Math.round(values.used * 100) / 100,
          limit: Math.round(values.limit * 100) / 100,
          utilizationRate: values.limit > 0 ? Math.round((values.used / values.limit) * 10000) / 100 : 0,
        })),
        config.maxPoints
      )

      windows[windowKey] = {
        bucketSize: config.bucketSize,
        pipeline,
        providers,
        quotaConsumption,
      }
    }

    const providerSummary = {} as Record<ProviderName, ProviderSummary>
    for (const provider of PROVIDERS) {
      const points = windows['24h'].providers[provider] || []
      const sampleCount = points.reduce((sum, point) => sum + point.sampleCount, 0)
      const weightedAvg =
        sampleCount > 0
          ? Math.round(
              (points.reduce((sum, point) => sum + point.avgLatencyMs * point.sampleCount, 0) / sampleCount) * 100
            ) / 100
          : null
      const p95 = points.length > 0 ? Math.max(...points.map((point) => point.p95LatencyMs)) : null
      const status = providerStatusFromLatency(weightedAvg, p95)
      providerSummary[provider] = {
        status,
        sampleCount24h: sampleCount,
        avgLatencyMs24h: weightedAvg,
        p95LatencyMs24h: p95,
        latestBucketAt: points.length > 0 ? points[points.length - 1]?.bucket ?? null : null,
      }
    }

    const response: HealthResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
      providerHealth: {
        overallStatus: combineOverallStatus(PROVIDERS.map((provider) => providerSummary[provider].status)),
        providers: providerSummary,
      },
      windows,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[admin/health] Unexpected error', error)
    captureApiException(error, { route: '/api/admin/health', method: 'GET' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
