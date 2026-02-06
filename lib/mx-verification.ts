/**
 * DNS MX Record Verification (Always Enabled, Free)
 * Validates that a domain can receive emails
 */

import dns from 'dns/promises';

export interface DomainMXInfo {
  hasMX: boolean;
  mxCount: number;
  mxServers: string[];
  provider: string;
  verified: boolean;
}

export async function verifyDomainMX(domain: string): Promise<DomainMXInfo> {
  try {
    const mxRecords = await dns.resolveMx(domain);

    const info: DomainMXInfo = {
      hasMX: mxRecords.length > 0,
      mxCount: mxRecords.length,
      mxServers: mxRecords
        .sort((a, b) => a.priority - b.priority)
        .map(r => r.exchange),
      provider: detectEmailProvider(mxRecords),
      verified: true
    };

    console.log('[MX Verification]', domain, ':', info);

    return info;
  } catch (error) {
    console.warn('[MX Verification] Failed for', domain, ':', error);

    return {
      hasMX: false,
      mxCount: 0,
      mxServers: [],
      provider: 'Unknown',
      verified: false
    };
  }
}

function detectEmailProvider(mxRecords: any[]): string {
  if (!mxRecords.length) return 'Unknown';

  const server = mxRecords[0].exchange.toLowerCase();

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

export async function batchVerifyDomains(domains: string[]): Promise<Map<string, DomainMXInfo>> {
  const results = new Map<string, DomainMXInfo>();

  // Verify all domains in parallel
  const verifications = await Promise.allSettled(
    domains.map(domain => verifyDomainMX(domain))
  );

  domains.forEach((domain, index) => {
    const result = verifications[index];
    if (result.status === 'fulfilled') {
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
