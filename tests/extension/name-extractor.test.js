// tests/extension/name-extractor.test.js
const fs = require('fs');
const path = require('path');

// Mock NameNormalizer
window.EllynNameNormalizer = {
  normalizeName: (text) => ({ fullName: text.trim(), confidence: 100 })
};

// Load the source file
const code = fs.readFileSync(path.resolve(__dirname, '../../extension/extractors/name-extractor.js'), 'utf8');
eval(code);

const extractor = window.EllynNameExtractor;

describe('NameExtractor', () => {
  let querySelectorSpy;
  let createTreeWalkerSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup spies
    querySelectorSpy = jest.spyOn(document, 'querySelector');
    createTreeWalkerSpy = jest.spyOn(document, 'createTreeWalker');

    // Default behavior: nothing found
    querySelectorSpy.mockReturnValue(null);
    createTreeWalkerSpy.mockReturnValue({
      nextNode: jest.fn().mockReturnValue(null)
    });
    document.title = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns null if nothing found', () => {
    const result = extractor.extract(document);
    expect(result.value).toBeNull();
    expect(result.confidence).toBe(0);
  });

  test('extracts from H1 (High Confidence)', () => {
    const mockH1 = document.createElement('h1');
    mockH1.innerText = 'Reid Hoffman';
    
    querySelectorSpy.mockImplementation((selector) => {
      if (selector === 'h1.text-heading-xlarge') return mockH1;
      return null;
    });

    // Mock TreeWalker for this specific element
    createTreeWalkerSpy.mockReturnValue({
      nextNode: jest.fn()
        .mockReturnValueOnce({ textContent: 'Reid Hoffman' })
        .mockReturnValueOnce(null)
    });

    const result = extractor.extract(document);
    expect(result.value).toBe('Reid Hoffman');
    expect(result.confidence).toBe(95);
    expect(result.source).toBe('dom');
  });

  test('extracts from secondary H1 strategy', () => {
    const mockH1 = document.createElement('h1');
    mockH1.innerText = 'Satya Nadella';
    
    querySelectorSpy.mockImplementation((selector) => {
      if (selector === '.pv-text-details--left-aligned h1') return mockH1;
      return null;
    });

    createTreeWalkerSpy.mockReturnValue({
      nextNode: jest.fn()
        .mockReturnValueOnce({ textContent: 'Satya Nadella' })
        .mockReturnValueOnce(null)
    });

    const result = extractor.extract(document);
    expect(result.value).toBe('Satya Nadella');
    expect(result.confidence).toBe(90);
  });

  test('extracts from meta tag (fallback)', () => {
    const mockMeta = document.createElement('meta');
    mockMeta.content = 'Bill Gates | LinkedIn';
    
    querySelectorSpy.mockImplementation((selector) => {
      if (selector === 'meta[property="og:title"]') return mockMeta;
      return null;
    });

    const result = extractor.extract(document);
    expect(result.value).toBe('Bill Gates');
    expect(result.confidence).toBe(60);
    expect(result.source).toBe('meta');
  });

  test('extracts from document title (last resort)', () => {
    document.title = '(3) Jeff Weiner | LinkedIn';
    
    const result = extractor.extract(document);
    expect(result.value).toBe('Jeff Weiner');
    expect(result.confidence).toBe(50);
    expect(result.source).toBe('fallback');
  });

  test('handles exceptions gracefully', () => {
    querySelectorSpy.mockImplementation(() => {
      throw new Error('DOM Access Error');
    });

    const result = extractor.extract(document);
    expect(result.value).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.source).toBe('fallback');
  });

  test('uses TreeWalker for clean text extraction', () => {
    const mockElement = document.createElement('div');
    mockElement.innerText = 'Bad Text';

    querySelectorSpy.mockReturnValue(mockElement);
    
    createTreeWalkerSpy.mockReturnValue({
      nextNode: jest.fn()
        .mockReturnValueOnce({ textContent: 'Clean ' })
        .mockReturnValueOnce({ textContent: 'Name' })
        .mockReturnValueOnce(null)
    });

    const result = extractor.extract(document);
    expect(result.value).toBe('Clean Name');
  });
});