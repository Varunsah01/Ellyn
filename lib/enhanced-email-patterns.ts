/**
 * Enhanced Email Pattern Generation
 * Uses company size estimation and role analysis
 */

import { buildCacheKey, getOrSet, normalizeCacheToken } from '@/lib/cache/redis'
import { CACHE_TAGS, emailPatternDomainTag } from '@/lib/cache/tags'
import { createServiceRoleClient } from '@/lib/supabase/server'

export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise';

export interface CompanyProfile {
  domain: string;
  estimatedSize: CompanySize;
  emailProvider?: string;
}

export interface EmailPattern {
  email: string;
  pattern: string;
  confidence: number;
  learned?: boolean;
}

// Legacy in-memory lookup kept for reference only — DB is now the source of truth.
// @ts-ignore -- retained for documentation purposes
const _KNOWN_DOMAINS_LEGACY: Record<string, string> = {
  'google': 'google.com',
  'alphabet': 'google.com',
  'microsoft': 'microsoft.com',
  'apple': 'apple.com',
  'amazon': 'amazon.com',
  'meta': 'meta.com',
  'facebook': 'meta.com',
  'netflix': 'netflix.com',
  'tesla': 'tesla.com',
  'adobe': 'adobe.com',
  'salesforce': 'salesforce.com',
  'oracle': 'oracle.com',
  'ibm': 'ibm.com',
  'intel': 'intel.com',
  'nvidia': 'nvidia.com',
  'amd': 'amd.com',
  'cisco': 'cisco.com',
  'dell': 'dell.com',
  'hp': 'hp.com',
  'mckinsey': 'mckinsey.com',
  'bcg': 'bcg.com',
  'bain': 'bain.com',
  'deloitte': 'deloitte.com',
  'pwc': 'pwc.com',
  'ey': 'ey.com',
  'kpmg': 'kpmg.com',
  'accenture': 'accenture.com',
  'goldman': 'gs.com',
  'morganstanley': 'morganstanley.com',
  'jpmorgan': 'jpmorgan.com',
  'citi': 'citi.com',
  'bankofamerica': 'bankofamerica.com',
  'wellsfargo': 'wellsfargo.com',
  'stripe': 'stripe.com',
  'uber': 'uber.com',
  'lyft': 'lyft.com',
  'airbnb': 'airbnb.com',
  'spotify': 'spotify.com',
  'zoom': 'zoom.us',
  'slack': 'slack.com',
  'shopify': 'shopify.com',
  'dropbox': 'dropbox.com',
  'atlassian': 'atlassian.com',
};

const EMAIL_PATTERN_CACHE_TTL_SECONDS = 24 * 60 * 60

/**
 * Get known domain for a company name.
 * Checks Redis cache first, then the known_company_domains Supabase table.
 * @param {string} companyName - Company name input (any casing, aliases supported).
 * @returns {Promise<string | null>} The canonical domain or null if not found.
 * @example
 * await getKnownDomain('TCS') // => 'tcs.com'
 */
export async function getKnownDomain(companyName: string): Promise<string | null> {
  const normalized = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!normalized) return null

  const cacheKey = buildCacheKey(['known-domain', normalized])

  return getOrSet<string | null>({
    key: cacheKey,
    ttlSeconds: 24 * 60 * 60, // 24h TTL
    tags: [CACHE_TAGS.domainLookup],
    cacheNull: true,
    nullTtlSeconds: 60 * 60, // 1h TTL for negative hits
    fetcher: async () => {
      try {
        const supabase = await createServiceRoleClient()
        const { data } = await supabase
          .from('known_company_domains')
          .select('domain')
          .eq('normalized_name', normalized)
          .maybeSingle()
        return data?.domain ?? null
      } catch (err) {
        console.warn('[getKnownDomain] DB lookup failed:', err)
        return null
      }
    },
  })
}

/**
 * Estimate company size.
 * @param {string} domain - Domain input.
 * @returns {CompanySize} Computed CompanySize.
 * @example
 * estimateCompanySize('domain')
 */
export function estimateCompanySize(domain: string): CompanySize {
  // Enterprise companies (Fortune 500)
  const enterpriseCompanies = [
    'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'meta.com',
    'ibm.com', 'oracle.com', 'cisco.com', 'intel.com', 'salesforce.com'
  ];

  // Large companies (10,000+ employees)
  const largeCompanies = [
    'adobe.com', 'nvidia.com', 'amd.com', 'dell.com', 'hp.com',
    'mckinsey.com', 'bcg.com', 'bain.com', 'deloitte.com', 'pwc.com',
    'gs.com', 'morganstanley.com', 'jpmorgan.com'
  ];

  if (enterpriseCompanies.includes(domain)) return 'enterprise';
  if (largeCompanies.includes(domain)) return 'large';

  // Heuristics
  if (domain.length < 6) return 'large'; // Short domains = established
  if (domain.includes('-')) return 'startup'; // Hyphenated = newer
  if (domain.endsWith('.io') || domain.endsWith('.ai')) return 'startup';
  if (domain.endsWith('.com') && domain.split('.').length === 2) return 'medium';

  return 'medium';
}

