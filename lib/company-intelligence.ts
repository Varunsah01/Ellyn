/**
 * Company intelligence helpers used to enrich AI email prediction context.
 */

import { normalizeDomain } from '@/lib/domain-utils'

export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise'

export interface EmailProviderInfo {
  provider: 'google' | 'microsoft' | 'custom' | 'unknown'
  providerName: string
  confidence: number
  mxRecords?: string[]
}

const KNOWN_COMPANIES: Record<string, CompanySize> = {
  'google.com': 'enterprise',
  'microsoft.com': 'enterprise',
  'amazon.com': 'enterprise',
  'apple.com': 'enterprise',
  'meta.com': 'enterprise',
  'netflix.com': 'enterprise',
  'ibm.com': 'enterprise',
  'oracle.com': 'enterprise',
  'salesforce.com': 'enterprise',
  'cisco.com': 'enterprise',
  'intel.com': 'enterprise',
  'mckinsey.com': 'enterprise',
  'bcg.com': 'enterprise',
  'bain.com': 'enterprise',
  'deloitte.com': 'enterprise',
  'pwc.com': 'enterprise',
  'ey.com': 'enterprise',
  'kpmg.com': 'enterprise',
  'accenture.com': 'enterprise',
  'gs.com': 'enterprise',
  'jpmorgan.com': 'enterprise',
  'morganstanley.com': 'enterprise',
  'citi.com': 'enterprise',
  'bofa.com': 'enterprise',
  'wellsfargo.com': 'enterprise',

  'adobe.com': 'large',
  'uber.com': 'large',
  'airbnb.com': 'large',
  'spotify.com': 'large',
  'zoom.us': 'large',
  'slack.com': 'large',
  'shopify.com': 'large',
  'stripe.com': 'large',
}

/**
 * Estimate company size from known mappings + domain heuristics.
 */
export function estimateCompanySize(domain: string, companyName = ''): CompanySize {
  const normalizedDomain = normalizeDomain(domain)
  const known = KNOWN_COMPANIES[normalizedDomain]
  if (known) return known

  const base = normalizedDomain.split('.')[0] || ''
  const lowerName = companyName.toLowerCase()

  if (base.length > 0 && base.length <= 4) {
    return 'large'
  }

  if (normalizedDomain.endsWith('.io') || normalizedDomain.endsWith('.ai')) {
    return 'startup'
  }

  if (base.includes('-') || base.length > 15) {
    return 'small'
  }

  if (/\b(labs|studio|ventures|startup)\b/i.test(lowerName)) {
    return 'startup'
  }

  return 'medium'
}

/**
 * Detect likely email provider from MX records via Google DNS-over-HTTPS.
 */
export async function detectEmailProvider(domain: string): Promise<EmailProviderInfo> {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain) {
    return {
      provider: 'unknown',
      providerName: 'Unknown',
      confidence: 0,
      mxRecords: [],
    }
  }

  try {
    const mxRecords = await getMxRecords(normalizedDomain)

    if (mxRecords.length === 0) {
      return {
        provider: 'unknown',
        providerName: 'Unknown',
        confidence: 0,
        mxRecords,
      }
    }

    const joined = mxRecords.join(' ').toLowerCase()

    if (joined.includes('google.com') || joined.includes('googlemail.com') || joined.includes('aspmx')) {
      return {
        provider: 'google',
        providerName: 'Google Workspace',
        confidence: 95,
        mxRecords,
      }
    }

    if (
      joined.includes('outlook.com') ||
      joined.includes('protection.outlook.com') ||
      joined.includes('office365.com') ||
      joined.includes('microsoft.com')
    ) {
      return {
        provider: 'microsoft',
        providerName: 'Microsoft 365',
        confidence: 95,
        mxRecords,
      }
    }

    return {
      provider: 'custom',
      providerName: 'Custom Mail Server',
      confidence: 80,
      mxRecords,
    }
  } catch (error) {
    console.error('[Company Intelligence] detectEmailProvider failed:', toLogError(error))

    return {
      provider: 'unknown',
      providerName: 'Unknown',
      confidence: 0,
      mxRecords: [],
    }
  }
}

/**
 * Lightweight industry detection via heuristics.
 */
export function detectIndustry(companyName: string, domain: string): string | null {
  const nameLower = (companyName || '').toLowerCase()
  const domainLower = normalizeDomain(domain)

  if (
    nameLower.includes('tech') ||
    nameLower.includes('software') ||
    nameLower.includes('data') ||
    nameLower.includes('cloud') ||
    nameLower.includes('ai') ||
    domainLower.endsWith('.io') ||
    domainLower.endsWith('.ai')
  ) {
    return 'Technology'
  }

  if (
    nameLower.includes('bank') ||
    nameLower.includes('capital') ||
    nameLower.includes('financial') ||
    nameLower.includes('investment') ||
    nameLower.includes('fund')
  ) {
    return 'Financial Services'
  }

  if (nameLower.includes('consulting') || nameLower.includes('advisory') || nameLower.includes('partners')) {
    return 'Consulting'
  }

  if (
    nameLower.includes('health') ||
    nameLower.includes('medical') ||
    nameLower.includes('pharma') ||
    nameLower.includes('bio')
  ) {
    return 'Healthcare'
  }

  if (nameLower.includes('legal') || nameLower.includes('law')) {
    return 'Legal'
  }

  return null
}

async function getMxRecords(domain: string): Promise<string[]> {
  const endpoint = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/dns-json',
    },
    signal: AbortSignal.timeout(3000),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`DNS lookup failed (${response.status})`)
  }

  const payload = (await response.json()) as {
    Answer?: Array<{ type?: number; data?: string }>
  }

  const answers = Array.isArray(payload.Answer) ? payload.Answer : []
  return answers
    .filter((record) => Number(record?.type) === 15 && typeof record?.data === 'string')
    .map((record) => {
      const pieces = String(record.data).trim().split(/\s+/)
      const host = pieces.length >= 2 ? pieces[1] : pieces[0]
      return host.replace(/\.$/, '')
    })
    .filter(Boolean)
}

function toLogError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  return {
    message: String(error),
  }
}
