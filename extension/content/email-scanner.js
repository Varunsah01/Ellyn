/**
 * email-scanner.js
 *
 * Ellyn Email Scanner - On-demand LinkedIn profile email discovery.
 *
 * This script performs NO action on page load.
 * All DOM access is strictly on-demand, triggered only when the user
 * clicks "Find Email" in the Ellyn side panel (via SCAN_EMAILS message).
 * No user data is stored, transmitted, or processed without explicit user action.
 *
 * Scans visible, publicly accessible LinkedIn profile sections for
 * email addresses that the profile owner has voluntarily made visible.
 */

'use strict';

class ProfileEmailScanner {
  constructor() {
    // Intentionally empty: no DOM access at construction time.
  }

  log(...args) {
    console.log('[EmailScanner]', ...args);
  }

  isValidProfileContext() {
    try {
      return /linkedin\.com\/(in|posts|pulse|activity)\//i.test(window.location.href);
    } catch (error) {
      this.log('Profile context check failed:', error?.message || String(error));
      return false;
    }
  }

  isValidScannedEmail(email) {
    if (!email || typeof email !== 'string') return false;

    const e = email.toLowerCase().trim();

    if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(e)) return false;
    if (/@(linkedin\.com|licdn\.com|lnkd\.in)$/i.test(e)) return false;
    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|json|pdf|mp4|woff|ttf)$/i.test(e)) return false;
    if (/^(example|test|noreply|no-reply|donotreply|admin|info|support|hello|hi|contact|mail|email|user|name|placeholder)@/.test(e)) return false;
    if (/\.{2,}/.test(e)) return false;

    const [local, domain] = e.split('@');
    if (!local || local.startsWith('.') || local.endsWith('.')) return false;
    if (!domain || !domain.includes('.')) return false;
    if (local.length < 2) return false;
    if (e.length > 254) return false;

    return true;
  }

  extractEmailsFromText(text) {
    if (!text || typeof text !== 'string') return [];

    const matches = text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi) || [];
    const cleaned = matches
      .map((candidate) =>
        String(candidate || '')
          .trim()
          .replace(/^mailto:/i, '')
          .replace(/^[<(["']+/, '')
          .replace(/[>)\]"',;:!?]+$/, '')
          .toLowerCase()
      )
      .filter(Boolean);

    return cleaned.filter((email) => this.isValidScannedEmail(email));
  }

  getUniqueElements(selectors) {
    const unique = [];
    const seen = new Set();

    for (const selector of selectors) {
      try {
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
          if (!seen.has(node)) {
            seen.add(node);
            unique.push(node);
          }
        }
      } catch (error) {
        this.log(`Selector failed (${selector}):`, error?.message || String(error));
      }
    }

    return unique;
  }

  scanSection(elements, sourceName, confidence) {
    const results = [];

    for (const element of elements || []) {
      try {
        if (!element || !element.textContent) continue;

        const tagName = String(element.tagName || '').toLowerCase();
        if (['script', 'style', 'meta', 'head', 'noscript'].includes(tagName)) continue;

        const emails = this.extractEmailsFromText(element.textContent);
        for (const email of emails) {
          results.push({ email, source: sourceName, confidence });
        }
      } catch (error) {
        this.log(`Section scan element failed (${sourceName}):`, error?.message || String(error));
      }
    }

    return results;
  }

  scanContactInfo() {
    try {
      this.log('Scanning section: contact-info');
      const elements = this.getUniqueElements([
        'div[id*="contact-info"]',
        'section[aria-label*="Contact"]',
        'div[class*="pv-contact-info"]',
        'div[class*="ci-email"]',
      ]);
      return this.scanSection(elements, 'contact-info', 0.95);
    } catch (error) {
      this.log('Contact info scan failed:', error?.message || String(error));
      return [];
    }
  }

  scanAboutSection() {
    try {
      this.log('Scanning section: about-section');
      const elements = this.getUniqueElements([
        'section[id*="about"]',
        'div[id*="about"]',
        'section[aria-label*="About"]',
      ]);
      return this.scanSection(elements, 'about-section', 0.85);
    } catch (error) {
      this.log('About section scan failed:', error?.message || String(error));
      return [];
    }
  }

  scanFeaturedSection() {
    try {
      this.log('Scanning section: featured-section');
      const elements = this.getUniqueElements([
        'section[id*="featured"]',
        'section[aria-label*="Featured"]',
      ]);
      return this.scanSection(elements, 'featured-section', 0.8);
    } catch (error) {
      this.log('Featured section scan failed:', error?.message || String(error));
      return [];
    }
  }

  scanOwnPosts() {
    try {
      this.log('Scanning section: own-post');
      const elements = this.getUniqueElements([
        'div[data-urn*="activity"]',
        'div[class*="feed-shared-update-v2"]',
        'article[class*="feed-shared"]',
      ]);
      return this.scanSection(elements, 'own-post', 0.75);
    } catch (error) {
      this.log('Own posts scan failed:', error?.message || String(error));
      return [];
    }
  }

  scanOwnComments() {
    try {
      this.log('Scanning section: own-comment');
      const profileSlug = window.location.pathname
        .replace(/^\/in\//, '')
        .replace(/\/$/, '')
        .split('/')[0];

      if (!profileSlug) {
        this.log('No profile slug found; skipping own comments scan.');
        return [];
      }

      const commentNodes = this.getUniqueElements([
        'article[class*="comments-comment-item"]',
        'div[class*="comments-comment-entity"]',
      ]);

      const ownComments = commentNodes.filter((commentEl) => {
        try {
          const authorLink = commentEl.querySelector('a[href*="/in/"]');
          const isOwnComment = authorLink?.href?.includes(profileSlug);
          return Boolean(isOwnComment);
        } catch {
          return false;
        }
      });

      return this.scanSection(ownComments, 'own-comment', 0.7);
    } catch (error) {
      this.log('Own comments scan failed:', error?.message || String(error));
      return [];
    }
  }

  scanMainFallback() {
    try {
      this.log('Scanning section: main-fallback');
      const main = document.querySelector('main');
      if (!main) return [];

      const sections = Array.from(main.querySelectorAll(':scope > section')).slice(0, 3);
      return this.scanSection(sections, 'main-fallback', 0.6);
    } catch (error) {
      this.log('Main fallback scan failed:', error?.message || String(error));
      return [];
    }
  }

  deduplicateByHighestConfidence(enriched) {
    const deduped = new Map();

    for (const item of enriched || []) {
      if (!item || typeof item.email !== 'string') continue;
      const normalized = item.email.trim().toLowerCase();
      if (!this.isValidScannedEmail(normalized)) continue;

      const existing = deduped.get(normalized);
      if (!existing || Number(item.confidence || 0) > Number(existing.confidence || 0)) {
        deduped.set(normalized, {
          email: normalized,
          source: item.source,
          confidence: item.confidence,
        });
      }
    }

    return Array.from(deduped.values()).sort((a, b) => {
      const confidenceDelta = Number(b.confidence || 0) - Number(a.confidence || 0);
      if (confidenceDelta !== 0) return confidenceDelta;
      return String(a.email).localeCompare(String(b.email));
    });
  }

  scanForEmails() {
    const scannedAt = new Date().toISOString();
    const pageUrl = window.location.href;

    try {
      this.log('Scan requested for:', pageUrl);

      if (!this.isValidProfileContext()) {
        this.log('Skipped scan: URL is outside supported LinkedIn contexts.');
        return {
          emails: [],
          enriched: [],
          scannedAt,
          pageUrl,
        };
      }

      const collected = [];

      collected.push(...this.scanContactInfo());
      collected.push(...this.scanAboutSection());
      collected.push(...this.scanFeaturedSection());
      collected.push(...this.scanOwnPosts());
      collected.push(...this.scanOwnComments());
      collected.push(...this.scanMainFallback());

      const enriched = this.deduplicateByHighestConfidence(collected);
      const emails = enriched.map((entry) => entry.email);

      this.log(`Scan complete. ${emails.length} unique email(s) found.`);

      return {
        emails,
        enriched,
        scannedAt,
        pageUrl,
      };
    } catch (error) {
      const message = error?.message || String(error);
      this.log('Scan failed:', message);
      return {
        emails: [],
        enriched: [],
        scannedAt,
        pageUrl,
        error: message,
      };
    }
  }
}

window.ProfileEmailScanner = ProfileEmailScanner;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'SCAN_EMAILS') return;

  let responded = false;
  const safeRespond = (payload) => {
    if (responded) return;
    responded = true;
    sendResponse(payload);
  };

  try {
    console.log('[EmailScanner] SCAN_EMAILS message received');
    const scanner = new ProfileEmailScanner();
    const result = scanner.scanForEmails();

    if (result && Array.isArray(result.emails) && Array.isArray(result.enriched)) {
      safeRespond(result);
    } else {
      safeRespond({
        emails: [],
        enriched: [],
        scannedAt: new Date().toISOString(),
        pageUrl: window.location.href,
      });
    }
  } catch (error) {
    const messageText = error?.message || String(error);
    console.log('[EmailScanner] Message handler failed:', messageText);
    safeRespond({
      emails: [],
      enriched: [],
      scannedAt: new Date().toISOString(),
      pageUrl: window.location.href,
      error: messageText,
    });
  }

  return true;
});

console.log('[EmailScanner] Ready (on-demand only)');
