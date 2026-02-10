// tests/extension/name-normalizer.test.js
const fs = require('fs');
const path = require('path');

// Mock browser environment
const window = {};
global.window = window;

// Load the source file
const code = fs.readFileSync(path.resolve(__dirname, '../../extension/utils/name-normalizer.js'), 'utf8');
eval(code);

const { normalizeName } = window.EllynNameNormalizer;

describe('NameNormalizer', () => {
  test('handles standard names', () => {
    const result = normalizeName('Karthik Gowda');
    expect(result.fullName).toBe('Karthik Gowda');
    expect(result.firstName).toBe('Karthik');
    expect(result.lastName).toBe('Gowda');
    expect(result.confidence).toBe(100);
  });

  test('strips hex/numeric suffixes (pollution)', () => {
    const result = normalizeName('Karthik Gowda 1105601aa');
    expect(result.fullName).toBe('Karthik Gowda');
    expect(result.lastName).toBe('Gowda');
    expect(result.rawName).toContain('1105601aa');
  });

  test('strips complex IDs', () => {
    const result = normalizeName('Surendra N Reddy C 0b22494a');
    expect(result.fullName).toBe('Surendra N Reddy C');
    expect(result.lastName).toBe('N Reddy C'); // Middle initials handling
  });

  test('strips titles', () => {
    const result = normalizeName('Dr. Sarah Connor');
    expect(result.fullName).toBe('Sarah Connor');
    expect(result.firstName).toBe('Sarah');
  });

  test('handles multi-line whitespace', () => {
    const result = normalizeName('  John\n   Doe  ');
    expect(result.fullName).toBe('John Doe');
  });

  test('rejects purely numeric/hex strings', () => {
    const result = normalizeName('0b22494a');
    expect(result.fullName).toBe('');
    expect(result.confidence).toBe(0);
  });

  test('handles initials correctly', () => {
    const result = normalizeName('John F. Kennedy');
    expect(result.fullName).toBe('John F. Kennedy');
  });

  test('returns 0 confidence for invalid content', () => {
    const result = normalizeName('12345 67890');
    expect(result.confidence).toBe(0);
  });
});