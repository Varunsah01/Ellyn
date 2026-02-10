// tests/extension/page-detector.test.js
const fs = require('fs');
const path = require('path');

// Mock browser environment
const window = {};
global.window = window;

// Load the source file
const code = fs.readFileSync(path.resolve(__dirname, '../../extension/utils/page-detector.js'), 'utf8');
eval(code);

const pageDetector = window.EllynPageDetector;

describe('PageDetector', () => {
  test('detects valid LinkedIn profile URL', () => {
    const result = pageDetector.detectEligibility('https://www.linkedin.com/in/reidhoffman/');
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test('detects valid LinkedIn profile URL without www', () => {
    const result = pageDetector.detectEligibility('https://linkedin.com/in/reidhoffman');
    expect(result.eligible).toBe(true);
  });

  test('detects valid LinkedIn profile URL with query params', () => {
    const result = pageDetector.detectEligibility('https://www.linkedin.com/in/karthikgowda/?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAA...');
    expect(result.eligible).toBe(true);
  });

  test('rejects non-profile LinkedIn pages', () => {
    const result = pageDetector.detectEligibility('https://www.linkedin.com/feed/');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('NOT_PROFILE_PAGE');
  });

  test('rejects LinkedIn company pages', () => {
    const result = pageDetector.detectEligibility('https://www.linkedin.com/company/google/');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('NOT_PROFILE_PAGE');
  });

  test('rejects non-LinkedIn URLs', () => {
    const result = pageDetector.detectEligibility('https://github.com/in/someone');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('UNSUPPORTED_CONTEXT');
  });

  test('handles invalid URL strings gracefully', () => {
    const result = pageDetector.detectEligibility('not-a-url');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('UNSUPPORTED_CONTEXT');
  });

  test('handles null or empty input without throwing', () => {
    expect(() => pageDetector.detectEligibility(null)).not.toThrow();
    expect(pageDetector.detectEligibility(null).eligible).toBe(false);
    expect(pageDetector.detectEligibility('').eligible).toBe(false);
  });

  test('detects profile URL with /in/ but no trailing slash', () => {
    const result = pageDetector.detectEligibility('https://www.linkedin.com/in/username');
    expect(result.eligible).toBe(true);
  });

  test('rejects path starting with /ins (not /in/)', () => {
    // This is unlikely but good for testing startsWith('/in/')
    const result = pageDetector.detectEligibility('https://www.linkedin.com/instructors/');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('NOT_PROFILE_PAGE');
  });
});
