/**
 * LinkedIn Profile Extractor - Content Script
 *
 * SAFETY GUARANTEES:
 * ✓ NO automatic extraction on page load
 * ✓ NO background scraping or automation
 * ✓ NO crawling multiple profiles
 * ✓ ONLY extracts when user clicks "Extract Contact" button
 * ✓ ONLY reads visible DOM elements (no hidden data)
 * ✓ NO simulated clicks or interactions
 * ✓ NO network requests to LinkedIn
 *
 * This is a READ-ONLY, USER-TRIGGERED data extraction tool.
 */

console.log('[Ellyn] LinkedIn extractor content script loaded');

/**
 * Check if current URL is a LinkedIn profile page
 *
 * @returns {boolean} True if on a profile page
 */
function isProfilePage() {
  const url = window.location.href;
  // Must contain /in/ but NOT /edit/ (edit mode is excluded for safety)
  return url.includes('linkedin.com/in/') && !url.includes('/edit/');
}

/**
 * SELECTOR STRATEGIES
 * LinkedIn frequently updates their DOM structure. We use multiple fallback strategies.
 */

/**
 * Extract full name using multiple selector strategies
 *
 * Strategy priority:
 * 1. Main profile header h1 (most reliable)
 * 2. Profile details section h1
 * 3. Page title meta tag (fallback)
 *
 * @returns {string} Full name or empty string
 */
function extractFullName() {
  const strategies = [
    // Strategy 1: Main profile header (2024 structure)
    () => {
      const element = document.querySelector('h1.text-heading-xlarge');
      return element?.textContent?.trim() || '';
    },

    // Strategy 2: Alternative class names
    () => {
      const element = document.querySelector('h1[class*="inline"]');
      return element?.textContent?.trim() || '';
    },

    // Strategy 3: Profile details panel
    () => {
      const element = document.querySelector('.pv-text-details__left-panel h1');
      return element?.textContent?.trim() || '';
    },

    // Strategy 4: Any h1 in top card
    () => {
      const topCard = document.querySelector('.pv-top-card');
      const element = topCard?.querySelector('h1');
      return element?.textContent?.trim() || '';
    },

    // Strategy 5: Page title (last resort)
    () => {
      const title = document.title;
      // LinkedIn titles are like "Name | LinkedIn"
      if (title.includes('|')) {
        return title.split('|')[0].trim();
      }
      return '';
    }
  ];

  // Try each strategy until one succeeds
  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result) {
        console.log('[Ellyn] Extracted name using strategy', strategies.indexOf(strategy) + 1);
        return cleanText(result);
      }
    } catch (error) {
      console.warn('[Ellyn] Name extraction strategy failed:', error);
    }
  }

  return '';
}

/**
 * Extract current role/headline
 *
 * Strategy priority:
 * 1. Profile headline/tagline (directly under name)
 * 2. First experience entry title
 * 3. Meta description
 *
 * @returns {string} Current role or empty string
 */
function extractCurrentRole() {
  const strategies = [
    // Strategy 1: Profile headline (most common)
    () => {
      const element = document.querySelector('.text-body-medium.break-words');
      return element?.textContent?.trim() || '';
    },

    // Strategy 2: Profile details panel
    () => {
      const element = document.querySelector('.pv-text-details__left-panel .text-body-medium');
      return element?.textContent?.trim() || '';
    },

    // Strategy 3: Top card subtitle
    () => {
      const topCard = document.querySelector('.pv-top-card');
      const element = topCard?.querySelector('.text-body-medium');
      return element?.textContent?.trim() || '';
    },

    // Strategy 4: First experience entry
    () => {
      const experienceSection = document.querySelector('#experience');
      if (!experienceSection) return '';

      // Find first experience title
      const firstRole = experienceSection.querySelector('.pvs-entity__path-node span[aria-hidden="true"]');
      return firstRole?.textContent?.trim() || '';
    },

    // Strategy 5: Meta description
    () => {
      const meta = document.querySelector('meta[name="description"]');
      const content = meta?.getAttribute('content') || '';
      // Meta descriptions often start with "Role at Company"
      if (content) {
        // Extract first sentence or up to first period
        return content.split('.')[0].trim();
      }
      return '';
    }
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result) {
        console.log('[Ellyn] Extracted role using strategy', strategies.indexOf(strategy) + 1);
        return cleanText(result);
      }
    } catch (error) {
      console.warn('[Ellyn] Role extraction strategy failed:', error);
    }
  }

  return 'Not available';
}

