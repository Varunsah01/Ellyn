/**
 * Email Inference Engine
 *
 * HEURISTICS-BASED EMAIL PATTERN GENERATION
 * =========================================
 *
 * This module generates likely email addresses using pattern recognition
 * and heuristics. NO API calls are made - everything is client-side.
 *
 * Key Features:
 * - Company domain inference from company name
 * - Multiple email pattern generation with confidence scores
 * - Role-based confidence adjustments
 * - Name normalization and cleaning
 * - Local caching for learned patterns
 *
 * @module EmailInference
 */

/**
 * Known domain mappings for top companies
 * These override the heuristic domain guessing for accuracy
 *
 * Maintained list of top 100 tech companies + Fortune 500
 */
const KNOWN_DOMAINS = {
  // Tech Giants
  "google": "google.com",
  "alphabet": "google.com",
  "microsoft": "microsoft.com",
  "apple": "apple.com",
  "amazon": "amazon.com",
  "meta": "meta.com",
  "facebook": "meta.com",
  "netflix": "netflix.com",
  "tesla": "tesla.com",
  "spacex": "spacex.com",
  "x": "x.com",
  "twitter": "x.com",

  // Tech Companies
  "adobe": "adobe.com",
  "salesforce": "salesforce.com",
  "oracle": "oracle.com",
  "ibm": "ibm.com",
  "intel": "intel.com",
  "nvidia": "nvidia.com",
  "amd": "amd.com",
  "qualcomm": "qualcomm.com",
  "cisco": "cisco.com",
  "dell": "dell.com",
  "hp": "hp.com",
  "hewlett packard": "hp.com",
  "sap": "sap.com",
  "vmware": "vmware.com",
  "servicenow": "servicenow.com",
  "workday": "workday.com",
  "snowflake": "snowflake.com",
  "databricks": "databricks.com",
  "stripe": "stripe.com",
  "square": "square.com",
  "paypal": "paypal.com",
  "uber": "uber.com",
  "lyft": "lyft.com",
  "airbnb": "airbnb.com",
  "spotify": "spotify.com",
  "zoom": "zoom.us",
  "slack": "slack.com",
  "atlassian": "atlassian.com",
  "shopify": "shopify.com",
  "dropbox": "dropbox.com",
  "box": "box.com",
  "twilio": "twilio.com",
  "github": "github.com",
  "gitlab": "gitlab.com",
  "reddit": "reddit.com",
  "pinterest": "pinterest.com",
  "snap": "snap.com",
  "snapchat": "snap.com",
  "tiktok": "tiktok.com",
  "bytedance": "bytedance.com",

  // Consulting & Professional Services
  "mckinsey": "mckinsey.com",
  "bcg": "bcg.com",
  "boston consulting group": "bcg.com",
  "bain": "bain.com",
  "deloitte": "deloitte.com",
  "pwc": "pwc.com",
  "pricewaterhousecoopers": "pwc.com",
  "ey": "ey.com",
  "ernst & young": "ey.com",
  "kpmg": "kpmg.com",
  "accenture": "accenture.com",

  // Financial Services
  "goldman sachs": "gs.com",
  "goldman": "gs.com",
  "morgan stanley": "morganstanley.com",
  "jpmorgan": "jpmorgan.com",
  "jp morgan": "jpmorgan.com",
  "citigroup": "citi.com",
  "citi": "citi.com",
  "bank of america": "bofa.com",
  "bofa": "bofa.com",
  "wells fargo": "wellsfargo.com",
  "charles schwab": "schwab.com",
  "blackrock": "blackrock.com",
  "vanguard": "vanguard.com",
  "fidelity": "fidelity.com",

  // E-commerce & Retail
  "walmart": "walmart.com",
  "target": "target.com",
  "costco": "costco.com",
  "home depot": "homedepot.com",
  "lowes": "lowes.com",
  "best buy": "bestbuy.com",

  // Automotive
  "ford": "ford.com",
  "gm": "gm.com",
  "general motors": "gm.com",
  "toyota": "toyota.com",
  "honda": "honda.com",
  "bmw": "bmw.com",
  "mercedes": "mercedes-benz.com",
  "volkswagen": "volkswagen.com",

  // Add more as needed...
};

/**
 * Common company name suffixes to remove
 */
const COMPANY_SUFFIXES = [
  'incorporated',
  'corporation',
  'company',
  'limited',
  'inc',
  'llc',
  'ltd',
  'corp',
  'co',
  'plc',
  'group',
  'holdings',
  'international',
  'global',
  'ventures',
  'partners',
  'technologies',
  'tech',
  'solutions',
  'services',
  'consulting',
  'capital',
  'enterprises',
];

