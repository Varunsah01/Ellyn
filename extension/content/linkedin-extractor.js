/**
 * LinkedIn Profile Extractor
 * 3-tier fallback strategy:
 * 1) JSON-LD
 * 2) Open Graph
 * 3) DOM selectors
 */

console.log('[LinkedInExtractor] Content script loaded');

const CONFIG = {
  DOM_READY_TIMEOUT_MS: 10000,
  OBSERVER_DEBOUNCE_MS: 120,
};

const CONFIDENCE = {
  name: {
    jsonLd: 0.98,
    openGraph: 0.9,
    dom: 0.75,
  },
  company: {
    jsonLd: 0.95,
    experience: 0.85,
    headline: 0.6,
    notFound: 0,
  },
  role: {
    jsonLd: 0.95,
    headline: 0.85,
    experience: 0.7,
    notFound: 0,
  },
  location: {
    jsonLd: 0.95,
    dom: 0.8,
    openGraph: 0.65,
    notFound: 0,
  },
};

class LinkedInExtractor {
  constructor() {
    this.extractionLog = [];
    this._jsonLdNodes = null;
    this._lastExtractedProfile = null;
  }

  // Public API ---------------------------------------------------------------

  isValidProfilePage(url = window.location.href) {
    return /^https:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+/i.test(url);
  }

  async extractProfile() {
    if (!this.isValidProfilePage()) {
      throw new Error('Not on a LinkedIn profile page');
    }

    this.log('Starting profile extraction');
    await this.waitForDomReady();

    const name = await this.extractName();
    const company = await this.extractCompany();
    const role = await this.extractRole();
    const location = await this.extractLocation();

    const profile = {
      name,
      company,
      role,
      location,
      profileUrl: window.location.href,
      extractionConfidence: this.calculateConfidence({ name, company, role, location }),
      extractionTimestamp: new Date().toISOString(),
      extractionLog: this.extractionLog.slice(),
    };

    this._lastExtractedProfile = profile;
    this.log('Profile extraction complete', {
      extractionConfidence: profile.extractionConfidence,
      sources: {
        name: profile.name?.source,
        company: profile.company?.source,
        role: profile.role?.source,
        location: profile.location?.source,
      },
    });

    return profile;
  }

  // DOM Readiness ------------------------------------------------------------