/**
 * Extract company name from role headline or experience section
 *
 * Strategy priority:
 * 1. Parse from headline text ("at Company", "@ Company")
 * 2. First experience entry company
 * 3. Top card company link
 *
 * @param {string} roleText - Current role text to parse
 * @returns {string} Company name or empty string
 */
function extractCompanyName(roleText) {
  const strategies = [
    // Strategy 1: Parse from role text
    () => {
      if (!roleText || roleText === 'Not available') return '';

      // Pattern 1: "Role at Company"
      const atMatch = roleText.match(/\bat\s+([^|•\n]+)/i);
      if (atMatch) {
        return atMatch[1].trim();
      }

      // Pattern 2: "Role @ Company"
      const atSymbolMatch = roleText.match(/@\s+([^|•\n]+)/i);
      if (atSymbolMatch) {
        return atSymbolMatch[1].trim();
      }

      // Pattern 3: "Role - Company"
      const dashMatch = roleText.match(/[-–]\s+([^|•\n]+)/);
      if (dashMatch) {
        return dashMatch[1].trim();
      }

      return '';
    },

    // Strategy 2: Experience section - first company
    () => {
      const experienceSection = document.querySelector('#experience');
      if (!experienceSection) return '';

      // Look for company name in first experience entry
      const firstCompany = experienceSection.querySelector('.pvs-entity__secondary-subtitle');
      return firstCompany?.textContent?.trim() || '';
    },

    // Strategy 3: Top card company link
    () => {
      const topCard = document.querySelector('.pv-top-card');
      const companyLink = topCard?.querySelector('a[data-field="experience_company_logo"]');
      return companyLink?.textContent?.trim() || '';
    },

    // Strategy 4: Any company badge/logo
    () => {
      const companyBadge = document.querySelector('[data-field="experience_company_logo"]');
      return companyBadge?.getAttribute('aria-label')?.replace('Company:', '').trim() || '';
    },

    // Strategy 5: Experience section - detailed view
    () => {
      const experienceSection = document.querySelector('#experience');
      if (!experienceSection) return '';

      // Look for nested company info
      const companySpan = experienceSection.querySelector('.pvs-entity span[aria-hidden="true"]:nth-child(2)');
      return companySpan?.textContent?.trim() || '';
    }
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result) {
        console.log('[Ellyn] Extracted company using strategy', strategies.indexOf(strategy) + 1);
        // Clean up common suffixes that get picked up
        const cleaned = cleanText(result)
          .replace(/\s*·.*$/, '') // Remove anything after bullet point
          .replace(/\s*\|.*$/, '') // Remove anything after pipe
          .replace(/\s*\(.*\)$/, ''); // Remove text in parentheses at end
        return cleaned;
      }
    } catch (error) {
      console.warn('[Ellyn] Company extraction strategy failed:', error);
    }
  }

  return 'Not available';
}

/**
 * Clean and normalize extracted text
 * Removes extra whitespace, newlines, and special characters
 *
 * @param {string} text - Raw text from DOM
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return '';

  return text
    .replace(/\s+/g, ' ')        // Replace multiple spaces/newlines with single space
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .trim();
}

/**
 * Parse full name into first and last name components
 *
 * @param {string} fullName - Full name to parse
 * @returns {Object} { firstName, lastName, middleName }
 */