/**
 * Infer company domain from company name
 *
 * Strategy:
 * 1. Check known domains first
 * 2. Clean company name (remove suffixes, special chars)
 * 3. Check cached mappings
 * 4. Generate heuristic domain
 *
 * @param {string} companyName - Company name
 * @param {Object} cache - Optional domain cache
 * @returns {string} Inferred domain
 */
function inferCompanyDomain(companyName, cache = null) {
  if (!companyName || companyName === 'Not available') {
    return '';
  }

  // Normalize company name for lookup
  const normalized = companyName.toLowerCase().trim();

  // Strategy 1: Check known domains
  if (KNOWN_DOMAINS[normalized]) {
    console.log('[Email Inference] Using known domain for:', companyName, '→', KNOWN_DOMAINS[normalized]);
    return KNOWN_DOMAINS[normalized];
  }

  // Strategy 2: Check cache
  if (cache && cache.domainCache && cache.domainCache[normalized]) {
    console.log('[Email Inference] Using cached domain for:', companyName, '→', cache.domainCache[normalized]);
    return cache.domainCache[normalized];
  }

  // Strategy 3: Heuristic domain generation
  let cleanName = normalized;

  // Remove common suffixes
  COMPANY_SUFFIXES.forEach(suffix => {
    const regex = new RegExp(`\\s*${suffix}\\.?\\s*$`, 'i');
    cleanName = cleanName.replace(regex, '');
  });

  // Remove special characters and spaces
  cleanName = cleanName
    .replace(/[^a-z0-9\s-]/g, '') // Keep letters, numbers, spaces, hyphens
    .replace(/\s+/g, '')          // Remove spaces
    .replace(/-+/g, '');          // Remove hyphens

  // If empty after cleaning, use first word of original
  if (!cleanName) {
    cleanName = companyName.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
  }

  // Default to .com (most common TLD)
  const domain = `${cleanName}.com`;

  console.log('[Email Inference] Generated heuristic domain for:', companyName, '→', domain);
  return domain;
}

/**
 * Normalize name for email generation
 *
 * Handles:
 * - Multiple middle names (use only first and last)
 * - Hyphenated names (generate variants)
 * - Special characters (remove accents, convert to ASCII)
 * - Nicknames in parentheses (use formal name)
 * - Titles (Dr., Mr., etc.)
 *
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {Object} Normalized name parts
 */
function normalizeName(firstName, lastName) {
  // Clean both names
  const cleanFirst = cleanNamePart(firstName);
  const cleanLast = cleanNamePart(lastName);

  // Handle hyphenated names - keep for variants
  const hasHyphenFirst = cleanFirst.includes('-');
  const hasHyphenLast = cleanLast.includes('-');

  return {
    first: cleanFirst,
    last: cleanLast,
    firstNoHyphen: cleanFirst.replace(/-/g, ''),
    lastNoHyphen: cleanLast.replace(/-/g, ''),
    firstInitial: cleanFirst.charAt(0),
    lastInitial: cleanLast.charAt(0),
    hasHyphenFirst,
    hasHyphenLast
  };
}

/**
 * Clean individual name part
 *
 * @param {string} name - Name to clean
 * @returns {string} Cleaned name
 */
function cleanNamePart(name) {
  if (!name) return '';

  let clean = name.toLowerCase().trim();

  // Remove titles
  const titles = ['dr', 'mr', 'mrs', 'ms', 'miss', 'prof', 'professor'];
  titles.forEach(title => {
    const regex = new RegExp(`^${title}\\.?\\s+`, 'i');
    clean = clean.replace(regex, '');
  });

  // Remove nicknames in parentheses: "John (Johnny)" → "John"
  clean = clean.replace(/\s*\([^)]*\)/g, '');

  // Take first part only (removes middle names)
  clean = clean.split(/\s+/)[0];

  // Remove accents and convert to ASCII
  clean = removeAccents(clean);

  // Remove special characters except hyphens
  clean = clean.replace(/[^a-z0-9-]/g, '');

  return clean;
}

/**
 * Remove accents from text (é → e, ñ → n, etc.)
 *
 * @param {string} text - Text with accents
 * @returns {string} Text without accents
 */
function removeAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Generate email patterns with confidence scores
 *
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} domain - Company domain
 * @param {Object} options - Optional config (role, cache)
 * @returns {Array} Email patterns with confidence scores
 */
