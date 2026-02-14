import { NextRequest, NextResponse } from 'next/server'

import { createServiceRoleClient } from '@/lib/supabase/server'

type ResolveDomainRequest = {
  companyName: string
}

type DomainSource = 'known_db' | 'clearbit' | 'brandfetch' | 'heuristic'

type ResolveDomainResponse = {
  domain: string
  confidence: number
  source: DomainSource
}

type DomainCacheRow = {
  company_name: string
  domain: string
  source: DomainSource
  timestamp: string
}

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const EXTERNAL_LOOKUP_TIMEOUT_MS = 900

const SOURCE_CONFIDENCE: Record<DomainSource, number> = {
  known_db: 0.98,
  clearbit: 0.9,
  brandfetch: 0.85,
  heuristic: 0.5,
}

const KNOWN_DOMAINS: Record<string, string> = {
  // Tech giants
  google: 'google.com',
  alphabet: 'abc.xyz',
  microsoft: 'microsoft.com',
  apple: 'apple.com',
  amazon: 'amazon.com',
  meta: 'meta.com',
  facebook: 'meta.com',
  netflix: 'netflix.com',
  tesla: 'tesla.com',
  nvidia: 'nvidia.com',
  intel: 'intel.com',
  amd: 'amd.com',
  ibm: 'ibm.com',
  oracle: 'oracle.com',
  adobe: 'adobe.com',
  salesforce: 'salesforce.com',
  cisco: 'cisco.com',
  hp: 'hp.com',
  hewlettpackard: 'hp.com',
  dell: 'dell.com',
  sap: 'sap.com',
  uber: 'uber.com',
  airbnb: 'airbnb.com',
  stripe: 'stripe.com',
  lyft: 'lyft.com',
  shopify: 'shopify.com',
  atlassian: 'atlassian.com',
  dropbox: 'dropbox.com',
  slack: 'slack.com',
  zoom: 'zoom.us',
  twilio: 'twilio.com',
  snowflake: 'snowflake.com',
  databricks: 'databricks.com',
  palantir: 'palantir.com',
  serviceNow: 'servicenow.com',
  servicenow: 'servicenow.com',
  workday: 'workday.com',
  hubspot: 'hubspot.com',
  notion: 'notion.so',
  figma: 'figma.com',
  canva: 'canva.com',
  github: 'github.com',
  gitlab: 'gitlab.com',
  openai: 'openai.com',
  anthropic: 'anthropic.com',
  claude: 'anthropic.com',
  perplexity: 'perplexity.ai',
  xai: 'x.ai',

  // Consulting and professional services
  mckinsey: 'mckinsey.com',
  bcg: 'bcg.com',
  bostonconsultinggroup: 'bcg.com',
  bain: 'bain.com',
  deloitte: 'deloitte.com',
  pwc: 'pwc.com',
  ey: 'ey.com',
  ernstyoung: 'ey.com',
  kpmg: 'kpmg.com',
  accenture: 'accenture.com',
  capgemini: 'capgemini.com',
  cognizant: 'cognizant.com',
  infosys: 'infosys.com',
  tcs: 'tcs.com',
  wipro: 'wipro.com',

  // Finance and banks
  goldmansachs: 'goldmansachs.com',
  goldman: 'goldmansachs.com',
  jpmorgan: 'jpmorgan.com',
  jpmorganchase: 'jpmorganchase.com',
  morganstanley: 'morganstanley.com',
  bankofamerica: 'bankofamerica.com',
  bofa: 'bofa.com',
  wellsfargo: 'wellsfargo.com',
  citigroup: 'citi.com',
  citi: 'citi.com',
  americanexpress: 'americanexpress.com',
  amex: 'americanexpress.com',
  mastercard: 'mastercard.com',
  visa: 'visa.com',
  paypal: 'paypal.com',
  block: 'block.xyz',
  square: 'squareup.com',

  // Healthcare and pharma
  pfizer: 'pfizer.com',
  moderna: 'modernatx.com',
  novartis: 'novartis.com',
  roche: 'roche.com',
  merck: 'merck.com',
  astrazeneca: 'astrazeneca.com',
  jnj: 'jnj.com',
  johnsonjohnson: 'jnj.com',
  unitedhealth: 'uhc.com',
  cvs: 'cvshealth.com',
  cvshealth: 'cvshealth.com',

  // Retail and consumer
  walmart: 'walmart.com',
  target: 'target.com',
  costco: 'costco.com',
  homedepot: 'homedepot.com',
  lowes: 'lowes.com',
  nike: 'nike.com',
  adidas: 'adidas.com',
  pepsi: 'pepsico.com',
  pepsico: 'pepsico.com',
  cocacola: 'coca-colacompany.com',
  starbucks: 'starbucks.com',
  mcdonalds: 'mcdonalds.com',
  doordash: 'doordash.com',
  instacart: 'instacart.com',

  // Telecom and media
  verizon: 'verizon.com',
  att: 'att.com',
  tmobile: 't-mobile.com',
  comcast: 'comcast.com',
  disney: 'disney.com',
  warnerbros: 'wbd.com',
  spotify: 'spotify.com',
  snap: 'snap.com',
  snapchat: 'snap.com',

  // Automotive and industrial
  ford: 'ford.com',
  gm: 'gm.com',
  generalmotors: 'gm.com',
  toyota: 'toyota.com',
  volkswagen: 'volkswagen.com',
  bmw: 'bmw.com',
  mercedesbenz: 'mercedes-benz.com',
  boeing: 'boeing.com',
  airbus: 'airbus.com',
  ge: 'ge.com',
  siemens: 'siemens.com',
  honeywell: 'honeywell.com',
}