  async waitForDomReady() {
    if (this.hasEssentialProfileSignals()) {
      this.log('DOM already ready');
      return;
    }

    this.log('Waiting for DOM readiness via MutationObserver');

    await new Promise((resolve) => {
      let resolved = false;
      let debounceTimer = null;

      const finish = (reason) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutTimer);
        if (debounceTimer) clearTimeout(debounceTimer);
        observer.disconnect();
        this.log('DOM readiness wait finished', { reason });
        resolve();
      };

      const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (this.hasEssentialProfileSignals()) {
            finish('mutation-observer');
          }
        }, CONFIG.OBSERVER_DEBOUNCE_MS);
      });

      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });

      const timeoutTimer = setTimeout(() => finish('timeout'), CONFIG.DOM_READY_TIMEOUT_MS);

      // One immediate re-check in case content landed between checks.
      if (this.hasEssentialProfileSignals()) {
        finish('immediate-recheck');
      }
    });
  }

  hasEssentialProfileSignals() {
    const hasJsonLd = document.querySelectorAll('script[type="application/ld+json"]').length > 0;
    const hasOpenGraph = !!document.querySelector('meta[property="og:title"]');
    const hasTopCardName =
      !!document.querySelector('h1.text-heading-xlarge') || !!document.querySelector('main h1');
    return hasJsonLd || hasOpenGraph || hasTopCardName;
  }

  // Name Extraction ----------------------------------------------------------

  async extractName() {
    this.log('Extracting name - attempting JSON-LD');
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd?.firstName && (jsonLd?.lastName || jsonLd?.fullName)) {
      const parsed = this.parseHumanName(jsonLd.fullName || `${jsonLd.firstName} ${jsonLd.lastName || ''}`);
      if (parsed.firstName) {
        this.log('Name extracted from JSON-LD', parsed);
        return {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          fullName: parsed.fullName,
          source: 'json-ld',
          confidence: CONFIDENCE.name.jsonLd,
        };
      }
    }

    this.log('Extracting name - attempting Open Graph');
    const og = this.extractFromOpenGraph();
    if (og?.fullName) {
      const parsed = this.parseHumanName(og.fullName);
      if (parsed.firstName) {
        this.log('Name extracted from Open Graph', parsed);
        return {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          fullName: parsed.fullName,
          source: 'open-graph',
          confidence: CONFIDENCE.name.openGraph,
        };
      }
    }

    this.log('Extracting name - attempting DOM selectors');
    const dom = this.extractFromDom();
    if (dom?.fullName) {
      const parsed = this.parseHumanName(dom.fullName);
      if (parsed.firstName) {
        this.log('Name extracted from DOM', parsed);
        return {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          fullName: parsed.fullName,
          source: 'dom',
          confidence: CONFIDENCE.name.dom,
        };
      }
    }

    this.log('Name extraction failed across all tiers');
    throw new Error('Could not extract name from profile');
  }

  // Shared Tier Helpers ------------------------------------------------------

  extractFromJsonLd() {
    const person = this.getPersonNodeFromJsonLd();
    if (!person) {
      this.log('JSON-LD: no Person node found');
      return null;
    }

    const givenName = this.cleanText(person.givenName);
    const familyName = this.cleanText(person.familyName);
    const rawName = this.cleanText(person.name);
    const fullName = rawName || [givenName, familyName].filter(Boolean).join(' ');

    const worksFor = this.extractOrganizationName(person.worksFor);
    const headline = this.cleanText(person.jobTitle);
    const location = this.extractJsonLdLocation(person);

    this.log('JSON-LD parsed', {
      hasGivenName: Boolean(givenName),
      hasFamilyName: Boolean(familyName),
      hasFullName: Boolean(fullName),
      hasWorksFor: Boolean(worksFor),
      hasHeadline: Boolean(headline),
      hasLocation: Boolean(location),
    });

    return {
      firstName: givenName || null,
      lastName: familyName || null,
      fullName: fullName || null,
      company: worksFor || null,
      headline: headline || null,
      location: location || null,
      url: this.cleanText(person.url) || null,
    };
  }

  extractFromOpenGraph() {
    const ogTitle = this.cleanText(
      document.querySelector('meta[property="og:title"]')?.content ||
        document.querySelector('meta[name="og:title"]')?.content ||
        ''
    );
    const ogDescription = this.cleanText(
      document.querySelector('meta[property="og:description"]')?.content ||
        document.querySelector('meta[name="og:description"]')?.content ||
        ''
    );

    if (!ogTitle) {
      this.log('Open Graph: og:title not found');
      return null;
    }

    // Example: "John Doe - Software Engineer | LinkedIn"
    const titleWithoutLinkedIn = ogTitle.replace(/\|\s*LinkedIn.*$/i, '').trim();
    const [rawName, ...rest] = titleWithoutLinkedIn.split(' - ');
    const fullName = this.cleanNameCandidate(rawName);
    const headline = this.cleanText(rest.join(' - '));

    this.log('Open Graph parsed', {
      fullName,
      hasHeadline: Boolean(headline),
      hasDescription: Boolean(ogDescription),
    });

    return {
      fullName: fullName || null,
      headline: headline || null,
      description: ogDescription || null,
    };
  }

  extractFromDom() {
    const nameSelectors = [
      'h1.text-heading-xlarge',
      'h1[class*="pv-top-card"]',
      'div[class*="pv-text-details__left-panel"] h1',
      'h1[class*="top-card-layout__title"]',
      'h1.inline.t-24.v-align-middle.break-words',
      'main h1',
    ];

    for (const selector of nameSelectors) {
      const element = document.querySelector(selector);
      const text = this.cleanNameCandidate(element?.textContent || '');
      this.log('DOM name selector attempt', { selector, found: Boolean(text) });
      if (text) {
        return { fullName: text };
      }
    }

    this.log('DOM: no name found using fallback selectors');
    return null;
  }

  // Company Extraction -------------------------------------------------------

  async extractCompany() {
    this.log('Extracting company - attempting JSON-LD');
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd?.company && this.isLikelyCompany(jsonLd.company)) {
      this.log('Company extracted from JSON-LD', { company: jsonLd.company });
      return {
        name: jsonLd.company,
        source: 'json-ld',
        confidence: CONFIDENCE.company.jsonLd,
      };
    }

    this.log('Extracting company - attempting Experience section');
    const experience = this.extractCurrentExperienceEntry();
    if (experience?.company && this.isLikelyCompany(experience.company)) {
      this.log('Company extracted from Experience section', { company: experience.company });
      return {
        name: experience.company,
        source: 'experience-section',
        confidence: CONFIDENCE.company.experience,
      };
    }

    this.log('Extracting company - attempting headline parsing');
    const headlineCompany = this.extractCompanyFromHeadline();
    if (headlineCompany && this.isLikelyCompany(headlineCompany)) {
      this.log('Company extracted from headline', { company: headlineCompany });
      return {
        name: headlineCompany,
        source: 'headline',
        confidence: CONFIDENCE.company.headline,
      };
    }

    this.log('Company extraction failed across all tiers');
    return {
      name: null,
      source: 'not-found',
      confidence: CONFIDENCE.company.notFound,
    };
  }

  extractCompanyFromHeadline() {
    const headline = this.getHeadlineText();
    if (!headline) return null;

    const patterns = [
      /\b(?:at|@)\s+([^|,\n]+?)(?:\s*(?:\||,|$))/i,
      /\b(?:at|@)\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = headline.match(pattern);
      if (!match?.[1]) continue;
      const candidate = this.cleanCompanyCandidate(match[1]);
      if (candidate) return candidate;
    }

    return null;
  }

  // Role Extraction ----------------------------------------------------------

  async extractRole() {
    this.log('Extracting role - attempting JSON-LD');
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd?.headline && this.isLikelyRole(jsonLd.headline)) {
      this.log('Role extracted from JSON-LD', { role: jsonLd.headline });
      return {
        title: jsonLd.headline,
        source: 'json-ld',
        confidence: CONFIDENCE.role.jsonLd,
      };
    }

    this.log('Extracting role - attempting headline parsing');
    const headlineRole = this.extractRoleFromHeadline();
    if (headlineRole && this.isLikelyRole(headlineRole)) {
      this.log('Role extracted from headline', { role: headlineRole });
      return {
        title: headlineRole,
        source: 'headline',
        confidence: CONFIDENCE.role.headline,
      };
    }

    this.log('Extracting role - attempting Experience section');
    const experience = this.extractCurrentExperienceEntry();
    if (experience?.title && this.isLikelyRole(experience.title)) {
      this.log('Role extracted from Experience section', { role: experience.title });
      return {
        title: experience.title,
        source: 'experience-section',
        confidence: CONFIDENCE.role.experience,
      };
    }

    this.log('Role extraction failed across all tiers');
    return {
      title: null,
      source: 'not-found',
      confidence: CONFIDENCE.role.notFound,
    };
  }

  extractRoleFromHeadline() {
    const headline = this.getHeadlineText();
    if (!headline) return null;

    const match = headline.match(/^(.+?)(?:\s+(?:at|@)\s+|\s*\||$)/i);
    if (!match?.[1]) return null;

    const role = this.cleanRoleCandidate(match[1]);
    return role || null;
  }

  // Location Extraction ------------------------------------------------------

  async extractLocation() {
    this.log('Extracting location - attempting JSON-LD');
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd?.location && this.isLikelyLocation(jsonLd.location)) {
      this.log('Location extracted from JSON-LD', { location: jsonLd.location });
      return {
        location: jsonLd.location,
        source: 'json-ld',
        confidence: CONFIDENCE.location.jsonLd,
      };
    }

    this.log('Extracting location - attempting top card DOM');
    const domLocation = this.extractLocationFromDom();
    if (domLocation && this.isLikelyLocation(domLocation)) {
      this.log('Location extracted from DOM', { location: domLocation });
      return {
        location: domLocation,
        source: 'dom',
        confidence: CONFIDENCE.location.dom,
      };
    }

    this.log('Extracting location - attempting Open Graph');
    const ogLocation = this.extractLocationFromOpenGraph();
    if (ogLocation && this.isLikelyLocation(ogLocation)) {
      this.log('Location extracted from Open Graph', { location: ogLocation });
      return {
        location: ogLocation,
        source: 'open-graph',
        confidence: CONFIDENCE.location.openGraph,
      };
    }

    this.log('Location extraction failed across all tiers');
    return {
      location: null,
      source: 'not-found',
      confidence: CONFIDENCE.location.notFound,
    };
  }

  extractLocationFromDom() {
    const selectors = [
      'div.pv-text-details__left-panel span.text-body-small.inline.t-black--light.break-words',
      'span.text-body-small.inline.t-black--light.break-words',
      '[class*="top-card"] [class*="location"]',
      '[class*="pv-top-card"] [class*="location"]',
      'main section:first-of-type span.t-black--light',
    ];

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        const text = this.cleanLocationCandidate(node?.textContent || '');
        this.log('DOM location selector attempt', { selector, value: text || null });
        if (text) {
          return text;
        }
      }
    }

    return null;
  }

  extractLocationFromOpenGraph() {
    const og = this.extractFromOpenGraph();
    const description = og?.description;
    if (!description) return null;

    // Typical structure: "Role at Company | Location"
    const segments = description
      .split('|')
      .map((s) => this.cleanLocationCandidate(s))
      .filter(Boolean);

    for (let i = segments.length - 1; i >= 0; i -= 1) {
      if (this.isLikelyLocation(segments[i])) {
        return segments[i];
      }
    }

    return null;
  }

  // Confidence ---------------------------------------------------------------

  calculateConfidence(data) {
    const source = data || this._lastExtractedProfile || {};
    const confidences = [
      source?.name?.confidence,
      source?.company?.confidence,
      source?.role?.confidence,
      source?.location?.confidence,
    ].filter((v) => Number.isFinite(v));

    if (confidences.length === 0) return 0;
    const avg = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
    return Math.round(avg * 100) / 100;
  }

  // JSON-LD internals --------------------------------------------------------

  getPersonNodeFromJsonLd() {
    const nodes = this.getJsonLdNodes();
    for (const node of nodes) {
      if (this.nodeHasType(node, 'Person')) {
        return node;
      }
    }
    return null;
  }

  getJsonLdNodes() {
    if (this._jsonLdNodes) return this._jsonLdNodes;

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const nodes = [];

    scripts.forEach((script, index) => {
      const raw = script.textContent?.trim();
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        this.flattenJsonLd(parsed).forEach((node) => {
          if (node && typeof node === 'object') nodes.push(node);
        });
      } catch (error) {
        this.log('JSON-LD parse failed', { scriptIndex: index, message: error?.message || 'Unknown error' });
      }
    });

    this._jsonLdNodes = nodes;
    return nodes;
  }

  flattenJsonLd(value) {
    const out = [];
    const stack = [value];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;

      if (Array.isArray(current)) {
        current.forEach((item) => stack.push(item));
        continue;
      }

      if (typeof current === 'object') {
        out.push(current);
        if (Array.isArray(current['@graph'])) current['@graph'].forEach((item) => stack.push(item));
        if (Array.isArray(current.graph)) current.graph.forEach((item) => stack.push(item));
      }
    }

    return out;
  }

  nodeHasType(node, type) {
    const atType = node?.['@type'];
    if (typeof atType === 'string') return atType.toLowerCase() === type.toLowerCase();
    if (Array.isArray(atType)) {
      return atType.some((item) => typeof item === 'string' && item.toLowerCase() === type.toLowerCase());
    }
    return false;
  }

  extractOrganizationName(worksFor) {
    if (!worksFor) return '';

    if (typeof worksFor === 'string') {
      return this.cleanCompanyCandidate(worksFor);
    }

    if (Array.isArray(worksFor)) {
      for (const org of worksFor) {
        const result = this.extractOrganizationName(org);
        if (result) return result;
      }
      return '';
    }

    if (typeof worksFor === 'object') {
      return this.cleanCompanyCandidate(worksFor.name || worksFor.legalName || '');
    }

    return '';
  }

  extractJsonLdLocation(person) {
    return (
      this.cleanLocationCandidate(person?.address?.addressLocality || '') ||
      this.cleanLocationCandidate(person?.homeLocation?.name || person?.homeLocation || '')
    );
  }

  // Experience Section -------------------------------------------------------

  getExperienceSection() {
    const selectors = [
      'section#experience',
      'section[data-section="experience"]',
      'section[id*="experience"]',
      'div[id*="experience"]',
    ];

    for (const selector of selectors) {
      const section = document.querySelector(selector);
      if (section) return section;
    }

    return null;
  }

  extractCurrentExperienceEntry() {
    const section = this.getExperienceSection();
    if (!section) {
      this.log('Experience section not found');
      return null;
    }

    const entries = section.querySelectorAll('li, div[class*="pvs-list__item"], div[class*="experience"]');
    let fallback = null;

    for (const entry of entries) {
      const lines = (entry.innerText || '')
        .split('\n')
        .map((line) => this.cleanText(line))
        .filter(Boolean);
      if (lines.length === 0) continue;

      const isCurrent = /\b(current|present)\b/i.test(lines.join(' '));
      const companyFromLink = this.cleanCompanyCandidate(
        entry.querySelector('a[href*="/company/"]')?.textContent || ''
      );

      const titleCandidate = this.cleanRoleCandidate(lines[0] || '');

      let companyCandidate = companyFromLink;
      if (!companyCandidate) {
        for (const line of lines) {
          const candidate = this.cleanCompanyCandidate(line);
          if (candidate && candidate !== titleCandidate) {
            companyCandidate = candidate;
            break;
          }
        }
      }

      const result = {
        title: titleCandidate || null,
        company: companyCandidate || null,
      };

      if (!fallback && (result.title || result.company)) {
        fallback = result;
      }

      if (isCurrent && (result.title || result.company)) {
        return result;
      }
    }

    return fallback;
  }

  // Normalization / Validation ----------------------------------------------

  getHeadlineText() {
    const og = this.extractFromOpenGraph();
    if (og?.headline) return og.headline;
    if (og?.description) return og.description;

    const selectors = [
      'div.text-body-medium.break-words',
      'div[class*="pv-text-details__left-panel"] div.text-body-medium',
      'div[class*="top-card-layout__headline"]',
      'main section:first-of-type div.text-body-medium',
    ];

    for (const selector of selectors) {
      const text = this.cleanText(document.querySelector(selector)?.textContent || '');
      if (text) return text;
    }

    return '';
  }

  cleanText(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanNameCandidate(value) {
    let text = this.cleanText(value);
    if (!text) return '';

    text = text
      .replace(/\|\s*LinkedIn.*$/i, '')
      .replace(/\((?:he\/him|she\/her|they\/them|pronouns.*?)\)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Remove inline bullets/metadata that sometimes leak into headings.
    text = text.split('·')[0].trim();

    return this.isLikelyName(text) ? text : '';
  }

  cleanCompanyCandidate(value) {
    const text = this.cleanText(value)
      .replace(/\s*·\s*(full-time|part-time|contract|self-employed).*$/i, '')
      .replace(/\|\s*LinkedIn.*$/i, '')
      .trim();

    return this.isLikelyCompany(text) ? text : '';
  }

  cleanRoleCandidate(value) {
    const text = this.cleanText(value)
      .replace(/\|\s*LinkedIn.*$/i, '')
      .trim();

    return this.isLikelyRole(text) ? text : '';
  }

  cleanLocationCandidate(value) {
    const text = this.cleanText(value)
      .replace(/\|\s*LinkedIn.*$/i, '')
      .replace(/\b(500\+ connections?|contact info|open to work)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return this.isLikelyLocation(text) ? text : '';
  }

  isLikelyName(value) {
    const text = this.cleanText(value);
    if (!text || text.length < 1 || text.length > 120) return false;
    if (/linkedin|profile|connections|followers/i.test(text)) return false;
    if (/@/.test(text)) return false;

    const tokens = text.split(' ').filter(Boolean);
    if (tokens.length > 6) return false;

    return /[\p{L}]/u.test(text);
  }

  isLikelyCompany(value) {
    const text = this.cleanText(value);
    if (!text || text.length < 2 || text.length > 140) return false;
    if (/linkedin|followers|connections|yrs|mos|present|current/i.test(text)) return false;
    if (/^[0-9]+$/.test(text)) return false;
    return true;
  }

  isLikelyRole(value) {
    const text = this.cleanText(value);
    if (!text || text.length < 2 || text.length > 160) return false;
    if (/linkedin|followers|connections|contact info/i.test(text)) return false;
    if (/^[0-9]+$/.test(text)) return false;
    return true;
  }

  isLikelyLocation(value) {
    const text = this.cleanText(value);
    if (!text || text.length < 2 || text.length > 120) return false;
    if (/linkedin|followers|connections|contact info|open to work/i.test(text)) return false;
    return /[\p{L}]/u.test(text);
  }

  parseHumanName(value) {
    const normalized = this.cleanNameCandidate(value);
    if (!normalized) {
      return { firstName: '', lastName: '', fullName: '' };
    }

    const prefixes = new Set([
      'mr',
      'mrs',
      'ms',
      'dr',
      'prof',
      'sir',
      'madam',
      'dame',
      'mx',
    ]);
    const suffixes = new Set([
      'jr',
      'sr',
      'ii',
      'iii',
      'iv',
      'phd',
      'md',
      'mba',
      'esq',
      'jd',
    ]);

    const parts = normalized
      .split(/\s+/)
      .map((part) =>
        part
          .replace(/^[^\p{L}\p{N}'’-]+/gu, '')
          .replace(/[^\p{L}\p{N}'’.-]+$/gu, '')
      )
      .filter(Boolean);

    while (parts.length > 0 && prefixes.has(parts[0].toLowerCase().replace(/\./g, ''))) {
      parts.shift();
    }

    while (parts.length > 0 && suffixes.has(parts[parts.length - 1].toLowerCase().replace(/\./g, ''))) {
      parts.pop();
    }

    if (parts.length === 0) {
      return { firstName: '', lastName: '', fullName: '' };
    }

    if (parts.length === 1) {
      // Single-name profiles like "Prince" or "Madonna".
      return {
        firstName: parts[0],
        lastName: '',
        fullName: parts[0],
      };
    }

    // Preserve compound surnames and hyphenated names.
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
    };
  }

  // Logging -----------------------------------------------------------------

  log(message, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      data: typeof data === 'undefined' ? null : data,
    };
    this.extractionLog.push(entry);

    if (typeof data === 'undefined') {
      console.log(`[LinkedInExtractor] ${message}`);
    } else {
      console.log(`[LinkedInExtractor] ${message}`, data);
    }
  }
}

// Expose class globally for debugging/manual invocation.
window.LinkedInExtractor = LinkedInExtractor;

// Runtime message listener.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;
  if (message.type !== 'EXTRACT_PROFILE') return;

  handleExtraction(sendResponse);
  return true;
});

async function handleExtraction(sendResponse) {
  const extractor = new LinkedInExtractor();

  try {
    if (!extractor.isValidProfilePage()) {
      sendResponse({
        success: false,
        error: 'Not on a LinkedIn profile page',
      });
      return;
    }

    const profile = await extractor.extractProfile();
    sendResponse({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('[LinkedInExtractor] Extraction failed:', error);
    sendResponse({
      success: false,
      error: error?.message || 'Unknown extraction error',
      extractionLog: extractor.extractionLog,
    });
  }
}

console.log('[LinkedInExtractor] Ready');
