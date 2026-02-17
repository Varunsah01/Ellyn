/**
 * Circuit breaker + retry logic for outbound external API calls.
 *
 * Design goals:
 * - Module-level state survives across requests within one Node process
 * - No external dependencies — pure in-memory
 * - Classifies errors consistently so callers can record structured types
 * - Retries only transient errors (timeout, rate_limit) — at most once
 */

// ---------------------------------------------------------------------------
// Error taxonomy
// ---------------------------------------------------------------------------

export type ApiErrorType =
  | 'timeout'           // fetch aborted / DNS timeout
  | 'rate_limit'        // HTTP 429
  | 'invalid_response'  // non-JSON, unexpected shape
  | 'api_error'         // HTTP 5xx
  | 'not_found'         // HTTP 404 — domain definitely not known
  | 'circuit_open'      // circuit breaker tripped, skip entirely

export class ApiCallError extends Error {
  constructor(
    public readonly errorType: ApiErrorType,
    message: string,
    public readonly retryAfterMs?: number,   // from Retry-After header
  ) {
    super(message)
    this.name = 'ApiCallError'
  }
}

// ---------------------------------------------------------------------------
// Error classifiers
// ---------------------------------------------------------------------------

export function classifyResponse(response: Response): ApiErrorType {
  if (response.status === 429) return 'rate_limit'
  if (response.status === 404) return 'not_found'
  if (response.status >= 500) return 'api_error'
  return 'invalid_response'   // 4xx other than 404/429
}

export function classifyFetchError(err: unknown): ApiErrorType {
  if (err instanceof Error && err.name === 'AbortError') return 'timeout'
  if (err instanceof Error && err.message.includes('timeout')) return 'timeout'
  return 'api_error'
}

// ---------------------------------------------------------------------------
// Per-service configuration
// ---------------------------------------------------------------------------

export type ServiceName = 'clearbit' | 'brandfetch' | 'google_search' | 'llm_prediction'

const SERVICE_CONFIG: Record<ServiceName, {
  timeoutMs: number
  maxConsecutiveFailures: number
  openDurationMs: number
}> = {
  clearbit:       { timeoutMs: 3_000, maxConsecutiveFailures: 10, openDurationMs: 5 * 60_000 },
  brandfetch:     { timeoutMs: 3_000, maxConsecutiveFailures: 10, openDurationMs: 5 * 60_000 },
  google_search:  { timeoutMs: 5_000, maxConsecutiveFailures: 10, openDurationMs: 5 * 60_000 },
  llm_prediction: { timeoutMs: 2_000, maxConsecutiveFailures: 5,  openDurationMs: 2 * 60_000 },
}

export function getServiceTimeout(service: ServiceName): number {
  return SERVICE_CONFIG[service].timeoutMs
}

// ---------------------------------------------------------------------------
// Circuit breaker state (module-level, survives across requests)
// ---------------------------------------------------------------------------

type CircuitState = { consecutiveFailures: number; openUntil: number | null }
const circuits = new Map<ServiceName, CircuitState>()

function getCircuit(service: ServiceName): CircuitState {
  if (!circuits.has(service)) {
    circuits.set(service, { consecutiveFailures: 0, openUntil: null })
  }
  return circuits.get(service)!
}

/**
 * Returns true if the circuit is closed (i.e. the call may proceed).
 * Returns false if the circuit is open — caller should skip the API entirely.
 * Implements half-open: after the open window expires, allows one probe through.
 */
export function checkCircuit(service: ServiceName): boolean {
  const state = getCircuit(service)
  if (state.openUntil !== null) {
    if (Date.now() < state.openUntil) return false  // still open
    // Half-open: allow one probe
    state.openUntil = null
  }
  return true
}

export function recordSuccess(service: ServiceName): void {
  const state = getCircuit(service)
  state.consecutiveFailures = 0
  state.openUntil = null
}

export function recordFailure(service: ServiceName, errorType: ApiErrorType): void {
  const cfg = SERVICE_CONFIG[service]
  const state = getCircuit(service)

  // Rate limit: open immediately for the full backoff duration
  if (errorType === 'rate_limit') {
    state.openUntil = Date.now() + cfg.openDurationMs
    console.warn(`[Circuit] ${service} rate-limited — circuit open for ${cfg.openDurationMs / 1000}s`)
    return
  }

  // not_found / invalid_response are not service-health signals — don't increment
  if (errorType === 'not_found' || errorType === 'invalid_response') return

  state.consecutiveFailures++
  if (state.consecutiveFailures >= cfg.maxConsecutiveFailures) {
    state.openUntil = Date.now() + cfg.openDurationMs
    console.warn(`[Circuit] ${service} opened after ${state.consecutiveFailures} consecutive failures`)
  }
}

// ---------------------------------------------------------------------------
// Retry wrapper
// ---------------------------------------------------------------------------

const RETRY_DELAY_MS: Partial<Record<ApiErrorType, number>> = {
  timeout:    1_000,  // retry once after 1s
  rate_limit: 5_000,  // retry once after 5s (Retry-After header overrides this in practice)
}

/**
 * Runs `fn` with at most one retry for transient errors (timeout, rate_limit).
 * Plugs into the circuit breaker: records successes and failures automatically.
 * Throws `ApiCallError` on terminal failure.
 */
export async function withRetry<T>(
  service: ServiceName,
  fn: () => Promise<T>,
): Promise<T> {
  let lastError: ApiCallError | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS[lastError!.errorType]
      if (!delay) throw lastError!              // not retryable
      await new Promise(r => setTimeout(r, delay))
    }

    try {
      const result = await fn()
      recordSuccess(service)
      return result
    } catch (err) {
      if (err instanceof ApiCallError) {
        recordFailure(service, err.errorType)
        lastError = err
        // Only timeout and rate_limit are retried — anything else: throw immediately
        if (err.errorType !== 'timeout' && err.errorType !== 'rate_limit') throw err
      } else {
        const errorType = classifyFetchError(err)
        const apiErr = new ApiCallError(
          errorType,
          err instanceof Error ? err.message : String(err),
        )
        recordFailure(service, errorType)
        lastError = apiErr
        if (errorType !== 'timeout') throw apiErr
      }
    }
  }

  throw lastError!
}
