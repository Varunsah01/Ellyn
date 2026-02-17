export interface ParsedName {
  first: string;
  last: string;
  firstInitial: string;
  lastInitial: string;
}

export interface EmailPattern {
  email: string;
  pattern: string;
  baseConfidence: number;
}

/**
 * Parse and normalize a person's name
 * Handles middle initials, titles, suffixes, and hyphenated names
 */
export function parseName(firstName: string, lastName: string): ParsedName {
  // Common titles to remove
  const titles = ['dr', 'mr', 'mrs', 'ms', 'miss', 'prof', 'professor'];

  // Common suffixes to remove
  const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'esq', 'phd', 'md'];

  // Clean and normalize first name
  let cleanFirst = firstName.toLowerCase().trim();

  // Remove titles from first name
  titles.forEach(title => {
    const regex = new RegExp(`^${title}\\.?\\s+`, 'i');
    cleanFirst = cleanFirst.replace(regex, '');
  });

  // Handle middle initials (e.g., "John A. Smith" -> "John")
  // Remove anything after a space (middle names/initials)
  cleanFirst = cleanFirst.split(/\s+/)[0] ?? '';

  // Remove dots and special characters
  cleanFirst = cleanFirst.replace(/[.\-]/g, '');

  // Clean and normalize last name
  let cleanLast = lastName.toLowerCase().trim();

  // Remove suffixes from last name
  suffixes.forEach(suffix => {
    const regex = new RegExp(`\\s+${suffix}\\.?$`, 'i');
    cleanLast = cleanLast.replace(regex, '');
  });

  // Handle hyphenated last names - keep the hyphen for now
  // We'll generate variations with and without it
  cleanLast = cleanLast.replace(/\s+/g, '');

  // Get initials
  const firstInitial = cleanFirst.charAt(0);
  const lastInitial = cleanLast.charAt(0);

  return {
    first: cleanFirst,
    last: cleanLast,
    firstInitial,
    lastInitial
  };
}

/**
 * Generate all possible email pattern variations
 */
export function generateEmailPatterns(
  firstName: string,
  lastName: string,
  domain: string
): EmailPattern[] {
  const parsed = parseName(firstName, lastName);
  const { first, last, firstInitial, lastInitial } = parsed;

  // Remove any @ from domain if accidentally included
  domain = domain.replace('@', '').trim();

  const patterns: EmailPattern[] = [];

  // Helper to avoid duplicates
  const addPattern = (email: string, pattern: string, confidence: number) => {
    if (!patterns.some(p => p.email === email)) {
      patterns.push({ email, pattern, baseConfidence: confidence });
    }
  };

  // Pattern 1: first.last@domain (most common)
  addPattern(`${first}.${last}@${domain}`, 'first.last', 40);

  // Pattern 2: firstlast@domain
  addPattern(`${first}${last}@${domain}`, 'firstlast', 30);

  // Pattern 3: first@domain (less common but used by small companies)
  addPattern(`${first}@${domain}`, 'first', 25);

  // Pattern 4: f.last@domain
  addPattern(`${firstInitial}.${last}@${domain}`, 'f.last', 20);

  // Pattern 5: first_last@domain
  addPattern(`${first}_${last}@${domain}`, 'first_last', 15);

  // Pattern 6: flast@domain
  addPattern(`${firstInitial}${last}@${domain}`, 'flast', 15);

  // Pattern 7: lastf@domain
  addPattern(`${last}${firstInitial}@${domain}`, 'lastf', 15);

  // Pattern 8: last.first@domain (reverse)
  addPattern(`${last}.${first}@${domain}`, 'last.first', 15);

  // Pattern 9: f.l@domain (only if names are long to avoid too-short emails)
  if (first.length > 4 && last.length > 4) {
    addPattern(`${firstInitial}.${lastInitial}@${domain}`, 'f.l', 10);
  }

  // Handle hyphenated last names - generate variations without hyphen
  if (last.includes('-')) {
    const lastNoHyphen = last.replace(/-/g, '');
    addPattern(`${first}.${lastNoHyphen}@${domain}`, 'first.last', 35);
    addPattern(`${first}${lastNoHyphen}@${domain}`, 'firstlast', 25);
    addPattern(`${firstInitial}.${lastNoHyphen}@${domain}`, 'f.last', 18);
    addPattern(`${firstInitial}${lastNoHyphen}@${domain}`, 'flast', 12);
  }

  // Sort by confidence (highest first)
  patterns.sort((a, b) => b.baseConfidence - a.baseConfidence);

  return patterns;
}

/**
 * Guess the domain from a company name using smart TLD resolution with MX verification
 */
export async function guessDomain(companyName: string): Promise<string | null> {
  const { smartResolveDomain } = await import('@/lib/smart-tld-resolver')
  const result = await smartResolveDomain(companyName)
  return result?.domain ?? null
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get confidence color class for UI
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-green-600 dark:text-green-400';
  if (confidence >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-600 dark:text-gray-400';
}

/**
 * Get confidence badge variant
 */
export function getConfidenceBadgeVariant(
  confidence: number
): 'default' | 'secondary' | 'outline' {
  if (confidence >= 80) return 'default';
  if (confidence >= 50) return 'secondary';
  return 'outline';
}
