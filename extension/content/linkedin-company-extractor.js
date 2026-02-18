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
      const fromExperience = this.extractFromExperienceSection(safeCompanyName);
      if (fromExperience?.companyPageUrl) {
        return fromExperience;
      }
    } catch (error) {
      this.log('Experience-section strategy failed', { error: error?.message || String(error) });
    }

    try {
      const fromTopCard = this.extractFromTopCard(safeCompanyName);
      if (fromTopCard?.companyPageUrl) {
        return fromTopCard;
      }
    } catch (error) {
      this.log('Top-card strategy failed', { error: error?.message || String(error) });
    }

    try {
      const fromFeatured = this.extractFromFeaturedSection(safeCompanyName);
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
  extractFromExperienceSection(companyName = '') {
    const experienceSection = this.getExperienceSection();
    if (!experienceSection) {
      this.log('Experience section not found');
      return null;
    }

    const links = Array.from(experienceSection.querySelectorAll('a[href*="/company/"]'));
    if (links.length === 0) {
      this.log('No company links found in experience section');
      return null;
    }

    const candidates = [];
    for (const link of links) {
      const companyPageUrl = this.normalizeLinkedInCompanyUrl(link.getAttribute('href'));
      if (!companyPageUrl) continue;

      const extractedName = this.cleanText(link.textContent || '');
      const slug = this.getCompanySlugFromUrl(companyPageUrl);
      const matchScore = this.getCompanyMatchScore(companyName, `${extractedName} ${slug}`.trim());
      const isCurrent = this.isCurrentPosition(link);
      const score = (isCurrent ? 4 : 2) + matchScore;

      candidates.push({
        companyPageUrl,
        extractedName,
        isCurrent,
        matchScore,
        score,
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates[0];

    if (String(companyName || '').trim() && Number(selected?.matchScore || 0) < 2) {
      this.log('Experience candidates did not match company name strongly', {
        companyName,
        topCandidate: selected,
      });
      return null;
    }

    const confidence = selected.isCurrent ? 0.92 : 0.84;

    this.log('Found company link in experience section', {
      companyPageUrl: selected.companyPageUrl,
      extractedName: selected.extractedName,
      isCurrent: selected.isCurrent,
      matchScore: selected.matchScore,
      confidence,
    });

    return {
      companyName: selected.extractedName || companyName || '',
      companyPageUrl: selected.companyPageUrl,
      extractionMethod: 'experience-section',
      confidence,
      isCurrent: selected.isCurrent,
    };
  }

  /**
   * Strategy 2: scan top card right panel for company links.
   * @returns {{companyName: string, companyPageUrl: string|null, extractionMethod: string, confidence: number, isCurrent: boolean}|null}
   */
  extractFromTopCard(companyName = '') {
    const introRoot = this.getProfileIntroRoot();
    if (!introRoot) {
      this.log('Top-card root not found');
      return null;
    }

    const links = Array.from(introRoot.querySelectorAll('a[href*="/company/"]'));
    if (links.length === 0) {
      this.log('No company link found in top card');
      return null;
    }

    const candidates = [];
    for (const link of links) {
      const companyPageUrl = this.normalizeLinkedInCompanyUrl(link.getAttribute('href'));
      if (!companyPageUrl) continue;
      const extractedName = this.cleanText(link.textContent || '');
      const slug = this.getCompanySlugFromUrl(companyPageUrl);
      const matchScore = this.getCompanyMatchScore(companyName, `${extractedName} ${slug}`.trim());
      candidates.push({
        companyPageUrl,
        extractedName,
        matchScore,
        score: 2 + matchScore,
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    const selected = candidates[0];
    if (String(companyName || '').trim() && Number(selected?.matchScore || 0) < 2) {
      this.log('Top-card candidates did not match company name strongly', {
        companyName,
        topCandidate: selected,
      });
      return null;
    }

    this.log('Found company link in top card', {
      companyPageUrl: selected.companyPageUrl,
      extractedName: selected.extractedName,
      matchScore: selected.matchScore,
    });

    return {
      companyName: selected.extractedName || companyName || '',
      companyPageUrl: selected.companyPageUrl,
      extractionMethod: 'top-card',
      confidence: 0.9,
      isCurrent: true,
    };
  }

  /**
   * Strategy 3: scan about/featured section for company links.
   * @returns {{companyName: string, companyPageUrl: string|null, extractionMethod: string, confidence: number, isCurrent: boolean}|null}
   */
  extractFromFeaturedSection(companyName = '') {
    const aboutSection =
      document.querySelector('#about') ||
      document.querySelector('section[id*="about"]') ||
      document.querySelector('section[aria-label*="About"]');
    if (!aboutSection) {
      this.log('About section not found');
      return null;
    }

    const link =
      aboutSection.querySelector('a[href*="/company/"]') ||
      aboutSection.querySelector('a[href*="linkedin.com/company/"]');
    if (!link) {
      this.log('No company link found in about section');
      return null;
    }

    const companyPageUrl = this.normalizeLinkedInCompanyUrl(link.getAttribute('href'));
    const extractedName = this.cleanText(link.textContent || '');
    const slug = this.getCompanySlugFromUrl(companyPageUrl);
    const matchScore = this.getCompanyMatchScore(companyName, `${extractedName} ${slug}`.trim());
    if (String(companyName || '').trim() && matchScore < 2) {
      this.log('About-section link did not match requested company name', {
        companyName,
        extractedName,
        companyPageUrl,
      });
      return null;
    }

    this.log('Found company link in about section', { companyPageUrl, extractedName, matchScore });

    return {
      companyName: extractedName || companyName || '',
      companyPageUrl,
      extractionMethod: 'about-section',
      confidence: 0.78,
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

  getExperienceSection() {
    const selectors = [
      '#experience',
      'section[id*="experience"]',
      'section[aria-label*="Experience"]',
      'main section:has(a[href*="/company/"])',
    ];

    for (const selector of selectors) {
      try {
        const section = document.querySelector(selector);
        if (section) return section;
      } catch {
        // Skip invalid selector variants.
      }
    }

    return null;
  }

  getProfileIntroRoot() {
    const main = document.querySelector('main');
    if (!main) return null;

    const nameNode =
      main.querySelector('h1.text-heading-xlarge') ||
      main.querySelector('section:first-of-type h1') ||
      main.querySelector('h1');

    if (nameNode) {
      const introCard =
        nameNode.closest('section') ||
        nameNode.closest('div[class*="pv-top-card"]') ||
        nameNode.closest('div[class*="top-card"]');
      if (introCard) return introCard;
    }

    return main.querySelector('section:first-of-type') || main;
  }

  cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeCompanyKey(value) {
    return this.cleanText(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(
        /\b(inc|incorporated|llc|ltd|limited|corp|corporation|company|co|plc|gmbh|ag|sa|bv|pty|private|pvt|holdings|group)\b/g,
        ' '
      )
      .replace(/[^a-z0-9]+/g, '');
  }

  getCompanySlugFromUrl(companyUrl) {
    const value = String(companyUrl || '').trim();
    if (!value) return '';
    const match = value.match(/\/company\/([^/?#]+)/i);
    if (!match?.[1]) return '';
    return String(match[1] || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
  }

  getCompanyMatchScore(requestedCompanyName, candidateText) {
    const requested = this.normalizeCompanyKey(requestedCompanyName);
    if (!requested) return 0;

    const candidate = this.normalizeCompanyKey(candidateText);
    if (!candidate) return 0;
    if (candidate === requested) return 5;
    if (requested.length >= 6 && (candidate.includes(requested) || requested.includes(candidate))) return 4;

    const requestedTokens = String(requestedCompanyName || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 3);
    let tokenHits = 0;
    for (const token of requestedTokens) {
      if (candidate.includes(token)) tokenHits += 1;
    }

    if (requestedTokens.length >= 2) {
      if (tokenHits >= 2) return 3;
      if (tokenHits === 1) return 1;
      return 0;
    }

    if (tokenHits === 1) return 2;
    return 0;
  }

  normalizeLinkedInCompanyUrl(href) {
    const raw = String(href || '').trim();
    if (!raw) return null;

    try {
      const absolute = raw.startsWith('http') ? raw : new URL(raw, window.location.origin).toString();
      const parsed = new URL(absolute);
      const host = String(parsed.hostname || '').toLowerCase();
      if (!host.includes('linkedin.com')) {
        return null;
      }
      if (!/\/company\//i.test(parsed.pathname || '')) {
        return null;
      }
      parsed.search = '';
      parsed.hash = '';
      const slugMatch = parsed.pathname.match(/\/company\/([^/]+)/i);
      if (!slugMatch?.[1]) return null;
      parsed.pathname = `/company/${slugMatch[1]}/`;
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