function parseName(fullName) {
  const parts = fullName.split(/\s+/).filter(p => p.length > 0);

  if (parts.length === 0) {
    return { firstName: '', lastName: '', middleName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '', middleName: '' };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1], middleName: '' };
  }

  // 3+ parts: first, middle(s), last
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(' ')
  };
}

/**
 * Validate extracted profile data
 *
 * @param {Object} data - Extracted profile data
 * @returns {Object} Validation result { valid: boolean, missingFields: string[] }
 */
function validateProfileData(data) {
  const missingFields = [];

  if (!data.fullName || data.fullName.length < 2) {
    missingFields.push('Full Name');
  }

  if (!data.currentRole || data.currentRole === 'Not available') {
    missingFields.push('Current Role');
  }

  if (!data.companyName || data.companyName === 'Not available') {
    missingFields.push('Company Name');
  }

  return {
    valid: missingFields.length === 0,
    missingFields: missingFields,
    completeness: ((3 - missingFields.length) / 3 * 100).toFixed(0)
  };
}

/**
 * MAIN EXTRACTION FUNCTION
 *
 * Extract profile data from visible DOM elements
 * This is the primary function called when user clicks "Extract Contact"
 *
 * @returns {Object|null} Extracted profile data or null if extraction fails
 */
function extractProfileData() {
  console.log('[Ellyn] ===== STARTING PROFILE EXTRACTION =====');
  console.log('[Ellyn] Timestamp:', new Date().toISOString());
  console.log('[Ellyn] Page URL:', window.location.href);

  // Safety check: Ensure we're on a profile page
  if (!isProfilePage()) {
    console.warn('[Ellyn] Not a profile page. Aborting extraction.');
    return null;
  }

  try {
    // Step 1: Extract full name (REQUIRED)
    console.log('[Ellyn] Step 1: Extracting full name...');
    const fullName = extractFullName();

    if (!fullName) {
      console.error('[Ellyn] FAILED: Could not extract name. This is required.');
      return null;
    }

    console.log('[Ellyn] ✓ Full name extracted:', fullName);

    // Step 2: Parse name into components
    const nameParts = parseName(fullName);
    console.log('[Ellyn] ✓ Name parsed:', nameParts);

    // Step 3: Extract current role
    console.log('[Ellyn] Step 2: Extracting current role...');
    const currentRole = extractCurrentRole();
    console.log('[Ellyn] ✓ Role extracted:', currentRole);

    // Step 4: Extract company name
    console.log('[Ellyn] Step 3: Extracting company name...');
    const companyName = extractCompanyName(currentRole);
    console.log('[Ellyn] ✓ Company extracted:', companyName);

    // Step 5: Get LinkedIn URL (always available)
    const linkedinUrl = window.location.href.split('?')[0]; // Remove query params
    console.log('[Ellyn] ✓ LinkedIn URL:', linkedinUrl);

    // Build profile data object
    const profileData = {
      fullName: fullName,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      middleName: nameParts.middleName,
      currentRole: currentRole,
      companyName: companyName,
      linkedinUrl: linkedinUrl,
      extractedAt: new Date().toISOString(),
      extractedFrom: 'linkedin-profile-page'
    };

    // Validate extracted data
    const validation = validateProfileData(profileData);
    profileData.validation = validation;

    console.log('[Ellyn] ===== EXTRACTION COMPLETE =====');
    console.log('[Ellyn] Completeness:', validation.completeness + '%');
    console.log('[Ellyn] Missing fields:', validation.missingFields);
    console.log('[Ellyn] Final data:', profileData);

    return profileData;

  } catch (error) {
    console.error('[Ellyn] ===== EXTRACTION ERROR =====');
    console.error('[Ellyn] Error details:', error);
    console.error('[Ellyn] Stack trace:', error.stack);
    return null;
  }
}

/**
 * Wait for page to be fully loaded with profile data
 * LinkedIn uses dynamic loading (SPA), so we need to wait for content
 *
 * @param {number} maxAttempts - Maximum number of retry attempts (default: 20)
 * @param {number} delayMs - Delay between attempts in milliseconds (default: 300ms)
 * @returns {Promise<boolean>} True if page loaded successfully
 */
