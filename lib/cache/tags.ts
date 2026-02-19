import { clearByTag, normalizeCacheToken } from '@/lib/cache/redis'

export const CACHE_TAGS = {
  emailPatterns: 'email-patterns',
  domainLookup: 'domain-lookup',
  mxVerification: 'mx-verification',
  userAnalytics: 'user-analytics',
  emailVerification: 'email-address-verification',
}

function normalizeCompanyLookupTagValue(companyName: string): string {
  const reduced = String(companyName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(inc|llc|corp|corporation|ltd|limited|co|company)$/i, '')
    .trim()

  return normalizeCacheToken(reduced)
}

export function emailPatternDomainTag(domain: string): string {
  return `${CACHE_TAGS.emailPatterns}:domain:${normalizeCacheToken(domain)}`
}

export function companyDomainLookupTag(companyName: string): string {
  const normalized = normalizeCompanyLookupTagValue(companyName) || 'unknown'
  return `${CACHE_TAGS.domainLookup}:company:${normalized}`
}

export function mxVerificationDomainTag(domain: string): string {
  return `${CACHE_TAGS.mxVerification}:domain:${normalizeCacheToken(domain)}`
}

export function userAnalyticsTag(userId: string): string {
  return `${CACHE_TAGS.userAnalytics}:user:${normalizeCacheToken(userId)}`
}

export async function invalidateEmailPatternCache(domain: string): Promise<number> {
  return clearByTag(emailPatternDomainTag(domain))
}

export async function invalidateCompanyDomainLookupCache(companyName: string): Promise<number> {
  return clearByTag(companyDomainLookupTag(companyName))
}

export async function invalidateMxVerificationCache(domain: string): Promise<number> {
  return clearByTag(mxVerificationDomainTag(domain))
}

export async function invalidateUserAnalyticsCache(userId: string): Promise<number> {
  return clearByTag(userAnalyticsTag(userId))
}

export function emailVerificationTag(email: string): string {
  return `${CACHE_TAGS.emailVerification}:${normalizeCacheToken(email)}`
}

export async function invalidateEmailVerificationCache(email: string): Promise<number> {
  return clearByTag(emailVerificationTag(email))
}
