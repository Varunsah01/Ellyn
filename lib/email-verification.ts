/**
 * Email Verification and Domain Validation
 * Uses DNS lookups to verify domains can accept email (MX records)
 */

import { promises as dns } from 'dns'

import { buildCacheKey, getOrSet, normalizeCacheToken } from '@/lib/cache/redis'
import { CACHE_TAGS, mxVerificationDomainTag } from '@/lib/cache/tags'

export interface DomainVerificationResult {
  domain: string;
  isValid: boolean;
  hasMxRecords: boolean;
  mxRecords: string[];
  emailProvider?: 'google' | 'microsoft' | 'custom';
  error?: string;
}

export interface VerifiedEmailPattern {
  email: string;
  pattern: string;
  confidence: number;
  domainVerified: boolean;
  emailProvider?: string;
  verification: {
    domainValid: boolean;
    formatValid: boolean;
    mxRecordCount: number;
  };
}

const MX_CACHE_TTL_SECONDS = 24 * 60 * 60

/**
 * Verify domain has MX records and can accept email
 * This is a free DNS lookup that requires no API key
 */
export async function verifyDomainMxRecords(domain: string): Promise<DomainVerificationResult> {
  const cleanDomain = domain.replace('@', '').trim().toLowerCase()
  const key = buildCacheKey(['cache', 'mx-verification', 'email-verification', normalizeCacheToken(cleanDomain)])

  return getOrSet<DomainVerificationResult>({
    key,
    ttlSeconds: MX_CACHE_TTL_SECONDS,
    tags: [CACHE_TAGS.mxVerification, mxVerificationDomainTag(cleanDomain)],
    fetcher: async () => {
      try {
        // Resolve MX records.
        const mxRecords = await dns.resolveMx(cleanDomain)

        if (!mxRecords || mxRecords.length === 0) {
          return {
            domain: cleanDomain,
            isValid: false,
            hasMxRecords: false,
            mxRecords: [],
            error: 'No MX records found',
          }
        }

        // Sort by priority (lower number = higher priority).
        const sortedMx = mxRecords
          .sort((a, b) => a.priority - b.priority)
          .map(mx => mx.exchange)

        // Detect email provider from MX records.
        let emailProvider: 'google' | 'microsoft' | 'custom' = 'custom'
        const primaryMx = sortedMx[0]?.toLowerCase() ?? ''

        if (primaryMx.includes('google.com') || primaryMx.includes('googlemail.com')) {
          emailProvider = 'google'
        } else if (
          primaryMx.includes('outlook.com') ||
          primaryMx.includes('microsoft.com') ||
          primaryMx.includes('office365.com')
        ) {
          emailProvider = 'microsoft'
        }

        return {
          domain: cleanDomain,
          isValid: true,
          hasMxRecords: true,
          mxRecords: sortedMx,
          emailProvider,
        }
      } catch (error: unknown) {
        // Common DNS error codes.
        let errorMessage = 'Domain verification failed'
        const errorCode = typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : ''

        if (errorCode === 'ENOTFOUND') {
          errorMessage = 'Domain does not exist'
        } else if (errorCode === 'ENODATA') {
          errorMessage = 'No MX records found'
        } else if (errorCode === 'ETIMEOUT') {
          errorMessage = 'DNS lookup timeout'
        }

        return {
          domain: cleanDomain,
          isValid: false,
          hasMxRecords: false,
          mxRecords: [],
          error: errorMessage,
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

/**
 * Validate email format using regex
 */
export function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Validate TLD (top-level domain)
 */
export function isValidTld(domain: string): boolean {
  const commonTlds = [
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
    'io', 'ai', 'co', 'uk', 'us', 'ca', 'de', 'fr',
    'jp', 'cn', 'in', 'au', 'br', 'ru', 'za', 'mx',
    'app', 'dev', 'tech', 'xyz', 'online', 'store',
    'cloud', 'digital', 'web', 'site', 'email'
  ];

  const tld = domain.split('.').pop()?.toLowerCase();
  return tld ? commonTlds.includes(tld) : false;
}

/**
 * Check if domain contains special characters that might be problematic
 */
export function hasValidCharacters(domain: string): boolean {
  // Domain should only contain alphanumeric, hyphens, and dots
  const domainRegex = /^[a-zA-Z0-9.-]+$/;
  return domainRegex.test(domain);
}

/**
 * Get email provider-specific pattern preferences
 * Google Workspace and Microsoft 365 have different common patterns
 */
export function getProviderPatternPreferences(
  provider: 'google' | 'microsoft' | 'custom'
): Record<string, number> {
  switch (provider) {
    case 'google':
      // Google Workspace commonly uses first.last@domain
      return {
        'first.last': 15,
        'firstlast': -5,
        'first': 10,
        'f.last': 5,
      };

    case 'microsoft':
      // Microsoft 365 / Outlook commonly uses firstlast@ or first@
      return {
        'firstlast': 10,
        'first': 10,
        'first.last': 5,
        'f.last': -5,
      };

    case 'custom':
    default:
      // No specific preference for custom email servers
      return {};
  }
}

/**
 * Calculate pattern-based confidence score.
 *
 * Scoring philosophy:
 *  - Pattern matching + provider preferences â†’ honest "pattern probability" score (max 85).
 *  - MX records only prove the domain has a mail server, not that THIS address exists.
 *    A flat +20 MX bonus inflated every pattern equally and is therefore removed.
 *  - For accurate per-address scoring call calculateDeliverabilityConfidence() after
 *    running the SMTP verification pipeline.
 *
 * Factors applied here:
 *  1. Provider pattern preferences (Google/Microsoft have different common formats).
 *  2. A mild penalty when the domain cannot be resolved at all (hasMxRecords=false).
 *  3. A hard penalty for malformed email addresses.
 */
export function calculateEnhancedConfidence(
  baseConfidence: number,
  domainVerified: boolean,
  emailProvider: string | undefined,
  pattern: string,
  formatValid: boolean
): number {
  let confidence = baseConfidence;

  // Apply provider-specific pattern preferences (small signal, still useful without SMTP data)
  if (emailProvider) {
    const preferences = getProviderPatternPreferences(
      emailProvider as 'google' | 'microsoft' | 'custom'
    );
    confidence += preferences[pattern] || 0;
  }

  // If the domain is definitively unresolvable (no MX, domain doesn't exist) apply a
  // mild penalty â€” the address is unlikely to work regardless of pattern.
  // Note: we no longer reward verified domains with +20; that was misleading.
  if (!domainVerified) {
    confidence = Math.max(10, confidence - 15);
  }

  // Hard penalty for malformed address format
  if (!formatValid) {
    confidence = Math.max(5, confidence - 40);
  }

  // Cap at 85 for unverified patterns. 86-95 is reserved for SMTP-confirmed addresses.
  return Math.min(85, Math.max(5, confidence));
}

/**
 * Apply SMTP deliverability result to a confidence score.
 *
 * Confidence score reference:
 * | Score | Source |
 * | 92 | SMTP probe: DELIVERABLE â€” mail server accepted RCPT TO |
 * | 70-85 | Pattern confidence: high (Google first.last, learned patterns) |
 * | 50-69 | Pattern confidence: medium |
 * | 35-45 | SMTP: RISKY â€” catch-all domain |
 * | 10-34 | Pattern confidence: low |
 *
 * Maps a verification result to a final confidence score.
 * Used for SMTP probe results.
 * SMTP DELIVERABLE maps to 92.
 *
 * @param baseConfidence  Score produced by calculateEnhancedConfidence (0-100).
 * @param deliverability  Deliverability label from verification response.
 * @param smtpScore       Normalised SMTP quality score (0-1).
 */
export function calculateDeliverabilityConfidence(
  baseConfidence: number,
  deliverability: 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN',
  smtpScore: number,
): number {
  switch (deliverability) {
    case 'DELIVERABLE':
      // SMTP handshake confirmed this mailbox accepts mail.
      return 92;

    case 'UNDELIVERABLE':
      // SMTP confirmed hard bounce â€” keep a floor of 5 (don't show 0%).
      return 5;

    case 'RISKY':
      // Catch-all or spam-trap risk. Use smtpScore to fine-tune within 35-45.
      // smtpScore is 0-1; contributes up to +10 pts.
      return Math.round(35 + Math.min(1, Math.max(0, smtpScore)) * 10);

    case 'UNKNOWN':
    default:
      // Deliverability couldn't be determined â€” fall back to pattern score.
      return baseConfidence;
  }
}

/**
 * Get confidence color for UI display
 */
export function getConfidenceColor(confidence: number): {
  text: string;
  bg: string;
  label: string;
} {
  if (confidence >= 80) {
    return {
      text: 'text-green-700',
      bg: 'bg-green-100',
      label: 'High',
    };
  }
  if (confidence >= 60) {
    return {
      text: 'text-yellow-700',
      bg: 'bg-yellow-100',
      label: 'Medium',
    };
  }
  return {
    text: 'text-red-700',
    bg: 'bg-red-100',
    label: 'Low',
  };
}

/**
 * Format verification status for display
 */
export function getVerificationStatusDisplay(verified: boolean, error?: string): {
  icon: string;
  text: string;
  color: string;
} {
  if (verified) {
    return {
      icon: 'âœ“',
      text: 'Valid domain',
      color: 'text-green-600',
    };
  }

  if (error?.includes('not exist')) {
    return {
      icon: 'âœ—',
      text: 'Invalid domain',
      color: 'text-red-600',
    };
  }

  if (error?.includes('No MX')) {
    return {
      icon: 'âš ',
      text: 'No mail server',
      color: 'text-yellow-600',
    };
  }

  return {
    icon: '?',
    text: 'Unverified',
    color: 'text-gray-600',
  };
}

/**
 * Get email provider display name
 */
export function getProviderDisplayName(provider?: string): string {
  switch (provider) {
    case 'google':
      return 'Google Workspace';
    case 'microsoft':
      return 'Microsoft 365';
    case 'custom':
      return 'Custom Email Server';
    default:
      return 'Unknown';
  }
}
