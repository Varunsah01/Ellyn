/**
 * LinkedIn company-page URL extractor for profile pages.
 * Browser-only utility used by the extension content script.
 *
 * Example:
 * const extractor = new LinkedInCompanyExtractor(true);
 * const companyData = extractor.extractCompanyWebsite("Microsoft");
 * console.log(companyData);
 */

class LinkedInCompanyExtractor {
  constructor(debugMode = false) {
    this.debugMode = Boolean(debugMode);
  }

  log(message, data) {
    if (!this.debugMode) return;
    if (typeof data === 'undefined') {
      console.log(`[Company Extractor] ${message}`);
      return;
    }
    console.log(`[Company Extractor] ${message}`, data);
  }

  /**
   * Attempts to extract a LinkedIn company page URL from the active profile DOM.
   * @param {string} companyName
   * @returns {{companyName: string, companyPageUrl: string|null, extractionMethod: string, confidence: number, isCurrent: boolean}}
   */
  extractCompanyWebsite(companyName) {
    const safeCompanyName = String(companyName || '').trim();
    this.log('Starting company website extraction', { companyName: safeCompanyName });

    try {
      const fromExperience = this.extractFromExperienceSection();
      if (fromExperience?.companyPageUrl) {
        return fromExperience;
      }
    } catch (error) {
      this.log('Experience-section strategy failed', { error: error?.message || String(error) });
    }

    try {
      const fromTopCard = this.extractFromTopCard();
      if (fromTopCard?.companyPageUrl) {
        return fromTopCard;
      }
    } catch (error) {
      this.log('Top-card strategy failed', { error: error?.message || String(error) });
    }

    try {
      const fromFeatured = this.extractFromFeaturedSection();
      if (fromFeatured?.companyPageUrl) {
        return fromFeatured;
      }
    } catch (error) {
      this.log('Featured/about strategy failed', { error: error?.message || String(error) });
    }

    this.log('No LinkedIn company URL found in profile');
    return {
      companyName: safeCompanyName,
      companyPageUrl: null,
      extractionMethod: 'not-found',
      confidence: 0,
      isCurrent: false,
    };
  }

  /**
   * Strategy 1: scan Experience section for company links.
   * @returns {{companyName: string, companyPageUrl: string|null, extractionMethod: string, confidence: number, isCurrent: boolean}|null}
   */
  extractFromExperienceSection() {
    const experienceSection = document.querySelector('#experience');
    if (!experienceSection) {
      this.log('Experience section not found');
      return null;
    }

    const links = Array.from(experienceSection.querySelectorAll('a[href*="/company/"]'));
    if (links.length === 0) {
      this.log('No company links found in experience section');
      return null;
    }

    let selected = links[0] || null;
    let isCurrent = false;

    for (const link of links) {
      const current = this.isCurrentPosition(link);
      if (current) {
        selected = link;
        isCurrent = true;
        break;
      }
    }

    if (!selected) {
      return null;
    }

    const companyPageUrl = this.normalizeLinkedInCompanyUrl(selected.getAttribute('href'));
    const extractedName = this.cleanText(selected.textContent || '');
    const confidence = isCurrent ? 0.9 : 0.85;

    this.log('Found company link in experience section', {
      companyPageUrl,
      extractedName,
      isCurrent,
      confidence,
    });

    return {
      companyName: extractedName || '',
      companyPageUrl,
      extractionMethod: 'experience-section',
      confidence,
      isCurrent,
    };
  }

  /**
   * Strategy 2: scan top card right panel for company links.
   * @returns {{companyName: string, companyPageUrl: string|null, extractionMethod: string, confidence: number, isCurrent: boolean}|null}
   */
  extractFromTopCard() {
    const topCardPanel =
      document.querySelector('.pv-text-details__right-panel') ||
      document.querySelector('[class*="pv-text-details__right-panel"]');

    if (!topCardPanel) {
      this.log('Top-card right panel not found');
      return null;
    }

    const link = topCardPanel.querySelector('a[href*="/company/"]');
    if (!link) {
      this.log('No company link found in top card');
      return null;
    }

    const companyPageUrl = this.normalizeLinkedInCompanyUrl(link.getAttribute('href'));
    const extractedName = this.cleanText(link.textContent || '');

    this.log('Found company link in top card', { companyPageUrl, extractedName });

    return {
      companyName: extractedName || '',
      companyPageUrl,
      extractionMethod: 'top-card',
      confidence: 0.92,
      isCurrent: true,
    };
  }

