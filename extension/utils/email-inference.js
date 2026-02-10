// Email Inference Engine
// Generates email pattern candidates from name + company with confidence scores

(function(window) {
  class EmailInference {
    constructor() {
      // Common email patterns ordered by prevalence
      this.patterns = [
        { id: 'first.last',       format: (f, l) => `${f}.${l}`,           label: 'first.last',       baseConfidence: 85 },
        { id: 'firstlast',        format: (f, l) => `${f}${l}`,            label: 'firstlast',        baseConfidence: 70 },
        { id: 'first_last',       format: (f, l) => `${f}_${l}`,           label: 'first_last',       baseConfidence: 55 },
        { id: 'flast',            format: (f, l) => `${f[0]}${l}`,         label: 'flast',            baseConfidence: 75 },
        { id: 'first',            format: (f, l) => `${f}`,                label: 'first',            baseConfidence: 50 },
        { id: 'f.last',           format: (f, l) => `${f[0]}.${l}`,        label: 'f.last',           baseConfidence: 65 },
        { id: 'firstl',           format: (f, l) => `${f}${l[0]}`,         label: 'firstl',           baseConfidence: 45 },
        { id: 'last.first',       format: (f, l) => `${l}.${f}`,           label: 'last.first',       baseConfidence: 40 },
        { id: 'lastf',            format: (f, l) => `${l}${f[0]}`,         label: 'lastf',            baseConfidence: 35 },
        { id: 'last',             format: (f, l) => `${l}`,                label: 'last',             baseConfidence: 30 },
      ];

      // Known company domain mappings (common overrides)
      this.knownDomains = {
        'google': 'google.com',
        'alphabet': 'google.com',
        'microsoft': 'microsoft.com',
        'amazon': 'amazon.com',
        'apple': 'apple.com',
        'meta': 'meta.com',
        'facebook': 'meta.com',
        'netflix': 'netflix.com',
        'salesforce': 'salesforce.com',
        'oracle': 'oracle.com',
        'ibm': 'ibm.com',
        'adobe': 'adobe.com',
        'spotify': 'spotify.com',
        'uber': 'uber.com',
        'airbnb': 'airbnb.com',
        'stripe': 'stripe.com',
        'shopify': 'shopify.com',
        'slack': 'slack.com',
        'zoom': 'zoom.us',
        'twitter': 'x.com',
        'x': 'x.com',
        'linkedin': 'linkedin.com',
        'tesla': 'tesla.com',
        'nvidia': 'nvidia.com',
        'intel': 'intel.com',
        'cisco': 'cisco.com',
        'vmware': 'vmware.com',
        'hubspot': 'hubspot.com',
        'datadog': 'datadoghq.com',
        'twilio': 'twilio.com',
        'cloudflare': 'cloudflare.com',
        'square': 'squareup.com',
        'block': 'block.xyz',
        'paypal': 'paypal.com',
        'deloitte': 'deloitte.com',
        'mckinsey': 'mckinsey.com',
        'bain': 'bain.com',
        'bcg': 'bcg.com',
        'goldman sachs': 'gs.com',
        'morgan stanley': 'morganstanley.com',
        'jpmorgan': 'jpmorgan.com',
        'jp morgan': 'jpmorgan.com',
      };
    }

    /**
     * Generate email candidates for a contact
     * @param {Object} contact - { firstName, lastName, company }
     * @returns {Array<{email, pattern, confidence}>}
     */
    generatePatterns(contact) {
      const { firstName, lastName, company } = contact;

      if (!firstName || !company) {
        return [];
      }

      const domain = this.inferDomain(company);
      if (!domain) return [];

      const f = this.sanitize(firstName);
      const l = lastName ? this.sanitize(lastName) : '';

      if (!f) return [];

      const results = [];

      for (const pattern of this.patterns) {
        // Skip last-name patterns if no last name
        if (!l && pattern.id.includes('last')) continue;

        try {
          const local = pattern.format(f, l);
          if (!local || local.length < 2) continue;

          const email = `${local}@${domain}`;
          let confidence = pattern.baseConfidence;

          // Boost confidence for known domains
          if (this.isKnownDomain(company)) {
            confidence = Math.min(confidence + 5, 95);
          }

          results.push({
            email,
            pattern: pattern.label,
            confidence,
            domain,
          });
        } catch {
          // Skip patterns that fail (e.g., empty last name index)
          continue;
        }
      }

      // Sort by confidence descending
      results.sort((a, b) => b.confidence - a.confidence);

      // Return top patterns
      return results.slice(0, 5);
    }

    /**
     * Infer company domain from company name
     */
    inferDomain(company) {
      if (!company) return null;

      const normalized = company.toLowerCase().trim();

      // Check known mappings first
      if (this.knownDomains[normalized]) {
        return this.knownDomains[normalized];
      }

      // Check partial matches (e.g., "Google LLC" -> "google")
      for (const [key, domain] of Object.entries(this.knownDomains)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          return domain;
        }
      }

      // Generate from company name
      const cleaned = normalized
        .replace(/\b(inc|corp|ltd|llc|co|company|group|holdings|technologies|tech|software|solutions|consulting|services|international|global)\b\.?/gi, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '');

      if (!cleaned) return null;

      return `${cleaned}.com`;
    }

    /**
     * Check if company has a known domain
     */
    isKnownDomain(company) {
      const normalized = company.toLowerCase().trim();
      return Object.keys(this.knownDomains).some(
        key => normalized.includes(key) || key.includes(normalized)
      );
    }

    /**
     * Sanitize name for email: lowercase, remove accents, keep alphanumeric
     */
    sanitize(name) {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9]/g, '')       // Keep only alphanumeric
        .trim();
    }
  }

  // Export singleton
  window.EllynEmailInference = new EmailInference();
})(window);
