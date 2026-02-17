/**
 * Domain and company-name helper utilities used by domain resolution services.
 */

export type EmailProvider = 'google-workspace' | 'microsoft-365' | 'zoho' | 'other'

export interface MXValidationResult {
  valid: boolean
  provider?: EmailProvider
  mxRecords?: string[]
}

const LEGAL_SUFFIXES = new Set<string>([
  'private',
  'pvt',
  'ltd',
  'limited',
  'inc',
  'corp',
  'corporation',
  'llc',
  'plc',
  'gmbh',
  'sa',
  'spa',
  'nv',
  'bv',
])

const BUSINESS_WORDS = new Set<string>([
  'group',
  'technologies',
  'technology',
  'tech',
  'solutions',
  'consulting',
  'services',
  'international',
  'global',
  'holdings',
  'ventures',
  'partners',
  'associates',
])

/**
 * Normalizes a company name by removing legal/business suffix noise.
 *
 * @example
 * normalizeCompanyName("Acme Technologies Pvt. Ltd.") // "acme"
 */
export function normalizeCompanyName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return ''
  }

  const lowered = rawName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const strippedSpecials = lowered.replace(/[^a-z0-9\s-]/g, ' ')
  const collapsed = strippedSpecials.replace(/[-\s]+/g, ' ').trim()
  if (!collapsed) {
    return ''
  }

  const withoutThePrefix = collapsed.replace(/^the\s+/i, '').trim()
  const tokens = withoutThePrefix
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)

  const filteredTokens = tokens.filter((token) => {
    if (LEGAL_SUFFIXES.has(token)) return false
    if (BUSINESS_WORDS.has(token)) return false
    return true
  })

  return filteredTokens.join(' ').replace(/[-\s]+/g, ' ').trim()
}

/**
 * Calculates token-level Jaccard similarity between two strings.
 *
 * @example
 * calculateSimilarity("Microsoft Corp", "Microsoft Corporation") // ~0.85+ after normalization
 */
export function calculateSimilarity(a: string, b: string): number {
  const normalizedA = normalizeCompanyName(a)
  const normalizedB = normalizeCompanyName(b)

  if (!normalizedA && !normalizedB) return 1
  if (!normalizedA || !normalizedB) return 0
  if (normalizedA === normalizedB) return 1

  const setA = new Set<string>(normalizedA.split(/\s+/).filter(Boolean))
  const setB = new Set<string>(normalizedB.split(/\s+/).filter(Boolean))
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection += 1
  }

  const union = new Set<string>([...setA, ...setB]).size
  if (union === 0) return 0
  return intersection / union
}

/**
 * Normalizes a domain-like value.
 *
 * @example
 * normalizeDomain("  https://WWW.Example.com/path ") // "example.com"
 */
export function normalizeDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    return ''
  }

  const normalized = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
  const withoutPath = normalized.split('/')[0] ?? ''
  const withoutQuery = withoutPath.split('?')[0] ?? ''
  return withoutQuery.split('#')[0] ?? ''
}

/**
 * Extracts a hostname/domain from a URL value.
 *
 * @example
 * extractDomain("company.com/about") // "company.com"
 */
export function extractDomain(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  const input = url.trim()
  if (!input) return null

  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
    const parsed = new URL(withProtocol)
    const hostname = normalizeDomain(parsed.hostname)
    return hostname || null
  } catch {
    return null
  }
}

/**
 * Fast heuristic fallback for company -> domain.
 *
 * @example
 * heuristicGuessDomain("Acme Inc") // "acme.com"
 */
export function heuristicGuessDomain(companyName: string): string {
  const normalizedName = normalizeCompanyName(companyName).replace(/[\s-]+/g, '')
  if (!normalizedName) return ''
  return `${normalizedName}.com`
}

/**
 * Flags obviously invalid domain candidates.
 *
 * @example
 * isLikelyInvalidDomain("foo.con") // true
 */
export function isLikelyInvalidDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain)
  if (!normalized) return true
  if (normalized.length < 4) return true
  if (!normalized.includes('.')) return true
  if (/\d{10,}/.test(normalized)) return true
  if (/\.(con|cmo|ocm)$/i.test(normalized)) return true
  return false
}

/**
 * Validates domain deliverability potential via MX records using Google DNS-over-HTTPS.
 *
 * @example
 * const result = await validateDomainWithMX("microsoft.com")
 * // { valid: true, provider: "microsoft-365", mxRecords: [...] }
 */
export async function validateDomainWithMX(domain: string): Promise<MXValidationResult> {
  const normalized = normalizeDomain(domain)
  if (isLikelyInvalidDomain(normalized)) {
    return { valid: false }
  }

  const endpoint = `https://dns.google/resolve?name=${encodeURIComponent(normalized)}&type=MX`

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })

    if (!response.ok) {
      return { valid: false }
    }

    const payload = (await response.json()) as {
      Answer?: Array<{ type?: number; data?: string }>
    }

    const answers = Array.isArray(payload?.Answer) ? payload.Answer : []
    const mxHosts = answers
      .filter((item) => Number(item?.type) === 15 && typeof item?.data === 'string')
      .map((item) => String(item.data).trim())
      .filter(Boolean)

    if (mxHosts.length === 0) {
      return { valid: false, mxRecords: [] }
    }

    const joined = mxHosts.join(' ').toLowerCase()
    let provider: EmailProvider = 'other'
    if (joined.includes('google') || joined.includes('aspmx')) {
      provider = 'google-workspace'
    } else if (joined.includes('outlook') || joined.includes('microsoft')) {
      provider = 'microsoft-365'
    } else if (joined.includes('zoho')) {
      provider = 'zoho'
    }

    return {
      valid: true,
      provider,
      mxRecords: mxHosts,
    }
  } catch {
    return { valid: false }
  }
}

/*
Simple sanity checks (example usage):

normalizeCompanyName("Acme Technologies Pvt. Ltd.") === "acme"
extractDomain("https://www.linkedin.com/company/openai") === "linkedin.com"
heuristicGuessDomain("The Example Group") === "example.com"
*/
