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
  MAX_LOG_ENTRIES: 400,
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
    topCard: 0.8,
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
    return /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/in\/[^/?#]+/i.test(url);
  }

  debugCurrentDom() {
    const audit = {
      timestamp: new Date().toISOString(),
      profileUrl: window.location.href,
      jsonLdCount: 0,
      jsonLd: [],
      openGraph: {
        title: null,
        description: null,
      },
      h1Count: 0,
      h1: [],
      hasMain: false,
      profileCardCount: 0,
    };

    console.group('[LinkedInExtractor] DOM Audit');

    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    audit.jsonLdCount = jsonLdScripts.length;
    console.log('JSON-LD scripts found:', jsonLdScripts.length);
    jsonLdScripts.forEach((script, i) => {
      try {
        const parsed = JSON.parse(script.textContent || '');
        audit.jsonLd.push(parsed);
        console.log(`JSON-LD ${i}:`, parsed);
      } catch (error) {
        const parseError = {
          index: i,
          error: error?.message || 'Unknown parse error',
        };
        audit.jsonLd.push(parseError);
        console.error(`JSON-LD ${i} parse error:`, error);
      }
    });

    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    audit.openGraph.title = ogTitle?.content || null;
    audit.openGraph.description = ogDescription?.content || null;
    console.log('OG Title:', audit.openGraph.title);
    console.log('OG Description:', audit.openGraph.description);

    const allH1s = document.querySelectorAll('h1');
    audit.h1Count = allH1s.length;
    console.log('All H1 elements:', allH1s.length);
    allH1s.forEach((h1, i) => {
      const entry = {
        text: h1.textContent?.trim() || '',
        classes: h1.className || '',
        parent: h1.parentElement?.className || '',
      };
      audit.h1.push(entry);
      console.log(`H1 ${i}:`, entry);
    });

    const main = document.querySelector('main');
    audit.hasMain = Boolean(main);
    console.log('Main element:', main);

    const profileCards = document.querySelectorAll('[class*="profile"], [class*="top-card"], [class*="pv-"]');
    audit.profileCardCount = profileCards.length;
    console.log('Profile card elements:', profileCards.length);

    console.groupEnd();
    return audit;
  }

  async extractProfile() {
    if (!this.isValidProfilePage()) {
      throw new Error('Not on a LinkedIn profile page');
    }

    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
    const nameH1 = document.querySelector('h1.text-heading-xlarge');
    this.log('DEBUG extractor context', {
      url: window.location.href,
      readyState: document.readyState,
      jsonLdScripts: jsonLdScripts.length,
      ogTitle: this.cleanText(ogTitle),
      h1Text: this.cleanText(nameH1?.textContent || ''),
    });

    this.log('Starting profile extraction');
    try {
      await this.waitForDomReady();
    } catch (error) {
      this.log('DOM ready timeout, continuing anyway', {
        error: error?.message || 'Unknown DOM readiness error',
      });
    }

    let name;
    let company;
    let role;
    let location;

    try {
      name = await this.extractName();
    } catch (error) {
      this.log('Name extraction failed', { error: error?.message || 'Unknown error' });
      name = {
        firstName: null,
        lastName: null,
        fullName: null,
        source: 'failed',
        confidence: 0,
      };
    }

    try {
      company = await this.extractCompany();
    } catch (error) {
      this.log('Company extraction failed', { error: error?.message || 'Unknown error' });
      company = {
        name: null,
        source: 'failed',
        confidence: 0,
      };
    }

    try {
      role = await this.extractRole();
    } catch (error) {
      this.log('Role extraction failed', { error: error?.message || 'Unknown error' });
      role = {
        title: null,
        source: 'failed',
        confidence: 0,
      };
    }

    try {
      location = await this.extractLocation();
    } catch (error) {
      this.log('Location extraction failed', { error: error?.message || 'Unknown error' });
      location = {
        location: null,
        source: 'failed',
        confidence: 0,
      };
    }

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
      success: {
        name: Boolean(name?.fullName),
        company: Boolean(company?.name),
        role: Boolean(role?.title),
        location: Boolean(location?.location),
      },
      extractionConfidence: profile.extractionConfidence,
      sources: {
        name: name?.source,
        company: company?.source,
        role: role?.source,
        location: location?.source,
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
      !!document.querySelector('h1.text-heading-xlarge') ||
      !!document.querySelector('main h1') ||
      !!document.querySelector('div[class*="pv-text-details"] h1');
    const hasExperienceSection =
      !!document.querySelector('section#experience') ||
      !!document.querySelector('[id*="experience"]');

    const signals = {
      jsonLd: hasJsonLd,
      openGraph: hasOpenGraph,
      topCardName: hasTopCardName,
      experienceSection: hasExperienceSection,
    };

    this.log('Profile signals', signals);
    return hasJsonLd || hasOpenGraph || hasTopCardName;
  }

  // Name Extraction ----------------------------------------------------------

  async extractName() {
    this.log('=== Starting name extraction ===');
    this.log('Tier 1: Attempting JSON-LD extraction');
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd) {
      const parsed = this.parseHumanName(jsonLd.fullName || `${jsonLd.firstName || ''} ${jsonLd.lastName || ''}`);
      if (parsed.firstName) {
        this.log('Name extracted from JSON-LD', {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          fullName: parsed.fullName,
        });
        return {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          fullName: parsed.fullName,
          source: 'json-ld',
          confidence: CONFIDENCE.name.jsonLd,
        };
      }
    }

    this.log('Tier 2: Attempting Open Graph extraction');
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

    this.log('Tier 3: Attempting DOM extraction');
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

    this.log('Extracting name - attempting URL slug fallback');
    const slugName = this.extractNameFromProfileSlug();
    if (slugName) {
      const parsed = this.parseHumanName(slugName);
      if (parsed.firstName) {
        this.log('Name extracted from profile URL slug', parsed);
        return {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          fullName: parsed.fullName,
          source: 'url-slug',
          confidence: 0.65,
        };
      }
    }

    this.log('Name extraction failed across all tiers');
    throw new Error('Could not extract name from profile');
  }

  // Shared Tier Helpers ------------------------------------------------------

  extractFromJsonLd() {
    this.log('Attempting JSON-LD extraction');

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    this.log(`Found ${scripts.length} JSON-LD script tags`);

    const expandNodes = (value) => {
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
          if (current.mainEntity) stack.push(current.mainEntity);
          if (Array.isArray(current.mainEntityOfPage)) current.mainEntityOfPage.forEach((item) => stack.push(item));
          if (current.mainEntityOfPage && typeof current.mainEntityOfPage === 'object') stack.push(current.mainEntityOfPage);
        }
      }
      return out;
    };

    for (let i = 0; i < scripts.length; i += 1) {
      try {
        const raw = scripts[i].textContent?.trim() || '';
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const nodes = expandNodes(parsed);

        for (const node of nodes) {
          const atType = node?.['@type'];
          const isPerson =
            atType === 'Person' || (Array.isArray(atType) && atType.some((item) => String(item).toLowerCase() === 'person'));
          if (!isPerson) continue;

          const givenName = this.cleanText(node.givenName || '');
          const familyName = this.cleanText(node.familyName || '');
          const rawName = this.cleanText(node.name || '');
          const fullName = rawName || [givenName, familyName].filter(Boolean).join(' ');

          let company = this.extractOrganizationName(node.worksFor);
          if (!company) {
            company = this.cleanText(node.affiliation?.name || node.affiliation || '');
          }

          this.log('Found Person schema in JSON-LD', {
            scriptIndex: i,
            hasName: Boolean(fullName),
            hasGivenName: Boolean(givenName),
            hasFamilyName: Boolean(familyName),
            hasWorksFor: Boolean(company),
          });

          if (fullName || (givenName && familyName)) {
            return {
              firstName: givenName || null,
              lastName: familyName || null,
              fullName: fullName || null,
              company: company || null,
              headline: this.cleanText(node.jobTitle || ''),
              location: this.extractJsonLdLocation(node) || null,
              url: this.cleanText(node.url || ''),
            };
          }
        }
      } catch (error) {
        this.log(`Failed to parse JSON-LD script ${i}`, {
          error: error?.message || 'Unknown parse error',
        });
      }
    }

    this.log('No valid Person data found in JSON-LD');
    return null;
  }

  extractFromOpenGraph() {
    this.log('Attempting Open Graph extraction');

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
      this.log('Open Graph title not found');
      return null;
    }

    this.log('Found Open Graph title', { ogTitle });

    const titleWithoutLinkedIn = ogTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').trim();
    const parts = titleWithoutLinkedIn.split(' - ');
    if (parts.length === 0) {
      this.log('Could not parse Open Graph title');
      return null;
    }

    const fullName = this.cleanNameCandidate(parts[0]);
    const headline = parts.length > 1 ? this.cleanText(parts.slice(1).join(' - ')) : '';

    this.log('Open Graph parsed', {
      fullName,
      headline,
      ogDescriptionPreview: ogDescription.slice(0, 100),
    });

    return {
      fullName: fullName || null,
      headline: headline || null,
      description: ogDescription || null,
    };
  }

  extractFromDom() {
    this.log('Attempting DOM extraction (last resort)');

    const nameSelectors = [
      // Modern LinkedIn variants
      'h1.text-heading-xlarge',
      'div.ph5.pb5 h1',
      'div.mt2.relative h1',
      '[data-generated-suggestion-target] h1',
      'div[class*="pv-text-details"] h1',
      // Legacy fallbacks
      'h1[class*="pv-top-card"]',
      'div[class*="pv-text-details__left-panel"] h1',
      'h1[class*="top-card-layout__title"]',
      'h1.inline.t-24.v-align-middle.break-words',
      // Generic fallback
      'main section:first-of-type h1',
      'main h1',
    ];

    let nameText = null;
    let nameSelector = null;

    for (const selector of nameSelectors) {
      try {
        const element = document.querySelector(selector);
        const text = this.cleanNameCandidate(element?.textContent || '');
        this.logSelectorAttempt('name', selector, element, text, null);

        if (text && text.length > 2) {
          nameText = text;
          nameSelector = selector;
          this.log(`Name found with selector: ${selector}`, { text });
          break;
        }
      } catch (error) {
        this.logSelectorAttempt('name', selector, null, '', error);
      }
    }

    if (nameText) {
      this.log('DOM extraction name result', { selector: nameSelector, nameText });
      return { fullName: nameText };
    }

    this.log('DOM: no name found');
    return null;
  }

  // Company Extraction -------------------------------------------------------

  async extractCompany() {
    this.log('=== Starting company extraction ===');
    this.log('Tier 1: Attempting JSON-LD for company');
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd?.company && this.isLikelyCompany(jsonLd.company)) {
      this.log('Company extracted from JSON-LD', { company: jsonLd.company });
      return {
        name: jsonLd.company,
        source: 'json-ld',
        confidence: CONFIDENCE.company.jsonLd,
      };
    }

    this.log('Tier 2: Attempting Experience section extraction');
    const experience = this.extractCurrentExperienceEntry();
    if (experience?.company && this.isLikelyCompany(experience.company)) {
      this.log('Company extracted from Experience section', { company: experience.company });
      return {
        name: experience.company,
        source: 'experience-section',
        confidence: CONFIDENCE.company.experience,
      };
    }

    this.log('Tier 3: Attempting top-card extraction');
    const topCardCompany = this.extractCompanyFromTopCardAffiliations();
    if (topCardCompany && this.isLikelyCompany(topCardCompany)) {
      this.log('Company extracted from top-card affiliations', { company: topCardCompany });
      return {
        name: topCardCompany,
        source: 'top-card',
        confidence: CONFIDENCE.company.topCard,
      };
    }

    this.log('Tier 4: Attempting headline parsing for company');
    const headlineCompany = this.extractCompanyFromHeadline();
    if (headlineCompany && this.isLikelyCompany(headlineCompany)) {
      this.log('Company extracted from headline', { company: headlineCompany });
      return {
        name: headlineCompany,
        source: 'headline',
        confidence: CONFIDENCE.company.headline,
      };
    }

    this.log('No company found (may be student/freelancer)');
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
      /^(?:co-?founder|founder|ceo|cto|cfo|coo|vp|director|manager|engineer|developer|consultant)\s*,\s*([^|,\n]+?)(?:\s*(?:\||$))/i,
      /^[^|,\n]+,\s*([^|,\n]+?)(?:\s*(?:\||$))/i,
    ];

    for (const pattern of patterns) {
      const match = headline.match(pattern);
      if (!match?.[1]) continue;
      const candidate = this.cleanCompanyCandidate(match[1]);
      if (candidate) return candidate;
    }

    return null;
  }

  extractCompanyFromTopCardAffiliations() {
    const selectors = [
      'main section:first-of-type a[href*="/company/"]',
      'div[class*="pv-top-card"] a[href*="/company/"]',
      'div[class*="top-card"] a[href*="/company/"]',
      'div[class*="pv-text-details__right-panel"] a',
    ];

    const candidates = [];
    for (const selector of selectors) {
      let nodes = [];
      try {
        nodes = document.querySelectorAll(selector);
      } catch (error) {
        this.logSelectorAttempt('company-top-card', selector, null, '', error);
        continue;
      }

      for (const node of nodes) {
        const text = this.cleanCompanyCandidate(node?.textContent || node?.getAttribute('aria-label') || '');
        this.logSelectorAttempt('company-top-card', selector, node, text, null);
        if (text) {
          candidates.push(text);
        }
      }
    }

    const uniqueCandidates = [...new Set(candidates)];
    if (uniqueCandidates.length === 0) {
      return null;
    }

    const preferred = uniqueCandidates.find((item) => !this.looksLikeEducation(item));
    return preferred || uniqueCandidates[0] || null;
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
      let nodes = [];
      try {
        nodes = document.querySelectorAll(selector);
      } catch (error) {
        this.logSelectorAttempt('location', selector, null, '', error);
        continue;
      }

      for (const node of nodes) {
        const text = this.cleanLocationCandidate(node?.textContent || '');
        this.logSelectorAttempt('location', selector, node, text, null);
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
      'div[id*="experience"][class*="scaffold"]',
      'main section:has(> div[id="experience"])',
    ];

    for (const selector of selectors) {
      try {
        const section = document.querySelector(selector);
        this.logSelectorAttempt('experience-section', selector, section, section ? 'matched' : '', null);
        if (section) {
          this.log('Experience section found', { selector });
          return section;
        }
      } catch (error) {
        this.logSelectorAttempt('experience-section', selector, null, '', error);
      }
    }

    this.log('Experience section not found');
    return null;
  }

  extractCurrentExperienceEntry() {
    const section = this.getExperienceSection();
    if (!section) {
      return null;
    }

    const entries = section.querySelectorAll(
      [
        'li.pvs-list__paged-list-item',
        'li[class*="pvs-list__item"]',
        'div[class*="pvs-entity"]',
        'div[class*="experience"]',
      ].join(', ')
    );

    if (!entries || entries.length === 0) {
      this.log('Experience entries not found');
      return null;
    }

    let fallback = null;

    for (const entry of entries) {
      const allText = entry.innerText || '';
      const lines = allText
        .split('\n')
        .map((line) => this.cleanText(line))
        .filter(Boolean);
      if (lines.length === 0) continue;

      const isCurrent = /\b(current|present|now)\b/i.test(allText.toLowerCase());
      const companyLink = entry.querySelector(
        ['a[href*="/company/"]', 'a[data-field="experience_company_logo"]'].join(', ')
      );

      let companyCandidate = this.cleanCompanyCandidate(companyLink?.textContent || '');
      const titleCandidate = this.cleanRoleCandidate(lines[0] || '');

      if (!companyCandidate) {
        const ariaLabels = entry.querySelectorAll('[aria-label]');
        for (const node of ariaLabels) {
          const label = node.getAttribute('aria-label') || '';
          const match = label.match(/at\s+(.+?)(?:\s+[\u00B7\u2022]|\s*\||\s*$)/i);
          if (match?.[1]) {
            companyCandidate = this.cleanCompanyCandidate(match[1]);
            if (companyCandidate) {
              break;
            }
          }
        }
      }

      if (!companyCandidate) {
        for (const line of lines) {
          const candidate = this.cleanCompanyCandidate(line);
          if (!candidate || candidate === titleCandidate || this.looksLikeEducation(candidate)) {
            continue;
          }
          if (candidate) {
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

      if (isCurrent && result.company) {
        this.log('Current experience found', result);
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
      'main section:first-of-type div.text-body-medium.break-words span[aria-hidden="true"]',
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
      .replace(/\u200B/g, '')
      .replace(/\u00C2\u00B7|\u00B7|\u2022/g, '\u00B7')
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
    text = text.split(/\s*[\u00B7\u2022]\s*/)[0].trim();

    return this.isLikelyName(text) ? text : '';
  }

  cleanCompanyCandidate(value) {
    const text = this.cleanText(value)
      .replace(/\s*[\u00B7\u2022]\s*(full-time|part-time|contract|self-employed).*$/i, '')
      .replace(/\|\s*LinkedIn.*$/i, '')
      .replace(/^(?:co-?founder|founder|ceo|cto|cfo|coo|vp|director|manager|engineer|developer|consultant)\s*,\s*/i, '')
      .trim();

    return this.isLikelyCompany(text) ? text : '';
  }

  extractNameFromProfileSlug() {
    const match = window.location.pathname.match(/\/in\/([^/?#]+)/i);
    if (!match?.[1]) return '';
    const slug = decodeURIComponent(match[1]);
    const candidate = slug
      .replace(/[-_]+/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!candidate) return '';
    return candidate.replace(/\b\w/g, (c) => c.toUpperCase());
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

  looksLikeEducation(value) {
    const text = this.cleanText(value);
    return /\b(university|school|college|institute|academy|faculty)\b/i.test(text);
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

  logSelectorAttempt(kind, selector, element, value, error) {
    this.log('Selector attempt', {
      kind,
      selector,
      found: Boolean(element),
      value: value ? String(value).slice(0, 140) : null,
      error: error ? error?.message || String(error) : null,
    });
  }

  log(message, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      data: typeof data === 'undefined' ? null : data,
    };
    this.extractionLog.push(entry);
    if (this.extractionLog.length > CONFIG.MAX_LOG_ENTRIES) {
      this.extractionLog.shift();
    }

    if (typeof data === 'undefined') {
      console.log(`[LinkedInExtractor] ${message}`);
    } else {
      console.log(`[LinkedInExtractor] ${message}`, data);
    }
  }
}

// Expose class and helpers globally for debugging/manual invocation.
window.LinkedInExtractor = LinkedInExtractor;
window.EllynLinkedInExtractor = LinkedInExtractor;

if (typeof window !== 'undefined') {
  window.debugCurrentDom = () => {
    const extractor = new LinkedInExtractor();
    return extractor.debugCurrentDom();
  };

  window.testExtraction = async () => {
    const extractor = new LinkedInExtractor();
    console.log('[LinkedInExtractor] Testing extraction...');
    try {
      const profile = await extractor.extractProfile();
      console.log('[LinkedInExtractor] Extraction successful:', profile);
      return profile;
    } catch (error) {
      console.error('[LinkedInExtractor] Extraction failed:', error);
      console.log('[LinkedInExtractor] Extraction log:', extractor.extractionLog);
      throw error;
    }
  };
}

// Runtime message listener.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;
  if (message.type !== 'EXTRACT_PROFILE') return;

  handleExtraction(message, sendResponse);
  return true;
});

async function handleExtraction(message, sendResponse) {
  const extractor = new LinkedInExtractor();
  const includeDebug = message?.debug === true;

  try {
    if (!extractor.isValidProfilePage()) {
      const response = {
        success: false,
        error: 'Not on a LinkedIn profile page',
      };
      if (includeDebug) {
        response.domAudit = extractor.debugCurrentDom();
      }
      sendResponse(response);
      return;
    }

    const profile = await extractor.extractProfile();
    const response = {
      success: true,
      data: profile,
    };

    if (includeDebug) {
      response.domAudit = extractor.debugCurrentDom();
    }

    sendResponse(response);
  } catch (error) {
    console.error('[LinkedInExtractor] Extraction failed:', error);
    const response = {
      success: false,
      error: error?.message || 'Unknown extraction error',
      extractionLog: extractor.extractionLog,
    };
    if (includeDebug) {
      response.domAudit = extractor.debugCurrentDom();
    }
    sendResponse(response);
  }
}

console.log('[LinkedInExtractor] Ready');
