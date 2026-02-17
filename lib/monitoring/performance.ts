import { getCacheMetrics } from '@/lib/cache/redis'

type ApiRouteMetric = {
  route: string
  method: string
  durationMs: number
  statusCode: number
  timestamp: number
  slow: boolean
  error: boolean
}

type DatabaseQueryMetric = {
  source: 'server' | 'service-role' | 'unknown'
  operation: string
  target: string
  durationMs: number
  timestamp: number
  success: boolean
  slow: boolean
  errorMessage?: string
}

type WebVitalName = 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'

type WebVitalMetric = {
  name: WebVitalName
  id: string
  value: number
  rating: string
  delta: number
  path: string
  timestamp: number
}

type ExternalApiMetric = {
  service: string
  operation: string
  costUsd: number
  durationMs: number
  statusCode: number
  success: boolean
  timestamp: number
}

type AlertMetric = {
  id: string
  type: 'api-response-time' | 'error-rate' | 'database-query' | 'external-api-budget'
  severity: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: number
  context?: Record<string, unknown>
}

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

type ExternalApiBudgetSummary = {
  service: string
  spentUsd: number
  budgetUsd: number | null
  remainingUsd: number | null
  utilizationPercent: number | null
}

type PerformanceSnapshot = {
  windowMs: number
  generatedAt: string
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
    sets: number
    deletes: number
    errors: number
    refreshes: number
    namespaces: Record<
      string,
      {
        hits: number
        misses: number
        hitRatePercent: number
      }
    >
  }
  webVitals: {
    averages: Array<{ name: WebVitalName; avg: number; samples: number }>
    latest: WebVitalMetric[]
  }
  externalApis: {
    calls: number
    totalCostUsd: number
    byService: Array<{ service: string; calls: number; totalCostUsd: number; avgDurationMs: number }>
    budgets: ExternalApiBudgetSummary[]
  }
  alerts: AlertMetric[]
}

type MonitoredSupabaseSource = 'server' | 'service-role'

type TimedOperationOptions = {
  slowThresholdMs?: number
  context?: Record<string, unknown>
}

type RecordApiRouteMetricInput = {
  route: string
  method?: string
  durationMs: number
  statusCode?: number
  error?: boolean
}

type RecordDatabaseMetricInput = {
  source: 'server' | 'service-role' | 'unknown'
  operation: string
  target: string
  durationMs: number
  success: boolean
  errorMessage?: string
}

type RecordWebVitalInput = {
  name: WebVitalName
  id: string
  value: number
  rating?: string
  delta?: number
  path?: string
}

type RecordExternalApiInput = {
  service: string
  operation: string
  costUsd?: number
  durationMs?: number
  statusCode?: number
  success?: boolean
}

type QueryPoolState = {
  activeQueries: number
  maxConcurrentQueries: number
  totalQueries: number
  failedQueries: number
  totalDurationMs: number
}

type PerformanceState = {
  apiMetrics: ApiRouteMetric[]
  dbMetrics: DatabaseQueryMetric[]
  webVitals: WebVitalMetric[]
  externalApis: ExternalApiMetric[]
  alerts: AlertMetric[]
  alertCooldownByKey: Map<string, number>
  queryPool: QueryPoolState
}

type GlobalMonitoringState = typeof globalThis & {
  __ellynPerformanceState?: PerformanceState
}

const MAX_API_METRICS = 5000
const MAX_DB_METRICS = 5000
const MAX_WEB_VITAL_METRICS = 2000
const MAX_EXTERNAL_API_METRICS = 5000
const MAX_ALERTS = 500
const ALERT_COOLDOWN_MS = 5 * 60 * 1000

const SLOW_OPERATION_THRESHOLD_MS = parseEnvNumber('PERF_SLOW_OPERATION_MS', 500)
const API_RESPONSE_ALERT_MS = parseEnvNumber('PERF_ALERT_API_RESPONSE_MS', 1000)
const ERROR_RATE_ALERT_THRESHOLD = parseEnvNumber('PERF_ALERT_ERROR_RATE_PERCENT', 1) / 100
const DB_QUERY_ALERT_MS = parseEnvNumber('PERF_ALERT_DB_QUERY_MS', 5000)
const DASHBOARD_DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000
const ERROR_RATE_WINDOW_MS = 15 * 60 * 1000
const ERROR_RATE_MIN_SAMPLES = 20

function parseEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getPerformanceState(): PerformanceState {
  const globalState = globalThis as GlobalMonitoringState
  if (!globalState.__ellynPerformanceState) {
    globalState.__ellynPerformanceState = {
      apiMetrics: [],
      dbMetrics: [],
      webVitals: [],
      externalApis: [],
      alerts: [],
      alertCooldownByKey: new Map<string, number>(),
      queryPool: {
        activeQueries: 0,
        maxConcurrentQueries: 0,
        totalQueries: 0,
        failedQueries: 0,
        totalDurationMs: 0,
      },
    }
  }
  return globalState.__ellynPerformanceState
}

function pushLimited<T>(arr: T[], value: T, maxSize: number): void {
  arr.push(value)
  if (arr.length > maxSize) {
    arr.splice(0, arr.length - maxSize)
  }
}

function compactErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function normalizeServiceName(service: string): string {
  const normalized = String(service || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'unknown'
}

function resolveExternalApiDailyBudget(service: string): number | null {
  const normalized = normalizeServiceName(service).toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const serviceBudget = process.env[`EXTERNAL_API_BUDGET_${normalized}_DAILY_USD`]
  if (serviceBudget) {
    const parsed = Number(serviceBudget)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  const generic = process.env.EXTERNAL_API_BUDGET_DAILY_USD
  if (generic) {
    const parsed = Number(generic)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return null
}

function emitAlert(
  key: string,
  metric: Omit<AlertMetric, 'id' | 'timestamp'>
): void {
  const state = getPerformanceState()
  const now = Date.now()
  const lastSent = state.alertCooldownByKey.get(key) || 0

  if (now - lastSent < ALERT_COOLDOWN_MS) {
    return
  }

  state.alertCooldownByKey.set(key, now)

  const alert: AlertMetric = {
    ...metric,
    id: `${metric.type}:${now}:${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now,
  }

  pushLimited(state.alerts, alert, MAX_ALERTS)

  const logger = metric.severity === 'critical' ? console.error : console.warn
  logger('[Performance][Alert]', {
    type: alert.type,
    message: alert.message,
    value: alert.value,
    threshold: alert.threshold,
    context: alert.context || {},
  })
}

function evaluateErrorRateAlerts(route: string): void {
  const state = getPerformanceState()
  const now = Date.now()
  const recent = state.apiMetrics.filter((metric) => now - metric.timestamp <= ERROR_RATE_WINDOW_MS)

  if (recent.length >= ERROR_RATE_MIN_SAMPLES) {
    const overallErrors = recent.filter((metric) => metric.error).length
    const overallRate = overallErrors / recent.length
    if (overallRate > ERROR_RATE_ALERT_THRESHOLD) {
      emitAlert('api:error-rate:overall', {
        type: 'error-rate',
        severity: 'critical',
        message: `API error rate exceeded ${(ERROR_RATE_ALERT_THRESHOLD * 100).toFixed(2)}%`,
        value: roundTo(overallRate * 100, 2),
        threshold: roundTo(ERROR_RATE_ALERT_THRESHOLD * 100, 2),
        context: {
          sampleSize: recent.length,
          windowMs: ERROR_RATE_WINDOW_MS,
        },
      })
    }
  }

  const routeRecent = recent.filter((metric) => metric.route === route)
  if (routeRecent.length < ERROR_RATE_MIN_SAMPLES) return
  const routeErrors = routeRecent.filter((metric) => metric.error).length
  const routeRate = routeErrors / routeRecent.length

  if (routeRate > ERROR_RATE_ALERT_THRESHOLD) {
    emitAlert(`api:error-rate:${route}`, {
      type: 'error-rate',
      severity: 'warning',
      message: `Route error rate exceeded ${(ERROR_RATE_ALERT_THRESHOLD * 100).toFixed(2)}%`,
      value: roundTo(routeRate * 100, 2),
      threshold: roundTo(ERROR_RATE_ALERT_THRESHOLD * 100, 2),
      context: {
        route,
        sampleSize: routeRecent.length,
        windowMs: ERROR_RATE_WINDOW_MS,
      },
    })
  }
}

/**
 * Record API response timing and error metadata.
 */
export function recordApiRouteMetric(input: RecordApiRouteMetricInput): void {
  const durationMs = Math.max(0, Math.round(input.durationMs))
  const statusCode = Number.isFinite(input.statusCode) ? Number(input.statusCode) : 200
  const method = String(input.method || 'GET').toUpperCase()
  const route = String(input.route || '/api/unknown')
  const error = input.error === true || statusCode >= 500
  const slow = durationMs >= SLOW_OPERATION_THRESHOLD_MS

  const metric: ApiRouteMetric = {
    route,
    method,
    durationMs,
    statusCode,
    timestamp: Date.now(),
    slow,
    error,
  }

  const state = getPerformanceState()
  pushLimited(state.apiMetrics, metric, MAX_API_METRICS)

  if (slow) {
    console.warn('[Performance] Slow API response detected', {
      route,
      method,
      durationMs,
      thresholdMs: SLOW_OPERATION_THRESHOLD_MS,
      statusCode,
    })
  }

  if (durationMs >= API_RESPONSE_ALERT_MS) {
    emitAlert(`api:latency:${route}:${method}`, {
      type: 'api-response-time',
      severity: 'warning',
      message: `API response time exceeded ${API_RESPONSE_ALERT_MS}ms`,
      value: durationMs,
      threshold: API_RESPONSE_ALERT_MS,
      context: { route, method, statusCode },
    })
  }

  evaluateErrorRateAlerts(route)
}

/**
 * Monitor one API route execution and capture duration + status.
 */
export async function monitorApiRoute<T>(
  route: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await fn()
    const statusCode = result instanceof Response ? result.status : 200

    recordApiRouteMetric({
      route,
      method,
      durationMs: Date.now() - startedAt,
      statusCode,
      error: statusCode >= 500,
    })

    return result
  } catch (error) {
    recordApiRouteMetric({
      route,
      method,
      durationMs: Date.now() - startedAt,
      statusCode: 500,
      error: true,
    })
    throw error
  }
}

/**
 * Wrap a slow operation with timing and threshold logging.
 */
export async function timeOperation<T>(
  operationName: string,
  fn: () => Promise<T>,
  options: TimedOperationOptions = {}
): Promise<T> {
  const startedAt = Date.now()
  const slowThresholdMs = Number.isFinite(options.slowThresholdMs)
    ? Number(options.slowThresholdMs)
    : SLOW_OPERATION_THRESHOLD_MS

  try {
    const result = await fn()
    const durationMs = Date.now() - startedAt

    if (durationMs >= slowThresholdMs) {
      console.warn('[Performance] Slow operation detected', {
        operationName,
        durationMs,
        thresholdMs: slowThresholdMs,
        context: options.context || {},
      })
    }

    return result
  } catch (error) {
    const durationMs = Date.now() - startedAt
    if (durationMs >= slowThresholdMs) {
      console.warn('[Performance] Slow failing operation detected', {
        operationName,
        durationMs,
        thresholdMs: slowThresholdMs,
        context: options.context || {},
      })
    }
    throw error
  }
}

/**
 * Record one database query metric.
 */
export function recordDatabaseQueryMetric(input: RecordDatabaseMetricInput): void {
  const durationMs = Math.max(0, Math.round(input.durationMs))
  const operation = String(input.operation || 'query')
  const target = String(input.target || 'unknown')
  const source = input.source || 'unknown'
  const success = input.success === true
  const slow = durationMs >= SLOW_OPERATION_THRESHOLD_MS

  const metric: DatabaseQueryMetric = {
    source,
    operation,
    target,
    durationMs,
    timestamp: Date.now(),
    success,
    slow,
    errorMessage: success ? undefined : input.errorMessage,
  }

  const state = getPerformanceState()
  pushLimited(state.dbMetrics, metric, MAX_DB_METRICS)

  if (slow) {
    console.warn('[Performance] Slow database query detected', {
      source,
      operation,
      target,
      durationMs,
      thresholdMs: SLOW_OPERATION_THRESHOLD_MS,
      success,
    })
  }

  if (durationMs >= DB_QUERY_ALERT_MS) {
    emitAlert(`db:query:${source}:${target}:${operation}`, {
      type: 'database-query',
      severity: 'critical',
      message: `Database query exceeded ${DB_QUERY_ALERT_MS}ms`,
      value: durationMs,
      threshold: DB_QUERY_ALERT_MS,
      context: { source, target, operation, success },
    })
  }
}

/**
 * Wrap a database query for timing and pool/concurrency stats.
 */
export async function monitorDatabaseQuery<T>(
  context: {
    source: 'server' | 'service-role' | 'unknown'
    operation: string
    target: string
  },
  fn: () => Promise<T>
): Promise<T> {
  const state = getPerformanceState()
  const startedAt = Date.now()

  state.queryPool.activeQueries += 1
  state.queryPool.maxConcurrentQueries = Math.max(
    state.queryPool.maxConcurrentQueries,
    state.queryPool.activeQueries
  )

  try {
    const result = await fn()
    const durationMs = Date.now() - startedAt

    state.queryPool.totalQueries += 1
    state.queryPool.totalDurationMs += durationMs

    recordDatabaseQueryMetric({
      source: context.source,
      operation: context.operation,
      target: context.target,
      durationMs,
      success: true,
    })

    return result
  } catch (error) {
    const durationMs = Date.now() - startedAt

    state.queryPool.totalQueries += 1
    state.queryPool.failedQueries += 1
    state.queryPool.totalDurationMs += durationMs

    recordDatabaseQueryMetric({
      source: context.source,
      operation: context.operation,
      target: context.target,
      durationMs,
      success: false,
      errorMessage: compactErrorMessage(error),
    })

    throw error
  } finally {
    state.queryPool.activeQueries = Math.max(0, state.queryPool.activeQueries - 1)
  }
}

type BuilderMonitorState = {
  source: MonitoredSupabaseSource
  target: string
  operations: string[]
}

function wrapSupabaseBuilder(builder: unknown, state: BuilderMonitorState): unknown {
  if (!builder || typeof builder !== 'object') {
    return builder
  }

  const targetBuilder = builder as Record<string, unknown>

  return new Proxy(targetBuilder, {
    get(target, prop, receiver) {
      if (prop === 'then') {
        return (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
          const operation = state.operations[state.operations.length - 1] || 'query'
          const monitoredPromise = monitorDatabaseQuery(
            {
              source: state.source,
              operation,
              target: state.target,
            },
            async () => await (target as unknown as Promise<unknown>)
          )

          return monitoredPromise.then(onFulfilled, onRejected)
        }
      }

      if (prop === 'catch') {
        return (onRejected?: (reason: unknown) => unknown) => {
          const operation = state.operations[state.operations.length - 1] || 'query'
          const monitoredPromise = monitorDatabaseQuery(
            {
              source: state.source,
              operation,
              target: state.target,
            },
            async () => await (target as unknown as Promise<unknown>)
          )
          return monitoredPromise.catch(onRejected)
        }
      }

      if (prop === 'finally') {
        return (onFinally?: () => void) => {
          const operation = state.operations[state.operations.length - 1] || 'query'
          const monitoredPromise = monitorDatabaseQuery(
            {
              source: state.source,
              operation,
              target: state.target,
            },
            async () => await (target as unknown as Promise<unknown>)
          )
          return monitoredPromise.finally(onFinally)
        }
      }

      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') {
        return value
      }

      return (...args: unknown[]) => {
        const operationName = String(prop)
        const next = (value as (...params: unknown[]) => unknown).apply(target, args)

        if (next && typeof next === 'object') {
          return wrapSupabaseBuilder(next, {
            source: state.source,
            target: state.target,
            operations: [...state.operations, operationName],
          })
        }

        return next
      }
    },
  })
}

/**
 * Instruments Supabase client calls (`rpc`, `from`) with DB query timing.
 */
export function instrumentSupabaseClientPerformance<T extends object>(
  client: T,
  source: MonitoredSupabaseSource
): T {
  if (!client || typeof client !== 'object') return client

  const rawClient = client as Record<string, unknown>
  const hasFrom = typeof rawClient.from === 'function'
  const hasRpc = typeof rawClient.rpc === 'function'

  if (!hasFrom && !hasRpc) {
    return client
  }

  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)

      if (prop === 'rpc' && typeof value === 'function') {
        return async (fnName: string, ...args: unknown[]) =>
          monitorDatabaseQuery(
            {
              source,
              operation: 'rpc',
              target: fnName,
            },
            async () => await (value as (...params: unknown[]) => Promise<unknown>).apply(target, [fnName, ...args])
          )
      }

      if (prop === 'from' && typeof value === 'function') {
        return (table: string, ...args: unknown[]) => {
          const builder = (value as (...params: unknown[]) => unknown).apply(target, [table, ...args])
          return wrapSupabaseBuilder(builder, {
            source,
            target: String(table || 'unknown'),
            operations: ['from'],
          })
        }
      }

      return value
    },
  })
}

/**
 * Record incoming web vital metrics from the client.
 */
export function recordWebVitalMetric(input: RecordWebVitalInput): void {
  const metric: WebVitalMetric = {
    name: input.name,
    id: String(input.id || ''),
    value: Number(input.value || 0),
    rating: String(input.rating || 'unknown'),
    delta: Number(input.delta || 0),
    path: String(input.path || '/'),
    timestamp: Date.now(),
  }

  const state = getPerformanceState()
  pushLimited(state.webVitals, metric, MAX_WEB_VITAL_METRICS)
}

/**
 * Record external API usage (latency + cost) and evaluate daily budgets.
 */
export function recordExternalApiUsage(input: RecordExternalApiInput): void {
  const service = normalizeServiceName(input.service)
  const operation = String(input.operation || 'request')
  const costUsd = Math.max(0, Number(input.costUsd || 0))
  const durationMs = Math.max(0, Math.round(Number(input.durationMs || 0)))
  const statusCode = Number.isFinite(input.statusCode) ? Number(input.statusCode) : 200
  const success = input.success === undefined ? statusCode < 500 : input.success === true

  const metric: ExternalApiMetric = {
    service,
    operation,
    costUsd,
    durationMs,
    statusCode,
    success,
    timestamp: Date.now(),
  }

  const state = getPerformanceState()
  pushLimited(state.externalApis, metric, MAX_EXTERNAL_API_METRICS)

  const dailyBudget = resolveExternalApiDailyBudget(service)
  if (dailyBudget === null) return

  const since = Date.now() - 24 * 60 * 60 * 1000
  const spent = state.externalApis
    .filter((row) => row.service === service && row.timestamp >= since)
    .reduce((sum, row) => sum + row.costUsd, 0)

  if (spent > dailyBudget) {
    emitAlert(`external-budget:${service}`, {
      type: 'external-api-budget',
      severity: 'critical',
      message: `External API daily budget exceeded for ${service}`,
      value: roundTo(spent, 6),
      threshold: dailyBudget,
      context: {
        service,
        spentUsd: roundTo(spent, 6),
        budgetUsd: dailyBudget,
      },
    })
  }
}

function getRecentApiMetrics(windowMs: number): ApiRouteMetric[] {
  const state = getPerformanceState()
  const since = Date.now() - windowMs
  return state.apiMetrics.filter((metric) => metric.timestamp >= since)
}

function getRecentDbMetrics(windowMs: number): DatabaseQueryMetric[] {
  const state = getPerformanceState()
  const since = Date.now() - windowMs
  return state.dbMetrics.filter((metric) => metric.timestamp >= since)
}

function getRecentWebVitals(windowMs: number): WebVitalMetric[] {
  const state = getPerformanceState()
  const since = Date.now() - windowMs
  return state.webVitals.filter((metric) => metric.timestamp >= since)
}

function getRecentExternalApiMetrics(windowMs: number): ExternalApiMetric[] {
  const state = getPerformanceState()
  const since = Date.now() - windowMs
  return state.externalApis.filter((metric) => metric.timestamp >= since)
}

function buildEndpointSummaries(metrics: ApiRouteMetric[]): EndpointSummary[] {
  const map = new Map<string, { route: string; method: string; durations: number[]; errors: number; slow: number }>()

  for (const metric of metrics) {
    const key = `${metric.method}:${metric.route}`
    const row = map.get(key) || {
      route: metric.route,
      method: metric.method,
      durations: [],
      errors: 0,
      slow: 0,
    }
    row.durations.push(metric.durationMs)
    if (metric.error) row.errors += 1
    if (metric.slow) row.slow += 1
    map.set(key, row)
  }

  return [...map.values()].map((row) => {
    const total = row.durations.reduce((sum, value) => sum + value, 0)
    const requests = row.durations.length
    const maxResponseMs = row.durations.reduce((max, value) => Math.max(max, value), 0)
    const errorRatePercent = requests > 0 ? (row.errors / requests) * 100 : 0

    return {
      route: row.route,
      method: row.method,
      requests,
      avgResponseMs: requests > 0 ? roundTo(total / requests, 2) : 0,
      maxResponseMs,
      slowRequests: row.slow,
      errorRatePercent: roundTo(errorRatePercent, 2),
    }
  })
}

function buildDatabaseSummaries(metrics: DatabaseQueryMetric[]): DatabaseSummary[] {
  const map = new Map<
    string,
    {
      source: string
      operation: string
      target: string
      durations: number[]
      slow: number
      errors: number
    }
  >()

  for (const metric of metrics) {
    const key = `${metric.source}:${metric.operation}:${metric.target}`
    const row = map.get(key) || {
      source: metric.source,
      operation: metric.operation,
      target: metric.target,
      durations: [],
      slow: 0,
      errors: 0,
    }

    row.durations.push(metric.durationMs)
    if (metric.slow) row.slow += 1
    if (!metric.success) row.errors += 1
    map.set(key, row)
  }

  return [...map.entries()].map(([key, row]) => {
    const queries = row.durations.length
    const total = row.durations.reduce((sum, value) => sum + value, 0)
    const maxDurationMs = row.durations.reduce((max, value) => Math.max(max, value), 0)
    const errorRatePercent = queries > 0 ? (row.errors / queries) * 100 : 0

    return {
      key,
      source: row.source,
      operation: row.operation,
      target: row.target,
      queries,
      avgDurationMs: queries > 0 ? roundTo(total / queries, 2) : 0,
      maxDurationMs,
      slowQueries: row.slow,
      errorRatePercent: roundTo(errorRatePercent, 2),
    }
  })
}

function buildExternalBudgetSummaries(metrics: ExternalApiMetric[]): ExternalApiBudgetSummary[] {
  const byService = new Map<string, number>()
  for (const metric of metrics) {
    byService.set(metric.service, (byService.get(metric.service) || 0) + metric.costUsd)
  }

  return [...byService.entries()].map(([service, spent]) => {
    const budget = resolveExternalApiDailyBudget(service)
    if (budget === null) {
      return {
        service,
        spentUsd: roundTo(spent, 6),
        budgetUsd: null,
        remainingUsd: null,
        utilizationPercent: null,
      }
    }

    const remaining = Math.max(0, budget - spent)
    const utilization = budget > 0 ? (spent / budget) * 100 : 0
    return {
      service,
      spentUsd: roundTo(spent, 6),
      budgetUsd: roundTo(budget, 6),
      remainingUsd: roundTo(remaining, 6),
      utilizationPercent: roundTo(utilization, 2),
    }
  })
}

/**
 * Build dashboard-ready snapshot for route/API performance, DB, cache, and alerts.
 */
export function getPerformanceSnapshot(windowMs = DASHBOARD_DEFAULT_WINDOW_MS): PerformanceSnapshot {
  const boundedWindowMs = Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : DASHBOARD_DEFAULT_WINDOW_MS
  const apiMetrics = getRecentApiMetrics(boundedWindowMs)
  const dbMetrics = getRecentDbMetrics(boundedWindowMs)
  const webVitalMetrics = getRecentWebVitals(boundedWindowMs)
  const externalApiMetrics = getRecentExternalApiMetrics(boundedWindowMs)
  const state = getPerformanceState()

  const endpointAverages = buildEndpointSummaries(apiMetrics).sort((a, b) => b.avgResponseMs - a.avgResponseMs)
  const slowestEndpoints = [...endpointAverages].slice(0, 10)

  const totalApiDuration = apiMetrics.reduce((sum, metric) => sum + metric.durationMs, 0)
  const apiErrors = apiMetrics.filter((metric) => metric.error).length
  const apiErrorRate = apiMetrics.length > 0 ? (apiErrors / apiMetrics.length) * 100 : 0

  const dbSummaries = buildDatabaseSummaries(dbMetrics).sort((a, b) => b.avgDurationMs - a.avgDurationMs)
  const slowDbQueries = dbMetrics.filter((metric) => metric.slow).length
  const totalDbDuration = dbMetrics.reduce((sum, metric) => sum + metric.durationMs, 0)

  const webVitalGroups = new Map<WebVitalName, number[]>()
  for (const metric of webVitalMetrics) {
    const list = webVitalGroups.get(metric.name) || []
    list.push(metric.value)
    webVitalGroups.set(metric.name, list)
  }

  const webVitalAverages: Array<{ name: WebVitalName; avg: number; samples: number }> = []
  for (const [name, values] of webVitalGroups.entries()) {
    const avg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    webVitalAverages.push({
      name,
      avg: roundTo(avg, name === 'CLS' ? 4 : 2),
      samples: values.length,
    })
  }
  webVitalAverages.sort((a, b) => a.name.localeCompare(b.name))

  const latestWebVitals = [...webVitalMetrics].sort((a, b) => b.timestamp - a.timestamp).slice(0, 25)

  const externalByService = new Map<string, { calls: number; cost: number; duration: number }>()
  for (const metric of externalApiMetrics) {
    const row = externalByService.get(metric.service) || { calls: 0, cost: 0, duration: 0 }
    row.calls += 1
    row.cost += metric.costUsd
    row.duration += metric.durationMs
    externalByService.set(metric.service, row)
  }

  const externalByServiceRows = [...externalByService.entries()]
    .map(([service, value]) => ({
      service,
      calls: value.calls,
      totalCostUsd: roundTo(value.cost, 6),
      avgDurationMs: value.calls > 0 ? roundTo(value.duration / value.calls, 2) : 0,
    }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd || b.calls - a.calls)

  const externalBudgets = buildExternalBudgetSummaries(externalApiMetrics).sort((a, b) =>
    a.service.localeCompare(b.service)
  )

  const cacheMetrics = getCacheMetrics()
  const cacheHits = cacheMetrics.totals.hits
  const cacheMisses = cacheMetrics.totals.misses
  const cacheTotalReads = cacheHits + cacheMisses
  const cacheHitRatePercent = cacheTotalReads > 0 ? roundTo((cacheHits / cacheTotalReads) * 100, 2) : 0

  const namespaceCache: Record<
    string,
    {
      hits: number
      misses: number
      hitRatePercent: number
    }
  > = {}

  for (const [namespace, counters] of Object.entries(cacheMetrics.namespaces)) {
    const totalReads = counters.hits + counters.misses
    namespaceCache[namespace] = {
      hits: counters.hits,
      misses: counters.misses,
      hitRatePercent: totalReads > 0 ? roundTo((counters.hits / totalReads) * 100, 2) : 0,
    }
  }

  return {
    windowMs: boundedWindowMs,
    generatedAt: new Date().toISOString(),
    api: {
      totalRequests: apiMetrics.length,
      avgResponseMs: apiMetrics.length > 0 ? roundTo(totalApiDuration / apiMetrics.length, 2) : 0,
      errorRatePercent: roundTo(apiErrorRate, 2),
      endpointAverages,
      slowestEndpoints,
    },
    database: {
      totalQueries: dbMetrics.length,
      avgDurationMs: dbMetrics.length > 0 ? roundTo(totalDbDuration / dbMetrics.length, 2) : 0,
      slowQueries: slowDbQueries,
      activeQueries: state.queryPool.activeQueries,
      maxConcurrentQueries: state.queryPool.maxConcurrentQueries,
      failedQueries: state.queryPool.failedQueries,
      slowestTargets: dbSummaries.slice(0, 10),
    },
    cache: {
      hits: cacheHits,
      misses: cacheMisses,
      hitRatePercent: cacheHitRatePercent,
      sets: cacheMetrics.totals.sets,
      deletes: cacheMetrics.totals.deletes,
      errors: cacheMetrics.totals.errors,
      refreshes: cacheMetrics.totals.refreshes,
      namespaces: namespaceCache,
    },
    webVitals: {
      averages: webVitalAverages,
      latest: latestWebVitals,
    },
    externalApis: {
      calls: externalApiMetrics.length,
      totalCostUsd: roundTo(externalApiMetrics.reduce((sum, item) => sum + item.costUsd, 0), 6),
      byService: externalByServiceRows,
      budgets: externalBudgets,
    },
    alerts: [...state.alerts].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50),
  }
}

/**
 * Clears runtime performance metrics and alerts.
 */
export function resetPerformanceMetrics(): void {
  const state = getPerformanceState()
  state.apiMetrics = []
  state.dbMetrics = []
  state.webVitals = []
  state.externalApis = []
  state.alerts = []
  state.alertCooldownByKey.clear()
  state.queryPool = {
    activeQueries: 0,
    maxConcurrentQueries: 0,
    totalQueries: 0,
    failedQueries: 0,
    totalDurationMs: 0,
  }
}
