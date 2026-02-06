/**
 * Enhanced Email Pattern Generation
 * Uses company size estimation and role analysis
 */

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

const KNOWN_DOMAINS: Record<string, string> = {
  // Tech Giants (Enterprise)
  'google': 'google.com',
  'alphabet': 'google.com',
  'microsoft': 'microsoft.com',
  'apple': 'apple.com',
  'amazon': 'amazon.com',
  'meta': 'meta.com',
  'facebook': 'meta.com',
  'netflix': 'netflix.com',
  'tesla': 'tesla.com',

  // Large Tech
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

  // Consulting
  'mckinsey': 'mckinsey.com',
  'bcg': 'bcg.com',
  'bain': 'bain.com',
  'deloitte': 'deloitte.com',
  'pwc': 'pwc.com',
  'ey': 'ey.com',
  'kpmg': 'kpmg.com',
  'accenture': 'accenture.com',

  // Finance
  'goldman sachs': 'gs.com',
  'goldman': 'gs.com',
  'morgan stanley': 'morganstanley.com',
  'jpmorgan': 'jpmorgan.com',
  'citi': 'citi.com',
  'bank of america': 'bofa.com',
  'wells fargo': 'wellsfargo.com',

  // Startups/Medium
  'stripe': 'stripe.com',
  'uber': 'uber.com',
  'lyft': 'lyft.com',
  'airbnb': 'airbnb.com',
  'spotify': 'spotify.com',
  'zoom': 'zoom.us',
  'slack': 'slack.com',
  'shopify': 'shopify.com',
  'dropbox': 'dropbox.com',
  'atlassian': 'atlassian.com'
};

export function getKnownDomain(companyName: string): string | null {
  const key = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return KNOWN_DOMAINS[key] || null;
}

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
  const l = last[0];

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

  // Sort by confidence and return top 8
  return patterns
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
}
