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
    openGraph: 0.95,
    dom: 0.9,
    jsonLd: 0.8,
    slug: 0.6,
  },
  company: {
    jsonLd: 0.62,
    topCard: 0.84,
    headline: 0.9,
    experience: 0.88,
    notFound: 0,
  },
  role: {
    jsonLd: 0.7,
    topCard: 0.75,
    headline: 0.7,
    experience: 0.92,
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

    audit.selectorTests = {
      company: this._testSelectors([
        'div.mt2.relative span.text-body-medium[aria-hidden="true"]',
        'main section:first-of-type span.text-body-medium[aria-hidden="true"]',
        'main section:first-of-type a[href*="/company/"] span[aria-hidden="true"]',
        'div[class*="pv-text-details"] a[href*="/company/"] span[aria-hidden="true"]',
        'div[class*="pv-text-details"] div.text-body-medium:not(.break-words)',
        'div.pv-text-details__left-panel div.text-body-medium span[aria-hidden="true"]',
        'section.pv-top-card div.text-body-medium:not(.break-words)',
        'div[class*="top-card-layout__entity-info"] div.text-body-medium',
      ]),
      headline: this._testSelectors([
        'main section:first-of-type div.text-body-medium.break-words span[aria-hidden="true"]',
        'div.ph5.pb5 div.text-body-medium.break-words span[aria-hidden="true"]',
        '[data-view-name="profile-card"] div.text-body-medium.break-words',
        'div.text-body-medium.break-words',
        'div[class*="pv-text-details__left-panel"] div.text-body-medium',
        'div[class*="top-card-layout__headline"]',
      ]),
      location: this._testSelectors([
        'main section:first-of-type span.text-body-small.t-black--light span[aria-hidden="true"]',
        'div.mt2.relative span.text-body-small[aria-hidden="true"]',
        'div.pv-text-details__left-panel span.text-body-small.inline.t-black--light.break-words',
        'span.text-body-small.inline.t-black--light.break-words',
      ]),
      education: {
        sectionFound: Boolean(document.querySelector('section#education, section[aria-label*="Education"]')),
      },
    };
    audit.profileType = this.detectProfileType?.() || null;
    console.log('Selector tests:', audit.selectorTests);
    console.log('Profile type:', audit.profileType);

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

    // Partial profile needed for detectProfileType to check hasCompany
    this._lastExtractedProfile = { company };

    let education = null;
    try {
      education = this.extractEducationRaw();
    } catch (error) {
      this.log('Education extraction failed', { error: error?.message || 'Unknown error' });
    }
    this._pendingEducation = education;

    const profileType = this.detectProfileType();

    const profile = {
      name,
      company,
      role,
      location,
      education,
      profileType,
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
        education: Boolean(education?.institution),
      },
      profileType: profileType?.type,
      extractionConfidence: profile.extractionConfidence,
      sources: {
        name: name?.source,
        company: company?.source,
        role: role?.source,
        location: location?.source,
        education: education?.source,
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
    this.log('=== NAME EXTRACTION START ===');

    this.log('TIER 1: Attempting Open Graph extraction (display name)');
    const og = this.extractFromOpenGraph();
    if (og?.fullName) {
      const { firstName, lastName } = this.splitName(og.fullName);
      if (firstName) {
        this.log('Name from Open Graph (display name)', {
          fullName: og.fullName,
          firstName,
          lastName,
        });
        return {
          firstName,
          lastName,
          fullName: og.fullName,
          source: 'open-graph',
          confidence: CONFIDENCE.name.openGraph,
        };
      }
    }
    this.log('Open Graph did not return a valid display name');

    this.log('TIER 2: Attempting DOM h1 extraction (display name)');
    const domName = this.extractNameFromDom();
    if (domName?.fullName) {
      const { firstName, lastName } = this.splitName(domName.fullName);
      if (firstName) {
        this.log('Name from DOM h1 (display name)', {
          fullName: domName.fullName,
          firstName,
          lastName,
        });
        return {
          firstName,
          lastName,
          fullName: domName.fullName,
          source: 'dom',
          confidence: CONFIDENCE.name.dom,
        };
      }
    }
    this.log('DOM h1 did not return a valid display name');

    this.log('TIER 3: Attempting JSON-LD extraction');
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd?.firstName && jsonLd?.lastName) {
      const fullName = `${jsonLd.firstName} ${jsonLd.lastName}`.trim();
      this.log('Name from JSON-LD firstName/lastName', {
        fullName,
        firstName: jsonLd.firstName,
        lastName: jsonLd.lastName,
      });
      return {
        firstName: jsonLd.firstName,
        lastName: jsonLd.lastName,
        fullName,
        source: 'json-ld',
        confidence: CONFIDENCE.name.jsonLd,
      };
    }
    if (jsonLd?.fullName) {
      const { firstName, lastName } = this.splitName(jsonLd.fullName);
      if (firstName) {
        this.log('Name from JSON-LD fullName', {
          fullName: jsonLd.fullName,
          firstName,
          lastName,
        });
        return {
          firstName,
          lastName,
          fullName: jsonLd.fullName,
          source: 'json-ld',
          confidence: CONFIDENCE.name.jsonLd,
        };
      }
    }
    this.log('JSON-LD did not return a valid name');

    this.log('TIER 4: Attempting profile slug extraction');
    const slugName = this.extractNameFromProfileSlug();
    if (slugName) {
      const { firstName, lastName } = this.splitName(slugName);
      if (firstName) {
        this.log('Name from profile slug', {
          fullName: slugName,
          firstName,
          lastName,
        });
        return {
          firstName,
          lastName,
          fullName: slugName,
          source: 'profile-slug',
          confidence: CONFIDENCE.name.slug,
        };
      }
    }
    this.log('Profile slug did not return a valid name');

    this.log('=== NAME EXTRACTION FAILED ===');
    return {
      firstName: null,
      lastName: null,
      fullName: null,
      source: 'failed',
      confidence: 0,
    };
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

  extractNameFromDom() {
    return this.extractFromDom();
  }

  splitName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
      return { firstName: '', lastName: '' };
    }

    const cleaned = fullName.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      return { firstName: '', lastName: '' };
    }

    if (!cleaned.includes(' ')) {
      return { firstName: cleaned, lastName: '' };
    }

    const parts = cleaned.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ');

    return { firstName, lastName };
  }

  // Company Extraction -------------------------------------------------------

  async extractCompany() {
    this.log('=== COMPANY EXTRACTION START ===');

    const candidates = [];
    const addCandidate = (rawName, source, confidence) => {
      const normalized = this.cleanCompanyCandidate(rawName);
      if (!normalized || !this.isLikelyCompany(normalized)) return;

      const candidate = {
        name: normalized,
        source,
        confidence,
        score: this.scoreCompanyCandidate(normalized, source),
      };
      candidates.push(candidate);
      this.log('Company candidate captured', candidate);
    };

    this.log('TIER 1: Attempting headline parsing');
    const headlineCompany = this.extractCompanyFromHeadline();
    if (headlineCompany) {
      addCandidate(headlineCompany, 'headline', CONFIDENCE.company.headline);
    } else {
      this.log('Headline did not return a valid company');
    }

    this.log('TIER 2: Attempting top-card extraction');
    const topCardCompany = this.extractCompanyFromTopCard();
    if (topCardCompany) {
      addCandidate(topCardCompany, 'top-card', CONFIDENCE.company.topCard);
    } else {
      this.log('Top-card did not return a valid company');
    }

    this.log('TIER 3: Attempting experience section (current only)');
    const currentExperience = this.extractCurrentCompanyFromExperience();
    if (currentExperience) {
      addCandidate(currentExperience, 'experience-current', CONFIDENCE.company.experience);
    } else {
      this.log('Experience section did not return a valid current company');
    }

    this.log('TIER 4: Attempting JSON-LD extraction');
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd?.company) {
      addCandidate(jsonLd.company, 'json-ld', CONFIDENCE.company.jsonLd);
    } else {
      this.log('JSON-LD did not return a valid company');
    }

    const selected = this.selectBestCompanyCandidate(candidates);
    if (selected) {
      this.log('Selected best company candidate', selected);
      return {
        name: selected.name,
        source: selected.source,
        confidence: selected.confidence,
      };
    }

    this.log('=== COMPANY EXTRACTION FAILED ===');
    return {
      name: null,
      source: 'not-found',
      confidence: CONFIDENCE.company.notFound,
    };
  }

  extractCompanyFromTopCard() {
    this.log('Scanning top-card for company name');

    const introRoot = this.getProfileIntroRoot();
    if (!introRoot) {
      this.log('Top-card intro root not found');
      return null;
    }

    const topCardSelectors = [
      // Company links are strongest when present.
      'a[href*="/company/"] span[aria-hidden="true"]',
      'a[href*="/company/"]',
      // Headline-adjacent affiliation text.
      'div.text-body-medium:not(.break-words) span[aria-hidden="true"]',
      'div.text-body-medium:not(.break-words)',
      'span.text-body-medium[aria-hidden="true"]',
      'span.text-body-medium',
    ];

    for (const selector of topCardSelectors) {
      try {
        const elements = introRoot.querySelectorAll(selector);
        for (const element of elements) {
          const rawText = this.cleanText(element.textContent || '');
          const text = this.extractCompanyFromMixedText(rawText) || this.cleanCompanyCandidate(rawText);
          if (text && !this.looksLikeRole(text)) {
            this.log('Top-card company candidate found', { selector, text });
            return text;
          }
        }
      } catch (error) {
        this.log('Top-card selector failed', { selector, error: error?.message || 'Unknown selector failure' });
      }
    }

    // Strict fallback: only company links under intro root.
    try {
      const companyLinks = introRoot.querySelectorAll('a[href*="/company/"]');
      for (const link of companyLinks) {
        const span = link.querySelector('span[aria-hidden="true"]') || link;
        const text = this.cleanCompanyCandidate(span.textContent || '');
        if (text && !this.looksLikeRole(text)) {
          this.log('Top-card company found via company link fallback', { text });
          return text;
        }
      }
    } catch (error) {
      this.log('Company link fallback failed', { error: error?.message || 'Unknown error' });
    }

    this.log('No valid company found in top-card');
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

  extractCurrentCompanyFromExperience() {
    this.log('Scanning experience section for current company only');

    try {
      const experienceSection = this.getExperienceSection();
      if (!experienceSection) {
        this.log('Experience section not found in DOM');
        return null;
      }

      const experienceItems = experienceSection.querySelectorAll('li');
      const rankedCandidates = [];

      experienceItems.forEach((item, itemIndex) => {
        const itemText = item.textContent || '';
        const isCurrent = /\b(current|present)\b/i.test(itemText);
        if (!isCurrent) return;

        const companyLink = item.querySelector('a[href*="/company/"]');
        const linkedCompany = this.cleanCompanyCandidate(
          companyLink?.querySelector('span[aria-hidden="true"]')?.textContent ||
            companyLink?.textContent ||
            ''
        );
        if (linkedCompany && !this.looksLikeRole(linkedCompany)) {
          rankedCandidates.push({
            name: linkedCompany,
            score: 3,
            itemIndex,
            source: 'link',
          });
        }

        const companySpans = item.querySelectorAll('span[aria-hidden="true"]');
        for (const span of companySpans) {
          const rawText = this.cleanText(span.textContent || '');
          const text = this.extractCompanyFromMixedText(rawText) || this.cleanCompanyCandidate(rawText);
          if (!text || this.looksLikeRole(text)) continue;

          rankedCandidates.push({
            name: text,
            score: 2,
            itemIndex,
            source: 'span',
          });
          break;
        }
      });

      if (rankedCandidates.length > 0) {
        rankedCandidates.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.itemIndex - b.itemIndex;
        });
        const winner = rankedCandidates[0];
        this.log('Current company found in experience', winner);
        return winner.name;
      }

      this.log('No current company found in experience section');
      return null;
    } catch (error) {
      this.log('Error extracting current company from experience section', {
        error: error?.message || 'Unknown experience extraction error',
      });
      return null;
    }
  }

  extractCompanyFromHeadline() {
    const headline = this.getHeadlineText();
    if (!headline) return null;

    const patterns = [
      /\b(?:at|@)\s+([^|,\n\u00B7\u2022]+?)(?:\s*(?:\||,|\u00B7|\u2022|$))/i,
      /\b(?:at|@)\s+(.+)$/i,
      /^(?:co-?founder|founder|ceo|cto|cfo|coo|vp|director|manager|engineer|developer|consultant)\s*,\s*([^|,\n\u00B7\u2022]+?)(?:\s*(?:\||\u00B7|\u2022|$))/i,
      /^[^|,\n\u00B7\u2022]+,\s*([^|,\n\u00B7\u2022]+?)(?:\s*(?:\||\u00B7|\u2022|$))/i,
    ];

    for (const pattern of patterns) {
      const match = headline.match(pattern);
      if (!match?.[1]) continue;
      const candidate = this.cleanCompanyCandidate(match[1]);
      if (candidate) return candidate;
    }

    // Support headlines like: "Role | Company | extra context"
    const segments = headline
      .split(/[\|\u00B7\u2022]/)
      .map((segment) => this.cleanText(segment))
      .filter(Boolean);

    for (let i = 1; i < segments.length; i += 1) {
      const withoutParen = this.cleanText(segments[i].replace(/\([^)]*\)/g, ' '));
      const candidate = this.cleanCompanyCandidate(withoutParen);
      if (!candidate) continue;
      if (this.looksLikeEducation(candidate) || this.looksLikeRole(candidate)) continue;
      return candidate;
    }

    return null;
  }

  extractCompanyFromTopCardAffiliations() {
    return this.extractCompanyFromTopCard();
  }

  extractCompanyFromMixedText(value) {
    const text = this.cleanText(value);
    if (!text) return '';

    const patterns = [
      /\b(?:at|@)\s+([^|,\n\u00B7\u2022]+?)(?:\s*(?:\||,|\u00B7|\u2022|$))/i,
      /\b(?:at|@)\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match?.[1]) continue;

      const candidate = this.cleanCompanyCandidate(match[1]);
      if (candidate) return candidate;
    }

    const segments = text
      .split(/[\|\u00B7\u2022]/)
      .map((segment) => this.cleanText(segment))
      .filter(Boolean);
    if (segments.length > 1) {
      for (let i = 1; i < segments.length; i += 1) {
        const candidate = this.cleanCompanyCandidate(segments[i].replace(/\([^)]*\)/g, ' '));
        if (!candidate) continue;
        if (this.looksLikeEducation(candidate) || this.looksLikeRole(candidate)) continue;
        return candidate;
      }
    }

    return '';
  }

  // Role Extraction ----------------------------------------------------------

  async extractRole() {
    this.log('Extracting role - attempting Experience section (current role first)');
    const experience = this.extractCurrentExperienceEntry();
    if (experience?.title && this.isLikelyRole(experience.title)) {
      this.log('Role extracted from Experience section', { role: experience.title });
      return {
        title: experience.title,
        source: 'experience-section',
        confidence: CONFIDENCE.role.experience,
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
      'main section:first-of-type span.text-body-small.t-black--light span[aria-hidden="true"]',
      'div.mt2.relative span.text-body-small[aria-hidden="true"]',
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
          if (
            !candidate ||
            candidate === titleCandidate ||
            this.looksLikeEducation(candidate) ||
            this.looksLikeRole(candidate)
          ) {
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
    const selectors = [
      'main section:first-of-type div.text-body-medium.break-words span[aria-hidden="true"]',
      'div.ph5.pb5 div.text-body-medium.break-words span[aria-hidden="true"]',
      '[data-view-name="profile-card"] div.text-body-medium.break-words',
      'div.text-body-medium.break-words',
      'div[class*="pv-text-details__left-panel"] div.text-body-medium',
      'div[class*="top-card-layout__headline"]',
      'main section:first-of-type div.text-body-medium',
    ];

    for (const selector of selectors) {
      const text = this.cleanText(document.querySelector(selector)?.textContent || '');
      if (text) return text;
    }

    const og = this.extractFromOpenGraph();
    if (og?.headline) return og.headline;
    if (og?.description) return og.description;

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
    let text = this.cleanText(value)
      .replace(/\s*[\u00B7\u2022]\s*(full-time|part-time|contract|self-employed).*$/i, '')
      .replace(/\|\s*LinkedIn.*$/i, '')
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/i, '')
      .replace(/^(?:co-?founder|founder|ceo|cto|cfo|coo|vp|director|manager|engineer|developer|consultant)\s*,\s*/i, '')
      .trim();

    const explicitMatch = text.match(
      /\b(?:at|@)\s+([^|,\n\u00B7\u2022]+?)(?:\s*(?:\||,|\u00B7|\u2022|$))/i
    );
    if (explicitMatch?.[1]) {
      text = this.cleanText(explicitMatch[1]);
    }

    if (text.includes('|') || text.includes('\u00B7') || text.includes('\u2022')) {
      text = this.cleanText(text.split(/[\|\u00B7\u2022]/)[0] || '');
    }

    return this.isLikelyCompany(text) ? text : '';
  }

  normalizeCompanyKey(value) {
    return this.cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  looksLikeWebsiteDomain(value) {
    const text = this.cleanText(value).toLowerCase();
    if (!text) return false;
    if (text.includes(' ')) return false;
    if (!text.includes('.')) return false;
    return /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(text);
  }

  scoreCompanyCandidate(name, source) {
    const base = {
      headline: 1.0,
      'experience-current': 0.95,
      'top-card': 0.84,
      'json-ld': 0.62,
    };
    let score = Number(base[source] || 0.6);

    if (this.looksLikeWebsiteDomain(name)) {
      score -= 0.35;
    }
    if (this.looksLikeEducation(name)) {
      score -= 0.4;
    }
    if (this.looksLikeRole(name)) {
      score -= 0.4;
    }

    return score;
  }

  selectBestCompanyCandidate(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const grouped = new Map();
    for (const candidate of candidates) {
      const key = this.normalizeCompanyKey(candidate?.name || '');
      if (!key) continue;

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          totalScore: 0,
          bestScore: Number.NEGATIVE_INFINITY,
          best: null,
          hits: 0,
        });
      }

      const bucket = grouped.get(key);
      const score = Number(candidate?.score || 0);
      bucket.totalScore += score;
      bucket.hits += 1;
      if (score > bucket.bestScore) {
        bucket.bestScore = score;
        bucket.best = candidate;
      }
    }

    const ranked = Array.from(grouped.values())
      .filter((entry) => entry.best && entry.totalScore > 0.25)
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.hits !== a.hits) return b.hits - a.hits;
        return b.bestScore - a.bestScore;
      });

    if (ranked.length === 0) {
      return null;
    }

    const winner = ranked[0].best;
    return {
      name: winner.name,
      source: winner.source,
      confidence: winner.confidence,
      score: ranked[0].totalScore,
    };
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

  looksLikeRole(value) {
    if (!value || typeof value !== 'string') return false;
    const text = value.trim();
    if (!text) return false;

    const roleKeywords =
      /\b(co-?founder|founder|ceo|cto|cfo|coo|vp|director|manager|engineer|developer|designer|analyst|consultant|specialist|coordinator|lead|senior|junior|intern|associate|executive|administrator|officer|head of|chief)\b/i;
    if (!roleKeywords.test(text)) return false;

    if (/\b(?:at|@)\b/i.test(text)) return false;

    const companyIndicators =
      /\b(inc|inc\.|ltd|ltd\.|llc|plc|corp|corp\.|co|co\.|company|group|holdings|technologies|technology|systems|solutions|services|bank|insurance|life|limited)\b/i;
    if (companyIndicators.test(text)) return false;

    return text.split(/\s+/).length <= 8;
  }

  isLikelyCompany(value) {
    if (!value || typeof value !== 'string') return false;

    const text = this.cleanText(value);
    if (!text || text.length < 2 || text.length > 100) return false;
    if (this.looksLikeRole(text)) return false;
    if (/linkedin|followers|connections|yrs|mos|contact info/i.test(text)) return false;
    if (/^[0-9]+$/.test(text)) return false;
    if (/[@|]/.test(text)) return false;

    const suspiciousPatterns = [
      /^(full-time|part-time|contract|freelance|self-employed)$/i,
      /^\d{4}\s*-\s*(present|current|\d{4})$/i,
      /^(he\/him|she\/her|they\/them)$/i,
      /^[\u00B7\u2022]\s/i,
    ];
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) return false;
    }

    if (/^(building|helping|working|creating|driving|leading|enabling|empowering)\b/i.test(text)) {
      return false;
    }

    const genericSingleWord = new Set([
      'investments',
      'operations',
      'consulting',
      'marketing',
      'sales',
      'finance',
      'platform',
      'logistics',
      'analytics',
      'engineering',
      'support',
    ]);
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length === 1 && genericSingleWord.has(tokens[0].toLowerCase())) {
      return false;
    }

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
    return /\b(university|school|college|institute|academy|faculty|iit|nit|iiit|iim|bits|iisc)\b/i.test(text);
  }

  extractEducationRaw() {
    // Tier 1: JSON-LD alumniOf / affiliation
    const jsonLd = this.extractFromJsonLd();
    const alumniOf = jsonLd?.alumniOf;
    if (alumniOf) {
      const inst = this.cleanText(
        typeof alumniOf === 'string' ? alumniOf : alumniOf?.name || ''
      );
      if (inst) return { institution: inst, source: 'json-ld' };
    }

    // Tier 2: Education section DOM
    const eduSection = document.querySelector(
      'section#education, section[id*="education"], section[aria-label*="Education"]'
    );
    if (eduSection) {
      const firstItem = eduSection.querySelector('li, div[class*="pvs-list__item"]');
      if (firstItem) {
        for (const span of firstItem.querySelectorAll('span[aria-hidden="true"]')) {
          const text = this.cleanText(span.textContent || '');
          if (text && this.looksLikeEducation(text)) {
            return { institution: text, source: 'education-section' };
          }
        }
      }
    }

    // Tier 3: Headline "at IIT Bombay" pattern
    const headline = this.getHeadlineText();
    const match = headline.match(/\bat\s+([A-Z][^|,·\n]{3,60})(?:\s*[|,·]|$)/i);
    if (match?.[1] && this.looksLikeEducation(match[1])) {
      return { institution: this.cleanText(match[1]), source: 'headline' };
    }

    return null;
  }

  detectProfileType() {
    const headline = (this.getHeadlineText() || '').toLowerCase();
    const hasCompany = Boolean(this._lastExtractedProfile?.company?.name);
    const hasEducation = Boolean(this._pendingEducation?.institution);

    const STUDENT_SIGNALS = [
      /\bstudent\b/i, /\bstudying\b/i, /\bpursuing\b/i,
      /\bundergrad\b/i, /\bphd\b/i, /\bpostgrad\b/i,
      /\b(?:b\.?tech|b\.?e\.|m\.?tech|bsc|msc|mba)\b(?:\s+student)?/i,
      /class of \d{4}/i,
      /\d(?:st|nd|rd|th)\s+year\b/i,
    ];
    const FREELANCE_SIGNALS = [/\bfreelance/i, /\bself[- ]?employed/i];

    if (STUDENT_SIGNALS.some(r => r.test(headline)) || (hasEducation && !hasCompany)) {
      return { type: 'STUDENT', confidence: 0.85 };
    }
    if (FREELANCE_SIGNALS.some(r => r.test(headline)) && !hasCompany) {
      return { type: 'FREELANCER', confidence: 0.75 };
    }
    if (hasCompany) {
      return { type: 'PROFESSIONAL', confidence: 0.9 };
    }
    return { type: 'UNKNOWN', confidence: 0.3 };
  }

  _testSelectors(selectors) {
    return selectors.map(sel => {
      try {
        const el = document.querySelector(sel);
        return { selector: sel, found: Boolean(el), text: el?.textContent?.trim().slice(0, 80) || null };
      } catch {
        return { selector: sel, found: false, text: null, error: 'invalid selector' };
      }
    });
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

  if (message.type === 'EXTRACT_PROFILE') {
    handleExtraction(message, sendResponse);
    return true;
  }

  if (message.type === 'EXTRACT_COMPANY_PAGE_URL') {
    handleCompanyPageUrlExtraction(message, sendResponse);
    return false;
  }
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

function handleCompanyPageUrlExtraction(message, sendResponse) {
  try {
    const CompanyExtractorClass =
      typeof window !== 'undefined' ? window.LinkedInCompanyExtractor : null;

    if (typeof CompanyExtractorClass !== 'function') {
      sendResponse({
        companyName: String(message?.companyName || '').trim(),
        companyPageUrl: null,
        extractionMethod: 'extractor-unavailable',
        confidence: 0,
        isCurrent: false,
      });
      return;
    }

    const extractor = new CompanyExtractorClass(message?.debug === true);
    const result = extractor.extractCompanyWebsite(String(message?.companyName || '').trim());
    sendResponse(result);
  } catch (error) {
    console.error('[LinkedInExtractor] Company page extraction failed:', error);
    sendResponse({
      companyName: String(message?.companyName || '').trim(),
      companyPageUrl: null,
      extractionMethod: 'failed',
      confidence: 0,
      isCurrent: false,
      error: error?.message || 'Unknown company extraction error',
    });
  }
}

console.log('[LinkedInExtractor] Ready');

