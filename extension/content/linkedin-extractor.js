// LinkedIn Profile Extractor - Content Script
// Extracts visible profile data from LinkedIn profile pages
// Only runs when explicitly triggered by user action (no auto-scraping)

(() => {
  'use strict';

  // Listen for extraction requests from the sidepanel via background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractProfile') {
      try {
        const data = extractProfileData();
        sendResponse({ success: true, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true; // Keep message channel open for async response
  });

  /**
   * Extract profile data from the current LinkedIn profile page
   * Uses multiple selector strategies for resilience
   */
  function extractProfileData() {
    if (!isProfilePage()) {
      throw new Error('Not on a LinkedIn profile page');
    }

    const fullName = extractName();
    const headline = extractHeadline();
    const { role, company } = parseHeadline(headline);
    const location = extractLocation();
    const profileUrl = window.location.href.split('?')[0];

    if (!fullName) {
      throw new Error('Could not extract profile name');
    }

    const nameParts = splitName(fullName);

    return {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      fullName,
      role: role || '',
      company: company || '',
      headline: headline || '',
      location: location || '',
      profileUrl,
      extractedAt: new Date().toISOString(),
    };
  }

  function isProfilePage() {
    return window.location.href.includes('linkedin.com/in/');
  }

  /**
   * Extract name using multiple selector strategies
   */
  function extractName() {
    const selectors = [
      'h1.text-heading-xlarge',
      'h1.inline.t-24',
      '.pv-text-details--left-aligned h1',
      'h1[class*="break-words"]',
      '.ph5 h1',
      'h1',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.innerText.trim();
        if (text && text.length > 1 && text.length < 100) {
          return text;
        }
      }
    }

    return null;
  }

  /**
   * Extract headline (usually "Role at Company")
   */
  function extractHeadline() {
    const selectors = [
      '.text-body-medium.break-words',
      '.pv-text-details--left-aligned .text-body-medium',
      'div.text-body-medium',
      '.ph5 .text-body-medium',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.innerText.trim();
        if (text && text.length > 1) {
          return text;
        }
      }
    }

    return null;
  }

  /**
   * Extract location
   */
  function extractLocation() {
    const selectors = [
      '.text-body-small.inline.t-black--light.break-words',
      '.pv-text-details--left-aligned .text-body-small',
      'span.text-body-small[class*="t-black--light"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.innerText.trim();
        if (text && text.length > 1) {
          return text;
        }
      }
    }

    return null;
  }

  /**
   * Parse headline into role and company
   * Handles formats like:
   *   "CEO at Acme Corp"
   *   "Software Engineer | Google"
   *   "VP of Sales - Salesforce"
   *   "Founder & CEO, TechStartup"
   */
  function parseHeadline(headline) {
    if (!headline) return { role: '', company: '' };

    // Try " at " separator first (most common)
    const atMatch = headline.match(/^(.+?)\s+at\s+(.+?)$/i);
    if (atMatch) {
      return { role: atMatch[1].trim(), company: atMatch[2].trim() };
    }

    // Try " | " separator
    const pipeMatch = headline.match(/^(.+?)\s*\|\s*(.+?)$/);
    if (pipeMatch) {
      return { role: pipeMatch[1].trim(), company: pipeMatch[2].trim() };
    }

    // Try " - " separator
    const dashMatch = headline.match(/^(.+?)\s+-\s+(.+?)$/);
    if (dashMatch) {
      return { role: dashMatch[1].trim(), company: dashMatch[2].trim() };
    }

    // Try ", " separator
    const commaMatch = headline.match(/^(.+?),\s+(.+?)$/);
    if (commaMatch) {
      return { role: commaMatch[1].trim(), company: commaMatch[2].trim() };
    }

    // Try to extract from experience section as fallback
    const experienceData = extractFromExperience();
    if (experienceData.role || experienceData.company) {
      return experienceData;
    }

    // Can't parse - return headline as role
    return { role: headline, company: '' };
  }

  /**
   * Try to extract role and company from the Experience section
   */
  function extractFromExperience() {
    // Look for the first experience item
    const expSelectors = [
      '#experience ~ .pvs-list__outer-container .pvs-entity__path-node + div',
      '[data-field="experience_company_logo"] + div',
      '.experience-group-position',
    ];

    let role = '';
    let company = '';

    // Try to find role from experience title
    const titleEl = document.querySelector(
      '#experience ~ div .t-bold span[aria-hidden="true"]'
    );
    if (titleEl) {
      role = titleEl.innerText.trim();
    }

    // Try to find company from experience subtitle
    const companyEl = document.querySelector(
      '#experience ~ div .t-14.t-normal span[aria-hidden="true"]'
    );
    if (companyEl) {
      const text = companyEl.innerText.trim();
      // Remove duration info like "Full-time" etc
      company = text.split('\u00B7')[0].trim();
    }

    return { role, company };
  }

  /**
   * Split full name into first and last name
   */
  function splitName(fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return { firstName: '', lastName: '' };
    }

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }

    // Handle credentials/suffixes like "PhD", "MBA", "Jr.", "III"
    const suffixes = ['phd', 'mba', 'md', 'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'cpa', 'esq'];
    const filtered = parts.filter(p => !suffixes.includes(p.toLowerCase()));

    if (filtered.length <= 1) {
      return { firstName: parts[0], lastName: parts[parts.length - 1] };
    }

    return {
      firstName: filtered[0],
      lastName: filtered.slice(1).join(' '),
    };
  }

  console.log('[Ellyn] LinkedIn extractor loaded');
})();