  /**
   * Strategy 3: scan about/featured section for company links.
   * @returns {{companyName: string, companyPageUrl: string|null, extractionMethod: string, confidence: number, isCurrent: boolean}|null}
   */
  extractFromFeaturedSection() {
    const aboutSection = document.querySelector('#about');
    if (!aboutSection) {
      this.log('About section not found');
      return null;
    }

    const link = aboutSection.querySelector('a[href*="/company/"]');
    if (!link) {
      this.log('No company link found in about section');
      return null;
    }

    const companyPageUrl = this.normalizeLinkedInCompanyUrl(link.getAttribute('href'));
    const extractedName = this.cleanText(link.textContent || '');

    this.log('Found company link in about section', { companyPageUrl, extractedName });

    return {
      companyName: extractedName || '',
      companyPageUrl,
      extractionMethod: 'about-section',
      confidence: 0.8,
      isCurrent: false,
    };
  }

  /**
   * Returns true when the nearest experience entity appears to be current.
   * @param {Element} element
   * @returns {boolean}
   */
  isCurrentPosition(element) {
    try {
      if (!element || !(element instanceof Element)) return false;
      const entity = element.closest('.pvs-entity') || element.closest('li');
      if (!entity) return false;
      const text = this.cleanText(entity.textContent || '').toLowerCase();
      return text.includes('present') || text.includes('current');
    } catch (error) {
      this.log('Failed to determine current position flag', { error: error?.message || String(error) });
      return false;
    }
  }

  cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeLinkedInCompanyUrl(href) {
    const raw = String(href || '').trim();
    if (!raw) return null;

    try {
      const absolute = raw.startsWith('http') ? raw : new URL(raw, window.location.origin).toString();
      const parsed = new URL(absolute);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return null;
    }
  }

  /**
   * Parses LinkedIn company-page HTML and extracts external company website URL/domain.
   * Returns highest-confidence match across all strategies.
   *
   * @param {string} html
   * @returns {{domain: string, websiteUrl: string, source: string, confidence: number}|null}
   */
  static parseCompanyPageHtml(html) {
    if (!html || typeof html !== 'string') return null;

    const results = [];

    const toDomain = (urlValue) => {
      try {
        const parsed = new URL(urlValue);
        const domain = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        return domain || null;
      } catch {
        return null;
      }
    };

    const isLinkedInUrl = (urlValue) => /linkedin\.com/i.test(String(urlValue || ''));

    try {
      const websiteAnchorRegex =
        /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*data-tracking-control-name="[^"]*website[^"]*"/gi;
      for (const match of html.matchAll(websiteAnchorRegex)) {
        const websiteUrl = String(match[1] || '').trim();
        if (!websiteUrl || isLinkedInUrl(websiteUrl)) continue;
        const domain = toDomain(websiteUrl);
        if (!domain) continue;
        results.push({
          domain,
          websiteUrl,
          source: 'linkedin-website-anchor',
          confidence: 0.95,
        });
      }
    } catch {
      // Continue with fallback strategies.
    }

    try {
      const jsonLdRegex = /<script type="application\/ld\+json">(.+?)<\/script>/gis;
      for (const match of html.matchAll(jsonLdRegex)) {
        const raw = String(match[1] || '').trim();
        if (!raw) continue;

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }

        const candidates = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of candidates) {
          const itemType = String(item?.['@type'] || '').toLowerCase();
          if (itemType !== 'organization') continue;
          const websiteUrl = String(item?.url || '').trim();
          if (!websiteUrl || isLinkedInUrl(websiteUrl)) continue;
          const domain = toDomain(websiteUrl);
          if (!domain) continue;

          results.push({
            domain,
            websiteUrl,
            source: 'json-ld',
            confidence: 0.92,
          });
        }
      }
    } catch {
      // Continue with fallback strategies.
    }

    try {
      const ogRegex = /<meta property="og:url" content="(https?:\/\/[^"]+)"/i;
      const ogMatch = html.match(ogRegex);
      if (ogMatch?.[1]) {
        const websiteUrl = String(ogMatch[1]).trim();
        if (websiteUrl && !isLinkedInUrl(websiteUrl)) {
          const domain = toDomain(websiteUrl);
          if (domain) {
            results.push({
              domain,
              websiteUrl,
              source: 'open-graph',
              confidence: 0.85,
            });
          }
        }
      }
    } catch {
      // Continue with fallback strategies.
    }

    try {
      const canonicalRegex = /<link rel="canonical" href="(https?:\/\/[^"]+)"/i;
      const canonicalMatch = html.match(canonicalRegex);
      if (canonicalMatch?.[1]) {
        const websiteUrl = String(canonicalMatch[1]).trim();
        if (websiteUrl && !isLinkedInUrl(websiteUrl)) {
          const domain = toDomain(websiteUrl);
          if (domain) {
            results.push({
              domain,
              websiteUrl,
              source: 'canonical',
              confidence: 0.8,
            });
          }
        }
      }
    } catch {
      // Final fallback already handled.
    }

    if (results.length === 0) {
      return null;
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results[0];
  }
}

if (typeof window !== 'undefined') {
  window.LinkedInCompanyExtractor = LinkedInCompanyExtractor;
}
