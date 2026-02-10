// LinkedIn Profile Extractor - Content Script
// Extracts visible profile data from LinkedIn profile pages
// Only runs when explicitly triggered by user action (no auto-scraping)
// RELIES ON: utils/name-normalizer.js, utils/email-inference.js, utils/dom-waiter.js, utils/page-detector.js, utils/confidence-engine.js, extractors/name-extractor.js, utils/workflow-orchestrator.js

(() => {
  'use strict';

  // Listen for extraction requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractProfile') {
      extractProfileWithRetry()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message, diagnostics: error.diagnostics }));
      return true; // Async response
    }

    if (message.action === 'runOrchestrator') {
      if (window.EllynWorkflowOrchestrator) {
        window.EllynWorkflowOrchestrator.run()
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ status: 'blocked', error: error.message }));
      } else {
        sendResponse({ status: 'blocked', error: 'Orchestrator not loaded' });
      }
      return true;
    }
  });

  /**
   * Orchestrate extraction with retry logic
   */
  async function extractProfileWithRetry() {
    if (!window.location.href.includes('linkedin.com/in/')) {
      throw new Error('Not on a LinkedIn profile page');
    }

    // Use shared DOM Waiter utility
    if (window.EllynDomWaiter) {
      const isReady = await window.EllynDomWaiter.waitForProfileReady();
      if (!isReady) {
        throw new Error('Profile loading timed out. Please try again.');
      }
    } else {
      // Fallback if utility not loaded (should not happen)
      console.warn('EllynDomWaiter not found, attempting immediate extraction');
    }

    const diagnostics = {
      url: window.location.href,
      selectorsTried: [],
      rawTexts: {},
      timestamp: new Date().toISOString()
    };

    try {
      return extractProfileData(diagnostics);
    } catch (error) {
      error.diagnostics = diagnostics;
      throw error;
    }
  }

  /**
   * Main extraction logic
   */
  function extractProfileData(diagnostics) {
    // 1. Extract Name (Robust)
    const nameData = extractNameRobust(diagnostics);
    
    if (!nameData || !nameData.fullName || nameData.confidence < 50) {
      throw new Error('Name extraction failed or low confidence');
    }

    // 2. Extract Headline & Role/Company
    const headline = extractHeadline();
    const { role, company } = parseHeadline(headline);

    // 3. Location
    const location = extractLocation();
    
    // 4. Email Inference (Safe, Local)
    let inferredEmail = null;
    if (window.EllynEmailInference && nameData.confidence >= 80 && nameData.lastName && company) {
      const patterns = window.EllynEmailInference.generatePatterns({
        firstName: nameData.firstName,
        lastName: nameData.lastName,
        company: company
      });
      if (patterns.length > 0) {
        inferredEmail = patterns[0].email; // Top candidate
      }
    }

    return {
      firstName: nameData.firstName,
      lastName: nameData.lastName,
      fullName: nameData.fullName,
      rawName: nameData.rawName, // For debugging/diagnostics
      role: role || '',
      company: company || '',
      headline: headline || '',
      location: location || '',
      profileUrl: window.location.href.split('?')[0],
      inferredEmail: inferredEmail,
      extractedAt: new Date().toISOString(),
      confidence: nameData.confidence
    };
  }

  /**
   * Robust Name Extraction Pipeline
   * Strict selector order + Text Node traversal + Normalization
   */
  function extractNameRobust(diagnostics) {
    const selectors = [
      'h1.text-heading-xlarge',
      '.text-heading-xlarge', // Often applied directly to H1
      '.pv-text-details--left-aligned h1',
      'h1.inline.t-24',
      'h1'
    ];

    diagnostics.selectorsTried = selectors;

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;

      // Extract text from text nodes only (avoids hidden/nested garbage if possible)
      // We assume the name is in text nodes of H1 or its direct children
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      let rawText = '';
      let node;
      while (node = walker.nextNode()) {
        rawText += node.textContent;
      }
      
      // If we got nothing, try innerText as fallback but likely unsafe
      if (!rawText.trim()) {
        rawText = el.innerText;
      }

      diagnostics.rawTexts[selector] = rawText;

      // Normalize
      if (window.EllynNameNormalizer) {
        const normalized = window.EllynNameNormalizer.normalizeName(rawText);
        if (normalized.confidence > 0 && normalized.fullName) {
          return normalized;
        }
      } else {
        // Fallback if normalizer missing (should not happen with correct injection)
        console.warn('EllynNameNormalizer not found');
        return {
          firstName: rawText.split(' ')[0],
          lastName: rawText.split(' ').slice(1).join(' '),
          fullName: rawText.trim(),
          rawName: rawText,
          confidence: 50 // unsure
        };
      }
    }

    return null;
  }

  /**
   * Extract headline
   */
  function extractHeadline() {
    const selectors = [
      '.text-body-medium.break-words',
      '[data-generated-suggestion-target]', // Often the headline
      '.pv-text-details--left-aligned .text-body-medium'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.innerText.trim();
    }
    return '';
  }

  /**
   * Parse headline into role and company
   */
  function parseHeadline(headline) {
    if (!headline) return { role: '', company: '' };

    // Common separators: " at ", " | ", " - ", " @ "
    const separators = [
      /\s+at\s+/i,
      /\s*\|\s*/,
      /\s+-\s+/,
      /\s+@\s+/
    ];

    for (const sep of separators) {
      const parts = headline.split(sep);
      if (parts.length >= 2) {
        return { 
          role: parts[0].trim(), 
          company: parts.slice(1).join(' ').trim() // Join rest in case of multiple separators
        };
      }
    }
    
    // Fallback: Check experience section
    // (Simplified for robustness - rely on headline first)
    return { role: headline, company: '' };
  }

  /**
   * Extract location
   */
  function extractLocation() {
    const selectors = [
      '.text-body-small.inline.t-black--light.break-words',
      '.pv-text-details--left-aligned .text-body-small',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.innerText.trim();
    }
    return '';
  }

  console.log('[Ellyn] LinkedIn extractor (hardened) loaded');
})();