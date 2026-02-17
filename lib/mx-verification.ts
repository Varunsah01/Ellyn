/**
 * DNS MX Record Verification (Always Enabled, Free)
 * Validates that a domain can receive emails
 */

import dns from 'dns/promises'

import { buildCacheKey, getOrSet, normalizeCacheToken } from '@/lib/cache/redis'
import { CACHE_TAGS, mxVerificationDomainTag } from '@/lib/cache/tags'

export interface DomainMXInfo {
  hasMX: boolean;
  mxCount: number;
  mxServers: string[];
  provider: string;
  verified: boolean;
}

interface MxRecord {
  exchange: string;
  priority: number;
}

const MX_CACHE_TTL_SECONDS = 24 * 60 * 60

/**
 * Verify domain mx.
 * @param {string} domain - Domain input.
 * @returns {Promise<DomainMXInfo>} Computed Promise<DomainMXInfo>.
 * @throws {Error} If the operation fails.
 * @example
 * verifyDomainMX('domain')
 */
export async function verifyDomainMX(domain: string): Promise<DomainMXInfo> {
  const normalizedDomain = normalizeCacheToken(domain)
  const key = buildCacheKey(['cache', 'mx-verification', 'dns', normalizedDomain])

  return getOrSet<DomainMXInfo>({
    key,
    ttlSeconds: MX_CACHE_TTL_SECONDS,
    tags: [CACHE_TAGS.mxVerification, mxVerificationDomainTag(normalizedDomain)],
    fetcher: async () => {
      try {
        const mxRecords = await Promise.race([
          dns.resolveMx(domain),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DNS timeout')), 2000)
          ),
        ]) as MxRecord[]

        const info: DomainMXInfo = {
          hasMX: mxRecords.length > 0,
          mxCount: mxRecords.length,
          mxServers: mxRecords
            .sort((a, b) => a.priority - b.priority)
            .map(r => r.exchange),
          provider: detectEmailProvider(mxRecords),
          verified: true,
        }

        console.log('[MX Verification]', domain, ':', info)

        return info
      } catch (error) {
        console.warn('[MX Verification] Failed for', domain, ':', error)

        return {
          hasMX: false,
          mxCount: 0,
          mxServers: [],
          provider: 'Unknown',
          verified: false,
        }
      }
    },
    backgroundRefresh: {
      enabled: true,
      hotThreshold: 12,
      refreshAheadSeconds: 10 * 60,
      cooldownSeconds: 3 * 60,
    },
  })
}

function detectEmailProvider(mxRecords: MxRecord[]): string {
  if (!mxRecords.length) return 'Unknown';

  const server = mxRecords[0]?.exchange.toLowerCase() ?? '';

  if (server.includes('google') || server.includes('gmail')) {
    return 'Google Workspace';
  }
  if (server.includes('outlook') || server.includes('microsoft') || server.includes('office365')) {
    return 'Microsoft 365';
  }
  if (server.includes('protonmail') || server.includes('proton')) {
    return 'ProtonMail';
  }
  if (server.includes('zoho')) {
    return 'Zoho Mail';
  }
  if (server.includes('fastmail')) {
    return 'FastMail';
  }

  return 'Custom Mail Server';
}

/**
 * Batch verify domains.
 * @param {string[]} domains - Domains input.
 * @returns {Promise<Map<string, DomainMXInfo>>} Computed Promise<Map<string, DomainMXInfo>>.
 * @throws {Error} If the operation fails.
 * @example
 * batchVerifyDomains('domains')
 */
export async function batchVerifyDomains(domains: string[]): Promise<Map<string, DomainMXInfo>> {
  const results = new Map<string, DomainMXInfo>();

  // Verify all domains in parallel
  const verifications = await Promise.allSettled(
    domains.map(domain => verifyDomainMX(domain))
  );

  domains.forEach((domain, index) => {
    const result = verifications[index];
    if (result && result.status === 'fulfilled') {
      results.set(domain, result.value);
    } else {
      results.set(domain, {
        hasMX: false,
        mxCount: 0,
        mxServers: [],
        provider: 'Unknown',
        verified: false
      });
    }
  });

  return results;
}
