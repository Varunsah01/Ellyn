/**
 * Email Verification and Domain Validation
 * Uses DNS lookups to verify domains can accept email (MX records)
 */

import { promises as dns } from 'dns';

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

/**
 * Verify domain has MX records and can accept email
 * This is a free DNS lookup that requires no API key
 */
export async function verifyDomainMxRecords(domain: string): Promise<DomainVerificationResult> {
  try {
    // Clean domain
    const cleanDomain = domain.replace('@', '').trim().toLowerCase();

    // Resolve MX records
    const mxRecords = await dns.resolveMx(cleanDomain);

    if (!mxRecords || mxRecords.length === 0) {
      return {
        domain: cleanDomain,
        isValid: false,
        hasMxRecords: false,
        mxRecords: [],
        error: 'No MX records found',
      };
    }

    // Sort by priority (lower number = higher priority)
    const sortedMx = mxRecords
      .sort((a, b) => a.priority - b.priority)
      .map(mx => mx.exchange);

    // Detect email provider from MX records
    let emailProvider: 'google' | 'microsoft' | 'custom' = 'custom';
    const primaryMx = sortedMx[0].toLowerCase();

    if (primaryMx.includes('google.com') || primaryMx.includes('googlemail.com')) {
      emailProvider = 'google';
    } else if (
      primaryMx.includes('outlook.com') ||
      primaryMx.includes('microsoft.com') ||
      primaryMx.includes('office365.com')
    ) {
      emailProvider = 'microsoft';
    }

    return {
      domain: cleanDomain,
      isValid: true,
      hasMxRecords: true,
      mxRecords: sortedMx,
      emailProvider,
    };
  } catch (error: any) {
    // Common DNS error codes
    let errorMessage = 'Domain verification failed';

    if (error.code === 'ENOTFOUND') {
      errorMessage = 'Domain does not exist';
    } else if (error.code === 'ENODATA') {
      errorMessage = 'No MX records found';
    } else if (error.code === 'ETIMEOUT') {
      errorMessage = 'DNS lookup timeout';
    }

    return {
      domain: domain.replace('@', '').trim().toLowerCase(),
      isValid: false,
      hasMxRecords: false,
      mxRecords: [],
      error: errorMessage,
    };
  }
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
 * Calculate enhanced confidence score
 * Factors in: domain verification, email provider, pattern, format validation
 */
export function calculateEnhancedConfidence(
  baseConfidence: number,
  domainVerified: boolean,
  emailProvider: string | undefined,
  pattern: string,
  formatValid: boolean
): number {
  let confidence = baseConfidence;

  // Domain verification bonus (+20 if verified)
  if (domainVerified) {
    confidence += 20;
  } else {
    // Penalize unverified domains
    confidence = Math.max(10, confidence - 30);
  }

  // Email provider bonus
  if (emailProvider) {
    const preferences = getProviderPatternPreferences(
      emailProvider as 'google' | 'microsoft' | 'custom'
    );
    confidence += preferences[pattern] || 0;
  }

  // Format validation
  if (!formatValid) {
    confidence = Math.max(5, confidence - 40);
  }

  // Cap confidence at 95% (never 100% certain without verification)
  return Math.min(95, Math.max(5, confidence));
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
      icon: '✓',
      text: 'Valid domain',
      color: 'text-green-600',
    };
  }

  if (error?.includes('not exist')) {
    return {
      icon: '✗',
      text: 'Invalid domain',
      color: 'text-red-600',
    };
  }

  if (error?.includes('No MX')) {
    return {
      icon: '⚠',
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
