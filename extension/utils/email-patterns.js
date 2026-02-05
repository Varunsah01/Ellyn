/**
 * Email Pattern Generation Utilities
 * Converted from TypeScript version in web app
 * No dependencies - pure vanilla JavaScript
 */

/**
 * Parse and normalize a person's name
 * Handles middle initials, titles, suffixes, and hyphenated names
 *
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {Object} Parsed name object with first, last, firstInitial, lastInitial
 */
function parseName(firstName, lastName) {
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
  cleanFirst = cleanFirst.split(/\s+/)[0];

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
    firstInitial: firstInitial,
    lastInitial: lastInitial
  };
}

/**
 * Generate all possible email pattern variations
 *
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} domain - Email domain
 * @returns {Array} Array of email pattern objects with email, pattern, baseConfidence
 */
function generateEmailPatterns(firstName, lastName, domain) {
  const parsed = parseName(firstName, lastName);
  const { first, last, firstInitial, lastInitial } = parsed;

  // Remove any @ from domain if accidentally included
  domain = domain.replace('@', '').trim();

  const patterns = [];

  // Helper to avoid duplicates
  function addPattern(email, pattern, confidence) {
    if (!patterns.some(p => p.email === email)) {
      patterns.push({
        email: email,
        pattern: pattern,
        baseConfidence: confidence
      });
    }
  }

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
 * Guess the domain from a company name
 *
 * @param {string} companyName - Company name
 * @returns {string} Guessed domain (e.g., "microsoft.com")
 */
function guessDomain(companyName) {
  let cleanName = companyName.toLowerCase().trim();

  // Remove common company suffixes
  const suffixes = [
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
    'global'
  ];

  // Remove suffixes with optional period and whitespace
  suffixes.forEach(suffix => {
    const regex = new RegExp(`\\s*${suffix}\\.?\\s*$`, 'i');
    cleanName = cleanName.replace(regex, '');
  });

  // Remove special characters and punctuation
  cleanName = cleanName.replace(/[^a-z0-9\s]/g, '');

  // Remove extra whitespace and replace spaces with empty string
  cleanName = cleanName.replace(/\s+/g, '');

  // If the cleaned name is empty, return the original with .com
  if (!cleanName) {
    cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Append .com (most common TLD)
  return `${cleanName}.com`;
}

/**
 * Validate email format
 *
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get confidence level from score
 *
 * @param {number} confidence - Confidence score (0-100)
 * @returns {string} 'high', 'medium', or 'low'
 */
function getConfidenceLevel(confidence) {
  if (confidence >= 30) return 'high';
  if (confidence >= 20) return 'medium';
  return 'low';
}

/**
 * Get initials from full name
 *
 * @param {string} fullName - Full name
 * @returns {string} Initials (e.g., "JD" from "John Doe")
 */
function getInitials(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Export functions for use in other scripts
// Note: In browser extension context, these will be available globally
if (typeof window !== 'undefined') {
  window.EmailPatterns = {
    parseName,
    generateEmailPatterns,
    guessDomain,
    isValidEmail,
    getConfidenceLevel,
    getInitials
  };
}