function generateEmailPatterns(firstName, lastName, domain, options = {}) {
  if (!firstName || !lastName || !domain) {
    console.warn('[Email Inference] Missing required fields for pattern generation');
    return [];
  }

  const name = normalizeName(firstName, lastName);
  const patterns = [];

  // Helper to add pattern without duplicates
  function addPattern(email, patternType, baseConfidence) {
    // Check if already exists
    if (patterns.some(p => p.email === email)) {
      return;
    }

    // Adjust confidence based on role and company
    let confidence = baseConfidence;

    // Role-based adjustments
    if (options.role) {
      confidence = adjustConfidenceByRole(confidence, options.role, patternType);
    }

    // Company-based adjustments
    if (options.companySize) {
      confidence = adjustConfidenceByCompanySize(confidence, options.companySize, patternType);
    }

    // Check cached patterns for this domain
    if (options.cache && options.cache.patternCache && options.cache.patternCache[domain]) {
      const cachedPattern = options.cache.patternCache[domain];
      if (patternType === cachedPattern) {
        confidence = Math.min(confidence + 0.2, 0.95); // Boost by 20%, cap at 95%
        console.log('[Email Inference] Boosting confidence for cached pattern:', patternType);
      }
    }

    patterns.push({
      email,
      pattern: patternType,
      confidence: parseFloat(confidence.toFixed(2))
    });
  }

  // PATTERN 1: first.last@domain (most common)
  addPattern(`${name.first}.${name.last}@${domain}`, 'first.last', 0.70);

  // PATTERN 2: first@domain (common for small companies, founders)
  addPattern(`${name.first}@${domain}`, 'first', 0.50);

  // PATTERN 3: f.last@domain (common in large orgs)
  addPattern(`${name.firstInitial}.${name.last}@${domain}`, 'f.last', 0.40);

  // PATTERN 4: flast@domain
  addPattern(`${name.firstInitial}${name.last}@${domain}`, 'flast', 0.30);

  // PATTERN 5: firstlast@domain (no separator)
  addPattern(`${name.first}${name.last}@${domain}`, 'firstlast', 0.25);

  // PATTERN 6: first_last@domain (underscore separator)
  addPattern(`${name.first}_${name.last}@${domain}`, 'first_last', 0.20);

  // PATTERN 7: lastfirst@domain (reverse, less common)
  addPattern(`${name.last}${name.firstInitial}@${domain}`, 'lastf', 0.15);

  // PATTERN 8: last.first@domain (reverse with dot)
  addPattern(`${name.last}.${name.first}@${domain}`, 'last.first', 0.10);

  // PATTERN 9: f.l@domain (only if names are long enough)
  if (name.first.length > 3 && name.last.length > 3) {
    addPattern(`${name.firstInitial}.${name.lastInitial}@${domain}`, 'f.l', 0.08);
  }

  // HYPHENATED NAME VARIANTS
  // If either name has hyphen, generate variants without hyphen
  if (name.hasHyphenFirst || name.hasHyphenLast) {
    const f = name.hasHyphenFirst ? name.firstNoHyphen : name.first;
    const l = name.hasHyphenLast ? name.lastNoHyphen : name.last;

    addPattern(`${f}.${l}@${domain}`, 'first.last-no-hyphen', 0.60);
    addPattern(`${f}${l}@${domain}`, 'firstlast-no-hyphen', 0.22);
    addPattern(`${f.charAt(0)}.${l}@${domain}`, 'f.last-no-hyphen', 0.35);
  }

  // Sort by confidence (highest first)
  patterns.sort((a, b) => b.confidence - a.confidence);

  console.log('[Email Inference] Generated', patterns.length, 'email patterns');
  return patterns;
}

/**
 * Adjust confidence based on role
 *
 * Heuristics:
 * - Recruiters/HR → boost first.last (70% → 80%)
 * - Founders/CEO → boost first@ (50% → 65%)
 * - Engineers/Developers → boost first.last
 * - Sales → boost first.last
 *
 * @param {number} baseConfidence - Base confidence score
 * @param {string} role - Job role/title
 * @param {string} patternType - Pattern type
 * @returns {number} Adjusted confidence
 */
