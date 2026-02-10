// tests/extension/confidence-engine.test.js
const fs = require('fs');
const path = require('path');

// Mock browser environment
const window = {};
global.window = window;
global.self = window;

// Load the source file
const code = fs.readFileSync(path.resolve(__dirname, '../../extension/utils/confidence-engine.js'), 'utf8');
eval(code);

const engine = window.EllynConfidenceEngine;

describe('ConfidenceEngine', () => {
  const highConfName = { value: 'John Doe', confidence: 95, source: 'dom' };
  const lowConfName = { value: 'John', confidence: 50, source: 'fallback' };
  const highConfCompany = { value: 'Google', confidence: 90, source: 'dom' };
  const lowConfCompany = { value: 'Tech Inc', confidence: 40, source: 'meta' };
  
  test('returns AUTO_CONTINUE when all fields meet thresholds', () => {
    const fields = {
      name: highConfName,
      company: highConfCompany
    };
    
    const result = engine.evaluate(fields);
    expect(result.action).toBe('AUTO_CONTINUE');
    expect(result.missingFields).toHaveLength(0);
    expect(result.lowConfidenceFields).toHaveLength(0);
  });

  test('returns REQUIRE_CONFIRMATION when a field is below auto-continue threshold', () => {
    const fields = {
      name: highConfName,
      company: lowConfCompany // 40 < 70
    };
    
    const result = engine.evaluate(fields);
    expect(result.action).toBe('REQUIRE_CONFIRMATION');
    expect(result.lowConfidenceFields).toContain('company');
  });

  test('returns BLOCK when a required field is missing', () => {
    const fields = {
      name: highConfName
      // company missing
    };
    
    const result = engine.evaluate(fields);
    expect(result.action).toBe('BLOCK');
    expect(result.missingFields).toContain('company');
  });

  test('returns BLOCK when a field is below block threshold', () => {
    const garbageName = { value: '...', confidence: 5, source: 'fallback' }; // 5 < 10
    
    const fields = {
      name: garbageName,
      company: highConfCompany
    };
    
    const result = engine.evaluate(fields);
    expect(result.action).toBe('BLOCK');
    expect(result.reasons[0]).toContain('Critical confidence failure');
  });

  test('handles mixed scenarios (low confidence + high confidence)', () => {
    const fields = {
      name: lowConfName,    // 50 < 80 -> Low Conf
      company: highConfCompany
    };
    
    const result = engine.evaluate(fields);
    expect(result.action).toBe('REQUIRE_CONFIRMATION');
    expect(result.lowConfidenceFields).toContain('name');
    expect(result.lowConfidenceFields).not.toContain('company');
  });
});