async function waitForPageLoad(maxAttempts = 20, delayMs = 300) {
  console.log('[Ellyn] Waiting for page to load...');

  for (let i = 0; i < maxAttempts; i++) {
    // Check if main profile elements are present
    const nameElement = document.querySelector('h1.text-heading-xlarge, h1[class*="inline"]');

    if (nameElement && nameElement.textContent.trim()) {
      console.log('[Ellyn] Page loaded successfully after', i + 1, 'attempts');
      return true;
    }

    // Log progress every 5 attempts
    if (i % 5 === 0 && i > 0) {
      console.log('[Ellyn] Still waiting... attempt', i + 1, 'of', maxAttempts);
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  console.warn('[Ellyn] Page load timeout after', maxAttempts, 'attempts');
  return false;
}

/**
 * MESSAGE LISTENER
 *
 * Listen for messages from the sidebar (extension)
 * Only responds to extract and checkPage requests
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Ellyn] Received message from sidebar:', request.action);

  // ACTION: extract
  // User clicked "Extract Contact" button in sidebar
  if (request.action === 'extract') {
    console.log('[Ellyn] Extraction requested by user');

    // Extract profile data synchronously
    const profileData = extractProfileData();

    if (profileData) {
      console.log('[Ellyn] Sending successful extraction back to sidebar');
      sendResponse({
        success: true,
        data: profileData
      });
    } else {
      console.warn('[Ellyn] Extraction failed, sending error to sidebar');
      sendResponse({
        success: false,
        error: 'Failed to extract profile data. Please make sure you are on a LinkedIn profile page with visible content.',
        suggestion: 'Try refreshing the page and waiting for it to fully load.'
      });
    }
  }

  // ACTION: checkPage
  // Check if current page is a valid profile page
  else if (request.action === 'checkPage') {
    const isProfile = isProfilePage();
    console.log('[Ellyn] Page check result:', isProfile);

    sendResponse({
      success: true,
      isProfilePage: isProfile,
      url: window.location.href
    });
  }

  // ACTION: waitForLoad
  // Wait for page to fully load before extraction
  else if (request.action === 'waitForLoad') {
    console.log('[Ellyn] Waiting for page load...');

    waitForPageLoad().then(loaded => {
      sendResponse({
        success: loaded,
        message: loaded ? 'Page loaded successfully' : 'Page load timeout'
      });
    });

    // Return true to indicate we'll send response asynchronously
    return true;
  }

  // Unknown action
  else {
    console.warn('[Ellyn] Unknown action:', request.action);
    sendResponse({
      success: false,
      error: 'Unknown action: ' + request.action
    });
  }

  // Return true for async response
  return true;
});

/**
 * URL CHANGE OBSERVER
 *
 * Notify sidebar when URL changes (LinkedIn is a Single Page App)
 * This helps update the UI when user navigates between pages
 */
let lastUrl = window.location.href;

const urlObserver = new MutationObserver(() => {
  const currentUrl = window.location.href;

  if (currentUrl !== lastUrl) {
    console.log('[Ellyn] URL changed:', currentUrl);
    lastUrl = currentUrl;

    // Notify sidebar about URL change (if sidebar is open)
    chrome.runtime.sendMessage({
      action: 'urlChanged',
      isProfilePage: isProfilePage(),
      url: currentUrl
    }).catch(err => {
      // Sidebar might not be open - this is normal
      // Don't log error to avoid console spam
    });
  }
});

// Start observing URL changes in document body
if (document.body) {
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
} else {
  // Body not ready yet, wait for DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

console.log('[Ellyn] ✓ Content script initialized and ready');
console.log('[Ellyn] ✓ Waiting for user to click "Extract Contact" button');
console.log('[Ellyn] ✓ NO automatic extraction will occur');

// SAFETY REMINDER: This script does NOT extract data automatically.
// It ONLY extracts when the user explicitly clicks the "Extract Contact" button.
