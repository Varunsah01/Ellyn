/**
 * @typedef {Object} ExtractionResult
 * @property {string|null} value - The extracted name
 * @property {number} confidence - Confidence score (0-100)
 * @property {"dom" | "fallback" | "meta"} source - Source of extraction
 * @property {string} [debug] - Debug info (selector used)
 */

(function(window) {
  'use strict';

  /**
   * NameExtractor
   * Defensive extraction utility for LinkedIn profile names.
   * Uses multiple strategies to handle DOM volatility.
   */
  class NameExtractor {
    constructor() {
      // Ordered strategies with assigned confidence levels
      this.strategies = [
        {
          name: 'h1-xlarge',
          selector: 'h1.text-heading-xlarge',
          confidence: 95,
          type: 'dom'
        },
        {
          name: 'h1-details-left',
          selector: '.pv-text-details--left-aligned h1',
          confidence: 90,
          type: 'dom'
        },
        {
          name: 'h1-inline-24',
          selector: 'h1.inline.t-24',
          confidence: 85,
          type: 'dom'
        },
        {
          name: 'h1-generic',
          selector: 'h1',
          confidence: 70, // Risky, could be other headings
          type: 'dom'
        }
      ];
    }

    /**
     * Extract name from the given document context
     * @param {Document|Element} context - DOM context (usually document)
     * @returns {ExtractionResult}
     */
    extract(context = document) {
      try {
        // 1. Try DOM selectors (High Fidelity)
        for (const strategy of this.strategies) {
          try {
            const element = context.querySelector(strategy.selector);
            if (element) {
              // Extract text cleanly (ignoring hidden children if possible)
              const rawText = this._getTextContent(element);
              const cleaned = this._cleanText(rawText);

              if (this._isValidName(cleaned)) {
                return {
                  value: cleaned,
                  confidence: strategy.confidence,
                  source: strategy.type,
                  debug: strategy.name
                };
              }
            }
          } catch (e) {
            // Ignore selector errors
            console.warn(`[NameExtractor] Strategy ${strategy.name} failed:`, e);
          }
        }

        // 2. Try Meta Tags (Fallback)
        // <meta property="og:title" content="John Doe | LinkedIn">
        const metaTitle = context.querySelector('meta[property="og:title"]');
        if (metaTitle && metaTitle.content) {
          const cleaned = this._cleanTitle(metaTitle.content);
          if (this._isValidName(cleaned)) {
            return {
              value: cleaned,
              confidence: 60, // Lower because of parsing risk
              source: 'meta',
              debug: 'og:title'
            };
          }
        }

        // 3. Try Document Title (Last Resort)
        if (context.title) {
          const cleaned = this._cleanTitle(context.title);
          if (this._isValidName(cleaned)) {
            return {
              value: cleaned,
              confidence: 50,
              source: 'fallback',
              debug: 'document.title'
            };
          }
        }

        return {
          value: null,
          confidence: 0,
          source: 'fallback'
        };

      } catch (error) {
        console.error('[NameExtractor] Fatal error:', error);
        return {
          value: null,
          confidence: 0,
          source: 'fallback'
        };
      }
    }

    /**
     * Get text content, preferring direct text nodes to avoid hidden noise
     */
    _getTextContent(element) {
      if (!element) return '';
      
      // Try TreeWalker to get visible text nodes
      try {
        let text = '';
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
          text += node.textContent;
        }
        return text.trim() || element.innerText;
      } catch (e) {
        return element.innerText || element.textContent || '';
      }
    }

    /**
     * Normalize text using EllynNameNormalizer if available, or basic trimming
     */
    _cleanText(text) {
      if (!text) return '';
      
      if (window.EllynNameNormalizer) {
        const result = window.EllynNameNormalizer.normalizeName(text);
        if (result && result.fullName) {
          return result.fullName;
        }
      }
      
      // Basic fallback cleaning
      return text.replace(/\s+/g, ' ').trim();
    }

    /**
     * Clean "Name | LinkedIn" formatted strings
     */
    _cleanTitle(text) {
      if (!text) return '';
      // Remove " | LinkedIn" and other suffixes
      let clean = text.replace(/ \| LinkedIn.*/, '');
      // Remove notification counts "(1) Name"
      clean = clean.replace(/^\(\d+\)\s*/, '');
      return this._cleanText(clean);
    }

    /**
     * Basic validation
     */
    _isValidName(name) {
      if (!name) return false;
      // Must have at least 2 chars, not be a URL
      return name.length >= 2 && !name.includes('http');
    }
  }

  // Export to window
  window.EllynNameExtractor = new NameExtractor();

})(typeof window !== 'undefined' ? window : self);
