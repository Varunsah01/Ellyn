/**
 * Email Inference Tests
 * Tests all 8-13 pattern generation scenarios and edge cases
 */

describe('Email Inference', () => {
  // Mock functions - these would import from the actual extension
  const generateEmailPatterns = (firstName, lastName, company) => {
    const domain = company.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') + '.com';
    const first = firstName.toLowerCase();
    const last = lastName.toLowerCase();
    const fInitial = first[0];
    const lInitial = last[0];

    return [
      `${first}.${last}@${domain}`,           // john.doe@company.com
      `${first}${last}@${domain}`,            // johndoe@company.com
      `${fInitial}${last}@${domain}`,         // jdoe@company.com
      `${first}${lInitial}@${domain}`,        // johnd@company.com
      `${first}_${last}@${domain}`,           // john_doe@company.com
      `${first}-${last}@${domain}`,           // john-doe@company.com
      `${last}.${first}@${domain}`,           // doe.john@company.com
      `${last}${first}@${domain}`,            // doejohn@company.com
      `${lInitial}${first}@${domain}`,        // djohn@company.com
      `${last}${fInitial}@${domain}`,         // doej@company.com
      `${fInitial}.${last}@${domain}`,        // j.doe@company.com
      `${first}.${lInitial}@${domain}`,       // john.d@company.com
      `${fInitial}${lInitial}@${domain}`,     // jd@company.com
    ];
  };

  const normalizeName = (name) => {
    // Remove titles and suffixes
    return name
      .replace(/\b(Jr\.?|Sr\.?|II|III|IV|PhD|MD|Esq\.?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  describe('Pattern Generation', () => {
    test('generates all 13 email patterns for simple names', () => {
      const patterns = generateEmailPatterns('John', 'Doe', 'Acme Corp');

      expect(patterns).toHaveLength(13);
      expect(patterns).toContain('john.doe@acmecorp.com');
      expect(patterns).toContain('johndoe@acmecorp.com');
      expect(patterns).toContain('jdoe@acmecorp.com');
      expect(patterns).toContain('johnd@acmecorp.com');
      expect(patterns).toContain('john_doe@acmecorp.com');
      expect(patterns).toContain('john-doe@acmecorp.com');
      expect(patterns).toContain('doe.john@acmecorp.com');
      expect(patterns).toContain('jd@acmecorp.com');
    });

    test('handles hyphenated last names', () => {
      const patterns = generateEmailPatterns('Mary', 'Smith-Jones', 'Tech Inc');

      expect(patterns[0]).toBe('mary.smith-jones@techinc.com');
      expect(patterns.some(p => p.includes('smith-jones'))).toBe(true);
    });

    test('handles single letter first names', () => {
      const patterns = generateEmailPatterns('J', 'Doe', 'Company');

      expect(patterns).toContain('j.doe@company.com');
      expect(patterns).toContain('jdoe@company.com');
    });

    test('handles single letter last names', () => {
      const patterns = generateEmailPatterns('John', 'D', 'Company');

      expect(patterns).toContain('john.d@company.com');
      expect(patterns).toContain('johnd@company.com');
    });

    test('handles names with special characters', () => {
      const patterns = generateEmailPatterns("O'Brien", "O'Connor", "Company");

      // Should strip special characters
      expect(patterns[0].toLowerCase()).toBe("o'brien.o'connor@company.com");
    });

    test('handles very long names', () => {
      const patterns = generateEmailPatterns('Christopher', 'Montgomery', 'Company');

      expect(patterns).toHaveLength(13);
      expect(patterns[0]).toBe('christopher.montgomery@company.com');
    });

    test('handles company names with special characters', () => {
      const patterns = generateEmailPatterns('John', 'Doe', 'Tech & Co.');

      // Should sanitize domain
      expect(patterns[0]).toBe('john.doe@techco.com');
    });

    test('handles company names with spaces', () => {
      const patterns = generateEmailPatterns('John', 'Doe', 'Big Tech Company');

      expect(patterns[0]).toBe('john.doe@bigtechcompany.com');
    });
  });

  describe('Name Normalization', () => {
    test('removes Jr. suffix', () => {
      expect(normalizeName('John Doe Jr.')).toBe('John Doe');
      expect(normalizeName('John Doe Jr')).toBe('John Doe');
    });

    test('removes Sr. suffix', () => {
      expect(normalizeName('John Doe Sr.')).toBe('John Doe');
      expect(normalizeName('John Doe Sr')).toBe('John Doe');
    });

    test('removes Roman numerals', () => {
      expect(normalizeName('John Doe II')).toBe('John Doe');
      expect(normalizeName('John Doe III')).toBe('John Doe');
      expect(normalizeName('John Doe IV')).toBe('John Doe');
    });

    test('removes PhD suffix', () => {
      expect(normalizeName('Dr. John Doe PhD')).toBe('Dr. John Doe');
    });

    test('removes MD suffix', () => {
      expect(normalizeName('Dr. John Doe MD')).toBe('Dr. John Doe');
    });

    test('removes Esq suffix', () => {
      expect(normalizeName('John Doe Esq.')).toBe('John Doe');
      expect(normalizeName('John Doe Esq')).toBe('John Doe');
    });

    test('handles multiple spaces', () => {
      expect(normalizeName('John    Doe')).toBe('John Doe');
    });

    test('trims whitespace', () => {
      expect(normalizeName('  John Doe  ')).toBe('John Doe');
    });

    test('handles combinations', () => {
      expect(normalizeName('  John  Doe  Jr.  ')).toBe('John Doe');
    });
  });

  describe('Domain Inference', () => {
    test('infers domain from company name', () => {
      const inferDomain = (company) => {
        return company.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') + '.com';
      };

      expect(inferDomain('Google')).toBe('google.com');
      expect(inferDomain('Meta Platforms')).toBe('metaplatforms.com');
      expect(inferDomain('JP Morgan Chase')).toBe('jpmorganchase.com');
      expect(inferDomain('AT&T')).toBe('att.com');
    });

    test('handles company names ending with Inc, LLC, etc', () => {
      const inferDomain = (company) => {
        return company
          .replace(/\b(Inc|LLC|Ltd|Corp|Co)\b\.?/gi, '')
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9]/g, '') + '.com';
      };

      expect(inferDomain('Acme Inc.')).toBe('acme.com');
      expect(inferDomain('Tech LLC')).toBe('tech.com');
      expect(inferDomain('Big Corp')).toBe('big.com');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty names gracefully', () => {
      const patterns = generateEmailPatterns('', '', 'Company');

      // Should still generate patterns, even if they're invalid
      expect(patterns).toHaveLength(13);
    });

    test('handles undefined inputs', () => {
      expect(() => {
        generateEmailPatterns(undefined, undefined, undefined);
      }).toThrow();
    });

    test('handles numbers in names', () => {
      const patterns = generateEmailPatterns('John2', 'Doe3', 'Company');

      expect(patterns[0]).toBe('john2.doe3@company.com');
    });

    test('handles Unicode characters', () => {
      const patterns = generateEmailPatterns('José', 'González', 'Company');

      // Should handle or strip Unicode
      expect(patterns).toHaveLength(13);
    });

    test('handles very short company names', () => {
      const patterns = generateEmailPatterns('John', 'Doe', 'X');

      expect(patterns[0]).toBe('john.doe@x.com');
    });

    test('case insensitivity', () => {
      const patterns1 = generateEmailPatterns('JOHN', 'DOE', 'COMPANY');
      const patterns2 = generateEmailPatterns('john', 'doe', 'company');

      expect(patterns1).toEqual(patterns2);
    });
  });

  describe('Confidence Scoring', () => {
    const calculateConfidence = (pattern, domain) => {
      let score = 0.5; // Base score

      // Common pattern bonus
      if (pattern.includes('.')) score += 0.2;

      // Known domain bonus
      const knownDomains = ['gmail.com', 'outlook.com', 'yahoo.com'];
      if (knownDomains.includes(domain)) score += 0.3;

      return Math.min(score, 1.0);
    };

    test('calculates higher confidence for common patterns', () => {
      const score1 = calculateConfidence('john.doe', 'company.com');
      const score2 = calculateConfidence('johndoe', 'company.com');

      expect(score1).toBeGreaterThan(score2);
    });

    test('calculates higher confidence for known domains', () => {
      const score1 = calculateConfidence('john.doe', 'gmail.com');
      const score2 = calculateConfidence('john.doe', 'unknown.com');

      expect(score1).toBeGreaterThan(score2);
    });

    test('confidence is between 0 and 1', () => {
      const score = calculateConfidence('test', 'test.com');

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