/**
 * Generate smart email patterns.
 * @param {string} firstName - First name input.
 * @param {string} lastName - Last name input.
 * @param {CompanyProfile} companyProfile - Company profile input.
 * @param {string} role - Role input.
 * @returns {EmailPattern[]} Computed EmailPattern[].
 * @example
 * generateSmartEmailPatterns('firstName', 'lastName', {}, 'role')
 */
export function generateSmartEmailPatterns(
  firstName: string,
  lastName: string,
  companyProfile: CompanyProfile,
  role?: string
): EmailPattern[] {
  const domain = companyProfile.domain;
  const size = companyProfile.estimatedSize;

  const first = firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const last = lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const f = first[0];

  const patterns: EmailPattern[] = [];

  // Enterprise/Large: Prefer structured patterns
  if (size === 'enterprise' || size === 'large') {
    patterns.push(
      { email: `${first}.${last}@${domain}`, pattern: 'first.last', confidence: 85 },
      { email: `${f}${last}@${domain}`, pattern: 'flast', confidence: 65 },
      { email: `${first}${last}@${domain}`, pattern: 'firstlast', confidence: 45 },
      { email: `${first}_${last}@${domain}`, pattern: 'first_last', confidence: 35 },
      { email: `${f}.${last}@${domain}`, pattern: 'f.last', confidence: 30 },
      { email: `${last}.${first}@${domain}`, pattern: 'last.first', confidence: 25 },
      { email: `${first}@${domain}`, pattern: 'first', confidence: 20 }
    );
  }
  // Startup/Small: Prefer simple patterns
  else if (size === 'startup' || size === 'small') {
    patterns.push(
      { email: `${first}@${domain}`, pattern: 'first', confidence: 80 },
      { email: `${first}.${last}@${domain}`, pattern: 'first.last', confidence: 65 },
      { email: `${f}${last}@${domain}`, pattern: 'flast', confidence: 45 },
      { email: `${first}${last}@${domain}`, pattern: 'firstlast', confidence: 35 },
      { email: `${f}.${last}@${domain}`, pattern: 'f.last', confidence: 25 }
    );
  }
  // Medium: Mixed patterns
  else {
    patterns.push(
      { email: `${first}.${last}@${domain}`, pattern: 'first.last', confidence: 75 },
      { email: `${first}@${domain}`, pattern: 'first', confidence: 60 },
      { email: `${f}.${last}@${domain}`, pattern: 'f.last', confidence: 45 },
      { email: `${f}${last}@${domain}`, pattern: 'flast', confidence: 35 },
      { email: `${first}${last}@${domain}`, pattern: 'firstlast', confidence: 30 }
    );
  }

  // Role-based adjustments
  if (role) {
    const roleLower = role.toLowerCase();

    // C-level / Founders
    if (roleLower.match(/ceo|founder|chief|president|owner|cto|cfo|coo/)) {
      patterns.forEach(p => {
        if (p.pattern === 'first') p.confidence = Math.min(95, p.confidence + 25);
        if (p.pattern === 'first.last') p.confidence = Math.min(95, p.confidence + 10);
      });
    }

    // Engineers / Technical
    if (roleLower.match(/engineer|developer|programmer|architect|tech/)) {
      patterns.forEach(p => {
        if (p.pattern === 'first.last') p.confidence = Math.min(95, p.confidence + 20);
        if (p.pattern === 'flast') p.confidence = Math.min(95, p.confidence + 10);
      });
    }

    // Recruiters / HR
    if (roleLower.match(/recruiter|talent|hr|human resources/)) {
      patterns.forEach(p => {
        if (p.pattern === 'first.last') p.confidence = Math.min(95, p.confidence + 15);
      });
    }

    // Sales / Marketing
    if (roleLower.match(/sales|marketing|business development|account/)) {
      patterns.forEach(p => {
        if (p.pattern === 'first') p.confidence = Math.min(95, p.confidence + 15);
        if (p.pattern === 'first.last') p.confidence = Math.min(95, p.confidence + 10);
      });
    }
  }

  // Sort by confidence and return top 6 candidates for Gemini Flash ranking
  return patterns
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);
}

/**
 * Generate smart patterns with cache (24h TTL).
 */
export async function generateSmartEmailPatternsCached(
  firstName: string,
  lastName: string,
  companyProfile: CompanyProfile,
  role?: string
): Promise<EmailPattern[]> {
  const domain = normalizeCacheToken(companyProfile.domain)
  const key = buildCacheKey([
    'cache',
    'email-patterns',
    domain,
    firstName,
    lastName,
    role || '',
    companyProfile.estimatedSize,
    companyProfile.emailProvider || '',
  ])

  return getOrSet<EmailPattern[]>({
    key,
    ttlSeconds: EMAIL_PATTERN_CACHE_TTL_SECONDS,
    tags: [CACHE_TAGS.emailPatterns, emailPatternDomainTag(domain)],
    fetcher: async () => generateSmartEmailPatterns(firstName, lastName, companyProfile, role),
    backgroundRefresh: {
      enabled: true,
      hotThreshold: 8,
      refreshAheadSeconds: 15 * 60,
      cooldownSeconds: 90,
    },
  })
}
