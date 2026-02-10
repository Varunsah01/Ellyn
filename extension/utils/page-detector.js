/**
 * @typedef {Object} EligibilityResult
 * @property {boolean} eligible - Whether the page is an eligible LinkedIn profile
 * @property {"NOT_PROFILE_PAGE" | "UNSUPPORTED_CONTEXT"} [reason] - Reason for ineligibility
 */

(function(global) {
  'use strict';

  /**
   * PageDetector Utility
   * Detects if the current page is a full LinkedIn profile page.
   * Strictly follows project requirements: No LinkedIn APIs, No DOM scraping.
   */
  class PageDetector {
    /**
     * Detects if the current page is an eligible LinkedIn profile page.
     * Eligible only if URL pathname starts with "/in/".
     * 
     * @param {string} urlString - The URL to check
     * @returns {EligibilityResult}
     */
    detectEligibility(urlString) {
      try {
        if (!urlString || typeof urlString !== 'string') {
          return { 
            eligible: false, 
            reason: 'UNSUPPORTED_CONTEXT' 
          };
        }

        // URL parsing handles protocol, hostname, and pathname safely
        const url = new URL(urlString);
        const hostname = url.hostname.toLowerCase();
        const pathname = url.pathname;

        // 1. Context Check: Must be LinkedIn
        // We support both www.linkedin.com and the base domain.
        const isLinkedIn = hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
        
        if (!isLinkedIn) {
          return { 
            eligible: false, 
            reason: 'UNSUPPORTED_CONTEXT' 
          };
        }

        // 2. Profile Check: Pathname must start with /in/
        // Per requirements: "Eligible only if URL pathname starts with '/in/'"
        // Standard LinkedIn profiles follow: https://www.linkedin.com/in/username/
        if (pathname.startsWith('/in/')) {
          return { 
            eligible: true 
          };
        }

        // It is LinkedIn, but not a profile page (e.g., /feed, /jobs, /company)
        return { 
          eligible: false, 
          reason: 'NOT_PROFILE_PAGE' 
        };

      } catch (error) {
        // Requirement: Must NOT throw errors.
        // Catching invalid URL strings or unexpected edge cases.
        return { 
          eligible: false, 
          reason: 'UNSUPPORTED_CONTEXT' 
        };
      }
    }
  }

  // Export to global scope as a singleton instance
  global.EllynPageDetector = new PageDetector();

})(typeof window !== 'undefined' ? window : self);