export async function POST(request: NextRequest) {
  const failures: string[] = []

  try {
    const body = await parseRequest(request)
    const normalizedCompanyName = normalizeCompanyName(body.companyName)
    const companyKey = normalizeCompanyKey(body.companyName)

    if (!normalizedCompanyName || normalizedCompanyName.length < 2 || !companyKey) {
      return NextResponse.json(
        { error: 'Invalid companyName. Provide a valid company name.' },
        { status: 400 }
      )
    }

    const serviceClient = await getServiceClientSafely()
    const cacheAvailable = serviceClient
      ? await ensureDomainCacheTableExists(serviceClient)
      : false

    // Level 1: known domains
    const knownDomain = resolveKnownDomain(companyKey)
    if (knownDomain) {
      await writeDomainCacheBestEffort(serviceClient, cacheAvailable, companyKey, knownDomain, 'known_db')
      logFailuresIfAny(failures, 'known_db')
      return NextResponse.json(buildResponse(knownDomain, 'known_db'))
    }

    // Cache check before external APIs (30-day TTL)
    const cached = await readDomainCacheBestEffort(serviceClient, cacheAvailable, companyKey, failures)
    if (cached) {
      logFailuresIfAny(failures, cached.source)
      return NextResponse.json(cached)
    }

    // Level 2: Clearbit autocomplete
    const clearbitDomain = await resolveFromClearbit(normalizedCompanyName, failures)
    if (clearbitDomain) {
      await writeDomainCacheBestEffort(serviceClient, cacheAvailable, companyKey, clearbitDomain, 'clearbit')
      logFailuresIfAny(failures, 'clearbit')
      return NextResponse.json(buildResponse(clearbitDomain, 'clearbit'))
    }

    // Level 3: Brandfetch
    const brandfetchDomain = await resolveFromBrandfetch(normalizedCompanyName, failures)
    if (brandfetchDomain) {
      await writeDomainCacheBestEffort(serviceClient, cacheAvailable, companyKey, brandfetchDomain, 'brandfetch')
      logFailuresIfAny(failures, 'brandfetch')
      return NextResponse.json(buildResponse(brandfetchDomain, 'brandfetch'))
    }

    // Level 4: heuristic fallback (always returns)
    const guessedDomain = heuristicGuessDomain(normalizedCompanyName)
    await writeDomainCacheBestEffort(serviceClient, cacheAvailable, companyKey, guessedDomain, 'heuristic')

    logFailuresIfAny(failures, 'heuristic')

    return NextResponse.json(buildResponse(guessedDomain, 'heuristic'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Invalid JSON body') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    console.error('[resolve-domain] Internal error:', sanitizeErrorForLog(error))
    return NextResponse.json({ error: 'Failed to resolve domain' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

function buildResponse(domain: string, source: DomainSource): ResolveDomainResponse {
  return {
    domain,
    confidence: SOURCE_CONFIDENCE[source],
    source,
  }
}

async function parseRequest(request: NextRequest): Promise<ResolveDomainRequest> {
  try {
    const body = (await request.json()) as Partial<ResolveDomainRequest>
    return {
      companyName: typeof body.companyName === 'string' ? body.companyName : '',
    }
  } catch {
    throw new Error('Invalid JSON body')
  }
}

async function resolveFromClearbit(companyName: string, failures: string[]): Promise<string | null> {
  try {
    const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(companyName)}`
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(EXTERNAL_LOOKUP_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      failures.push(`clearbit:${response.status}`)
      return null
    }

    const data = (await response.json()) as unknown
    return extractDomainFromCandidateList(data)
  } catch (error) {
    failures.push(`clearbit:exception:${compactErrorMessage(error)}`)
    return null
  }
}

async function resolveFromBrandfetch(companyName: string, failures: string[]): Promise<string | null> {
  try {
    const url = `https://api.brandfetch.io/v2/search/${encodeURIComponent(companyName)}`
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(EXTERNAL_LOOKUP_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      failures.push(`brandfetch:${response.status}`)
      return null
    }

    const data = (await response.json()) as unknown
    return extractBrandfetchDomain(data)
  } catch (error) {
    failures.push(`brandfetch:exception:${compactErrorMessage(error)}`)
    return null
  }
}

function extractDomainFromCandidateList(payload: unknown): string | null {
  if (!Array.isArray(payload)) return null

  for (const item of payload) {
    if (!item || typeof item !== 'object') continue
    const domain = normalizeDomain((item as { domain?: unknown }).domain)
    if (domain) return domain
  }

  return null
}

function extractBrandfetchDomain(payload: unknown): string | null {
  const candidates: unknown[] = []

  if (Array.isArray(payload)) {
    candidates.push(...payload)
  } else if (payload && typeof payload === 'object') {
    const asObj = payload as Record<string, unknown>
    if (Array.isArray(asObj.results)) candidates.push(...asObj.results)
    if (Array.isArray(asObj.companies)) candidates.push(...asObj.companies)
    candidates.push(payload)
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const obj = candidate as Record<string, unknown>

    const directDomain = normalizeDomain(obj.domain)
    if (directDomain) return directDomain

    const website = typeof obj.website === 'string' ? obj.website : null
    if (website) {
      const fromWebsite = domainFromUrl(website)
      if (fromWebsite) return fromWebsite
    }
  }

  return null
}

function resolveKnownDomain(companyKey: string): string | null {
  return normalizeDomain(KNOWN_DOMAINS[companyKey]) || null
}

function heuristicGuessDomain(companyName: string): string {
  const cleaned = companyName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|plc|group|holdings)\b/g, ' ')
    .replace(/\s+/g, '')
    .trim()

  const label = cleaned || 'company'
  return `${label}.com`
}

async function readDomainCacheBestEffort(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>> | null,
  cacheAvailable: boolean,
  companyKey: string,
  failures: string[]
): Promise<ResolveDomainResponse | null> {
  if (!serviceClient || !cacheAvailable) return null

  try {
    const { data, error } = await serviceClient
      .from('domain_resolution_cache')
      .select('company_name, domain, source, timestamp')
      .eq('company_name', companyKey)
      .maybeSingle<DomainCacheRow>()

    if (error) {
      if (!isNoRowsError(error)) {
        failures.push(`cache_read:${error.code || 'unknown'}`)
      }
      return null
    }

    if (!data?.domain || !data.timestamp) return null

    const cachedAtMs = new Date(data.timestamp).getTime()
    if (!Number.isFinite(cachedAtMs)) return null
    if (Date.now() - cachedAtMs > CACHE_TTL_MS) return null

    const source = normalizeSource(data.source)
    const domain = normalizeDomain(data.domain)
    if (!source || !domain) return null

    return buildResponse(domain, source)
  } catch (error) {
    failures.push(`cache_read_exception:${compactErrorMessage(error)}`)
    return null
  }
}

async function writeDomainCacheBestEffort(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>> | null,
  cacheAvailable: boolean,
  companyKey: string,
  domain: string,
  source: DomainSource
) {
  if (!serviceClient || !cacheAvailable) return

  try {
    const { error } = await serviceClient.from('domain_resolution_cache').upsert(
      {
        company_name: companyKey,
        domain,
        source,
        timestamp: new Date().toISOString(),
      },
      {
        onConflict: 'company_name',
      }
    )

    if (error && !isMissingDbObjectError(error)) {
      console.warn('[resolve-domain] Failed to upsert cache row:', {
        code: error.code,
        message: error.message,
      })
    }
  } catch (error) {
    console.warn('[resolve-domain] Cache write exception:', sanitizeErrorForLog(error))
  }
}

async function getServiceClientSafely() {
  try {
    return await createServiceRoleClient()
  } catch (error) {
    console.warn('[resolve-domain] Service-role client unavailable; continuing without cache', sanitizeErrorForLog(error))
    return null
  }
}

async function ensureDomainCacheTableExists(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>
): Promise<boolean> {
  try {
    const probe = await serviceClient.from('domain_resolution_cache').select('company_name').limit(1)
    if (!probe.error) return true

    if (!isMissingDbObjectError(probe.error)) {
      console.warn('[resolve-domain] Cache table probe failed:', {
        code: probe.error.code,
        message: probe.error.message,
      })
      return false
    }

    const createSql = `
      CREATE TABLE IF NOT EXISTS public.domain_resolution_cache (
        company_name TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        source VARCHAR(20) NOT NULL CHECK (source IN ('known_db', 'clearbit', 'brandfetch', 'heuristic')),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_domain_resolution_cache_timestamp
        ON public.domain_resolution_cache(timestamp DESC);
    `

    const rpcNames = ['execute_sql', 'exec_sql', 'run_sql', 'sql']
    for (const rpcName of rpcNames) {
      const { error } = await (serviceClient as any).rpc(rpcName, { sql: createSql })
      if (!error) {
        console.warn('[resolve-domain] domain_resolution_cache created via SQL RPC:', rpcName)
        return true
      }
    }

    console.warn('[resolve-domain] Unable to create cache table automatically; SQL RPC is unavailable')
    return false
  } catch (error) {
    console.warn('[resolve-domain] Cache table ensure failed:', sanitizeErrorForLog(error))
    return false
  }
}

function normalizeCompanyName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeCompanyKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null

  let domain = value.trim().toLowerCase()
  if (!domain) return null

  domain = domain.replace(/^https?:\/\//, '')
  domain = domain.replace(/^www\./, '')
  domain = domain.split('/')[0]
  domain = domain.split('?')[0]
  domain = domain.split('#')[0]

  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) {
    return null
  }

  return domain
}

function domainFromUrl(urlText: string): string | null {
  try {
    const parsed = new URL(urlText.startsWith('http') ? urlText : `https://${urlText}`)
    return normalizeDomain(parsed.hostname)
  } catch {
    return null
  }
}

function normalizeSource(source: unknown): DomainSource | null {
  if (source === 'known_db' || source === 'clearbit' || source === 'brandfetch' || source === 'heuristic') {
    return source
  }
  return null
}

function isNoRowsError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === 'PGRST116'
}

function isMissingDbObjectError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42P01' || code === 'PGRST202' || code === '42883'
}

function compactErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 120)
  return String(error).slice(0, 120)
}

function sanitizeErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'object' && error !== null) {
    const safe: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(error as Record<string, unknown>)) {
      if (/key|token|authorization|secret/i.test(key)) continue
      safe[key] = value
    }
    return safe
  }

  return { message: String(error) }
}

function logFailuresIfAny(failures: string[], resolvedBy: DomainSource) {
  if (failures.length === 0) return
  console.warn('[resolve-domain] Some resolution methods failed:', {
    resolvedBy,
    failures,
  })
}
