/**
 * Async, fire-and-forget observability layer for domain resolution.
 * All writes are non-blocking so they never slow down the main API path.
 *
 * Supabase table required (see SQL below):
 *
 * create table if not exists domain_resolution_logs (
 *   id              uuid primary key default gen_random_uuid(),
 *   company_name    text not null,
 *   domain          text,
 *   domain_source   text not null,
 *   mx_valid        boolean,
 *   confidence_score numeric(5,2),
 *   attempted_layers jsonb,   -- array of { layer, result, error? }
 *   created_at      timestamptz not null default now()
 * );
 *
 * create index on domain_resolution_logs (domain_source);
 * create index on domain_resolution_logs (created_at);
 * create index on domain_resolution_logs (mx_valid);
 */

import { createServiceRoleClient } from '@/lib/supabase/server'

export type DomainSource =
  | 'known_database'
  | 'clearbit'
  | 'brandfetch'
  | 'llm_prediction'
  | 'google_search'
  | 'heuristic'
  | 'unknown'

export interface LayerAttempt {
  layer: DomainSource
  /** 'hit' = resolved a domain, 'miss' = returned nothing, 'error' = threw */
  result: 'hit' | 'miss' | 'error'
  error?: string
  /** Structured error type from ApiCallError (stored in schemaless JSONB — no migration needed) */
  errorType?: string
  /** true if withRetry attempted a second call before failing */
  retried?: boolean
}

export interface DomainResolutionEvent {
  companyName: string
  domain: string | null
  domainSource: DomainSource
  mxValid: boolean | null
  confidenceScore: number
  /** Optional per-layer breakdown for deeper diagnostics */
  attemptedLayers?: LayerAttempt[]
}

/**
 * Log a domain resolution event to Supabase asynchronously.
 * Errors are swallowed so a DB failure never breaks the API response.
 */
export function logDomainResolution(event: DomainResolutionEvent): void {
  // Intentionally not awaited — fire and forget
  void _writeLog(event).catch((err) => {
    console.error('[DomainAnalytics] Failed to write resolution log:', err)
  })
}

async function _writeLog(event: DomainResolutionEvent): Promise<void> {
  const supabase = await createServiceRoleClient()

  const { error } = await supabase.from('domain_resolution_logs').insert({
    company_name: event.companyName,
    domain: event.domain,
    domain_source: event.domainSource,
    mx_valid: event.mxValid,
    confidence_score: event.confidenceScore,
    attempted_layers: event.attemptedLayers ?? null,
  })

  if (error) {
    // Surface as a warning so it shows up in server logs without crashing
    console.warn('[DomainAnalytics] Insert error:', error.message)
  }
}

// ---------------------------------------------------------------------------
// Query helpers used by the admin dashboard API route
// ---------------------------------------------------------------------------

export interface SourceBreakdown {
  domain_source: string
  count: number
  success_rate: number        // % where mx_valid = true
  avg_confidence: number
}

export interface FailedLookup {
  company_name: string
  attempts: number
  last_seen: string
  last_source: string
}

export interface AdminDomainStats {
  sourceBreakdown: SourceBreakdown[]
  topFailedLookups: FailedLookup[]
  mxFailureRate: number        // overall % where mx_valid = false
  heuristicFallbackRate: number
  totalLogs: number
}

/**
 * Fetch aggregated stats for the admin dashboard.
 * This runs on the server (service role) so no auth is needed at the DB level.
 */
export async function getDomainResolutionStats(
  since?: Date
): Promise<AdminDomainStats> {
  const supabase = await createServiceRoleClient()

  const cutoff = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30d default

  // 1. Per-source breakdown
  const { data: rawLogs, error: logsError } = await supabase
    .from('domain_resolution_logs')
    .select('domain_source, mx_valid, confidence_score')
    .gte('created_at', cutoff.toISOString())

  if (logsError) {
    throw new Error(`Failed to fetch domain logs: ${logsError.message}`)
  }

  const logs = rawLogs ?? []
  const totalLogs = logs.length

  // Aggregate per source in-process (avoids complex SQL that varies by Supabase tier)
  const bySource = new Map<
    string,
    { count: number; mxValid: number; confidenceSum: number }
  >()

  let mxFailCount = 0
  let heuristicCount = 0

  for (const row of logs) {
    const src = String(row.domain_source ?? 'unknown')
    if (!bySource.has(src)) bySource.set(src, { count: 0, mxValid: 0, confidenceSum: 0 })
    const agg = bySource.get(src)!
    agg.count++
    if (row.mx_valid === true) agg.mxValid++
    if (row.mx_valid === false) mxFailCount++
    agg.confidenceSum += Number(row.confidence_score ?? 0)
    if (src === 'heuristic') heuristicCount++
  }

  const sourceBreakdown: SourceBreakdown[] = Array.from(bySource.entries()).map(
    ([src, agg]) => ({
      domain_source: src,
      count: agg.count,
      success_rate: agg.count > 0 ? (agg.mxValid / agg.count) * 100 : 0,
      avg_confidence: agg.count > 0 ? agg.confidenceSum / agg.count : 0,
    })
  )

  // 2. Top 20 failed company lookups (mx_valid = false)
  const { data: rawFailed, error: failedError } = await supabase
    .from('domain_resolution_logs')
    .select('company_name, domain_source, created_at')
    .eq('mx_valid', false)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })

  if (failedError) {
    throw new Error(`Failed to fetch failed lookups: ${failedError.message}`)
  }

  const failedAgg = new Map<string, { attempts: number; lastSeen: string; lastSource: string }>()
  for (const row of rawFailed ?? []) {
    const name = String(row.company_name ?? '').toLowerCase()
    if (!failedAgg.has(name)) {
      failedAgg.set(name, {
        attempts: 0,
        lastSeen: String(row.created_at),
        lastSource: String(row.domain_source ?? 'unknown'),
      })
    }
    const agg = failedAgg.get(name)!
    agg.attempts++
    if (row.created_at > agg.lastSeen) {
      agg.lastSeen = String(row.created_at)
      agg.lastSource = String(row.domain_source ?? 'unknown')
    }
  }

  const topFailedLookups: FailedLookup[] = Array.from(failedAgg.entries())
    .sort((a, b) => b[1].attempts - a[1].attempts)
    .slice(0, 20)
    .map(([name, agg]) => ({
      company_name: name,
      attempts: agg.attempts,
      last_seen: agg.lastSeen,
      last_source: agg.lastSource,
    }))

  return {
    sourceBreakdown,
    topFailedLookups,
    mxFailureRate: totalLogs > 0 ? (mxFailCount / totalLogs) * 100 : 0,
    heuristicFallbackRate: totalLogs > 0 ? (heuristicCount / totalLogs) * 100 : 0,
    totalLogs,
  }
}