function adjustConfidenceByRole(baseConfidence, role, patternType) {
  const roleLower = role.toLowerCase();

  // Recruiter/HR patterns
  if (roleLower.includes('recruit') || roleLower.includes('hr') || roleLower.includes('human resources')) {
    if (patternType === 'first.last') {
      return Math.min(baseConfidence + 0.10, 0.95);
    }
  }

  // Founder/CEO patterns (often use first@ or simple formats)
  if (roleLower.includes('founder') || roleLower.includes('ceo') || roleLower.includes('chief executive')) {
    if (patternType === 'first') {
      return Math.min(baseConfidence + 0.15, 0.95);
    }
  }

  // Engineering roles (typically first.last)
  if (roleLower.includes('engineer') || roleLower.includes('developer') || roleLower.includes('software')) {
    if (patternType === 'first.last') {
      return Math.min(baseConfidence + 0.05, 0.95);
    }
  }

  // Sales roles (typically first.last or first)
  if (roleLower.includes('sales') || roleLower.includes('account')) {
    if (patternType === 'first.last' || patternType === 'first') {
      return Math.min(baseConfidence + 0.05, 0.95);
    }
  }

  return baseConfidence;
}

/**
 * Adjust confidence based on company size
 *
 * Heuristics:
 * - Large companies (Fortune 500, tech giants) → first.last most common
 * - Small companies/startups → first@ more common
 * - Medium companies → mixed patterns
 *
 * @param {number} baseConfidence - Base confidence score
 * @param {string} size - Company size estimate ('small', 'medium', 'large')
 * @param {string} patternType - Pattern type
 * @returns {number} Adjusted confidence
 */
function adjustConfidenceByCompanySize(baseConfidence, size, patternType) {
  if (size === 'large') {
    if (patternType === 'first.last') {
      return Math.min(baseConfidence + 0.10, 0.95);
    }
    if (patternType === 'first') {
      return Math.max(baseConfidence - 0.10, 0.05);
    }
  }

  if (size === 'small') {
    if (patternType === 'first') {
      return Math.min(baseConfidence + 0.10, 0.95);
    }
    if (patternType === 'first.last') {
      return Math.max(baseConfidence - 0.05, 0.05);
    }
  }

  return baseConfidence;
}

/**
 * Estimate company size from domain (heuristic)
 *
 * @param {string} domain - Company domain
 * @returns {string} Size estimate ('small', 'medium', 'large', 'unknown')
 */
function estimateCompanySize(domain) {
  // Check if it's a known large company
  const largeCompanies = Object.values(KNOWN_DOMAINS);
  if (largeCompanies.includes(domain)) {
    return 'large';
  }

  // Otherwise unknown
  return 'unknown';
}

/**
 * Get confidence level label from score
 *
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} Level: 'high', 'medium', 'low'
 */
function getConfidenceLevel(confidence) {
  if (confidence >= 0.60) return 'high';
  if (confidence >= 0.30) return 'medium';
  return 'low';
}

/**
 * Validate email format
 *
 * @param {string} email - Email address
 * @returns {boolean} True if valid format
 */
function isValidEmailFormat(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Cache a learned pattern
 *
 * Called when user confirms an email works for a domain
 *
 * @param {string} email - Working email address
 * @param {string} domain - Company domain
 * @param {string} pattern - Pattern that worked (e.g., 'first.last')
 * @param {Object} currentCache - Current cache object
 * @returns {Object} Updated cache
 */
function cacheLearnedPattern(email, domain, pattern, currentCache = {}) {
  const cache = {
    domainCache: currentCache.domainCache || {},
    patternCache: currentCache.patternCache || {}
  };

  // Cache the pattern for this domain
  cache.patternCache[domain] = pattern;

  console.log('[Email Inference] Cached learned pattern:', domain, '→', pattern);

  return cache;
}

/**
 * Cache company to domain mapping
 *
 * @param {string} companyName - Company name
 * @param {string} domain - Confirmed domain
 * @param {Object} currentCache - Current cache object
 * @returns {Object} Updated cache
 */
function cacheDomainMapping(companyName, domain, currentCache = {}) {
  const cache = {
    domainCache: currentCache.domainCache || {},
    patternCache: currentCache.patternCache || {}
  };

  const normalized = companyName.toLowerCase().trim();
  cache.domainCache[normalized] = domain;

  console.log('[Email Inference] Cached domain mapping:', companyName, '→', domain);

  return cache;
}

// Export functions
if (typeof window !== 'undefined') {
  window.EmailInference = {
    inferCompanyDomain,
    normalizeName,
    generateEmailPatterns,
    getConfidenceLevel,
    isValidEmailFormat,
    cacheLearnedPattern,
    cacheDomainMapping,
    estimateCompanySize,
    KNOWN_DOMAINS,
  };
}
