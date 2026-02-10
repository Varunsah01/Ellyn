/**
 * @typedef {Object} WaitOptions
 * @property {number} [timeout=6000] - Max wait time in ms
 * @property {number} [interval=300] - Polling interval in ms
 */

(function(window) {
  'use strict';

  /**
   * DomWaiter Utility
   * A robust utility for waiting for DOM elements in React-heavy applications (like LinkedIn).
   * Uses polling instead of MutationObservers for simplicity and reliability.
   */
  class DomWaiter {
    /**
     * Waits for an element matching the selector to appear in the DOM.
     * 
     * @param {string|string[]} selector - CSS selector(s) to wait for. If array, waits for ANY match.
     * @param {WaitOptions} [options] - Configuration options
     * @returns {Promise<boolean>} - Resolves to true if found, false if timed out. Never throws.
     */
    async waitFor(selector, options = {}) {
      try {
        const timeout = options.timeout || 6000;
        const interval = options.interval || 300;
        const startTime = Date.now();

        const selectors = Array.isArray(selector) ? selector : [selector];

        return new Promise((resolve) => {
          const check = () => {
            try {
              // Check if any selector matches
              for (const s of selectors) {
                if (document.querySelector(s)) {
                  resolve(true);
                  return;
                }
              }

              // Check timeout
              if (Date.now() - startTime >= timeout) {
                resolve(false);
                return;
              }

              // Schedule next check
              setTimeout(check, interval);
            } catch (err) {
              console.error('[DomWaiter] Error during check:', err);
              resolve(false);
            }
          };

          // Run first check immediately
          check();
        });
      } catch (error) {
        // Requirement: Never throw errors
        console.error('[DomWaiter] Unexpected error:', error);
        return false;
      }
    }

    /**
     * Waits for the LinkedIn profile name element specifically.
     * Uses a "minimum viable" readiness definition.
     * @returns {Promise<boolean>}
     */
    async waitForProfileReady() {
      // 1. Soft check: If we are already on a profile URL, we are "ready enough" to try
      if (window.location.pathname.startsWith('/in/')) {
        return true;
      }

      // 2. Broad selectors for minimum DOM viability
      // We accept any H1 or main layout containers
      const profileSelectors = [
        'h1', // Any heading
        '.scaffold-layout', // Main app wrapper
        '#profile-content', // Legacy container
        '.pv-text-details--left-aligned h1', // Specific
        '.text-heading-xlarge' // Specific
      ];
      
      return this.waitFor(profileSelectors);
    }
  }

  // Export to window
  window.EllynDomWaiter = new DomWaiter();

  /**
   * Example Usage:
   * 
   * const isReady = await window.EllynDomWaiter.waitFor('.pv-top-card');
   * if (isReady) {
   *   console.log('Profile loaded!');
   * } else {
   *   console.log('Timed out waiting for profile.');
   * }
   */

})(typeof window !== 'undefined' ? window : self);
