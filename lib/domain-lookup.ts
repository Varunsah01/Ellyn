/**
 * Free Domain Lookup Services
 * Uses Clearbit Logo API and Brandfetch API (both free)
 */

export async function lookupCompanyDomain(companyName: string): Promise<string | null> {
  try {
    // Clearbit Logo API - completely free, no auth required
    // If logo exists for domain, domain is valid
    const cleanName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/(inc|llc|corp|corporation|ltd|limited|co|company)$/i, '');

    const possibleDomain = `${cleanName}.com`;

    const response = await fetch(
      `https://logo.clearbit.com/${possibleDomain}`,
      {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      }
    );

    if (response.ok) {
      console.log('[Domain Lookup] Clearbit found:', possibleDomain);
      return possibleDomain;
    }

    return null;
  } catch (error) {
    console.warn('[Domain Lookup] Clearbit failed:', error);
    return null;
  }
}

export async function brandfetchDomain(companyName: string): Promise<string | null> {
  try {
    // Brandfetch API - free tier, no auth required
    const response = await fetch(
      `https://api.brandfetch.io/v2/search/${encodeURIComponent(companyName)}`,
      {
        signal: AbortSignal.timeout(3000)
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.length > 0 && data[0].domain) {
      console.log('[Domain Lookup] Brandfetch found:', data[0].domain);
      return data[0].domain;
    }

    return null;
  } catch (error) {
    console.warn('[Domain Lookup] Brandfetch failed:', error);
    return null;
  }
}

export async function googleSearchDomain(companyName: string): Promise<string | null> {
  const API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

  // If no API key configured, skip
  if (!API_KEY || !SEARCH_ENGINE_ID) {
    console.warn('[Domain Lookup] Google Search not configured');
    return null;
  }

  try {
    const query = `${companyName} official website`;
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`,
      {
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn('[Domain Lookup] Google Search API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const url = new URL(data.items[0].link);
      const domain = url.hostname.replace('www.', '');
      console.log('[Domain Lookup] Google Search found:', domain);
      return domain;
    }

    return null;
  } catch (error) {
    console.warn('[Domain Lookup] Google Search failed:', error);
    return null;
  }
}

export function heuristicDomainGuess(companyName: string): string {
  // Fallback: clean company name and add .com
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(inc|llc|corp|corporation|ltd|limited|co|company)$/i, '')
    + '.com';
}
