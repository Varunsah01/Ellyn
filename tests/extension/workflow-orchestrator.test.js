// tests/extension/workflow-orchestrator.test.js
const fs = require('fs');
const path = require('path');

// Mock browser environment
const window = { location: { href: 'https://linkedin.com/in/test' } };
global.window = window;
global.self = window;
global.document = { querySelector: jest.fn() };

// 1. Mock Dependencies
const mockPageDetector = { detectEligibility: jest.fn() };
const mockDomWaiter = { waitForProfileReady: jest.fn() };
const mockNameExtractor = { extract: jest.fn() };
const mockConfidenceEngine = { evaluate: jest.fn() };

// Inject mocks
window.EllynPageDetector = mockPageDetector;
window.EllynDomWaiter = mockDomWaiter;
window.EllynNameExtractor = mockNameExtractor;
window.EllynConfidenceEngine = mockConfidenceEngine;

// Load Source
const code = fs.readFileSync(path.resolve(__dirname, '../../extension/utils/workflow-orchestrator.js'), 'utf8');
eval(code);

const orchestrator = window.EllynWorkflowOrchestrator;

describe('WorkflowOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default happy path
    mockPageDetector.detectEligibility.mockReturnValue({ eligible: true });
    mockDomWaiter.waitForProfileReady.mockResolvedValue(true);
    mockNameExtractor.extract.mockReturnValue({ value: 'Test User', confidence: 90 });
    mockConfidenceEngine.evaluate.mockReturnValue({ action: 'AUTO_CONTINUE' });
  });

  test('returns SUCCESS on happy path', async () => {
    const result = await orchestrator.run();
    
    expect(result.status).toBe('success');
    expect(result.error).toBeNull();
    expect(mockPageDetector.detectEligibility).toHaveBeenCalled();
    expect(mockDomWaiter.waitForProfileReady).toHaveBeenCalled();
    expect(mockNameExtractor.extract).toHaveBeenCalled();
    expect(mockConfidenceEngine.evaluate).toHaveBeenCalled();
  });

  test('returns BLOCKED if page is ineligible', async () => {
    mockPageDetector.detectEligibility.mockReturnValue({ eligible: false, reason: 'Not Profile' });
    
    const result = await orchestrator.run();
    
    expect(result.status).toBe('blocked');
    expect(result.error).toBe('Not Profile');
    expect(mockDomWaiter.waitForProfileReady).not.toHaveBeenCalled(); // Should short-circuit
  });

  test('returns BLOCKED if DOM wait times out', async () => {
    mockDomWaiter.waitForProfileReady.mockResolvedValue(false);
    
    const result = await orchestrator.run();
    
    expect(result.status).toBe('blocked');
    expect(result.error).toBe('DOM readiness timeout');
    expect(mockNameExtractor.extract).not.toHaveBeenCalled(); // Should short-circuit
  });

  test('returns BLOCKED if ConfidenceEngine blocks', async () => {
    mockConfidenceEngine.evaluate.mockReturnValue({ 
      action: 'BLOCK', 
      reasons: ['Name too short'] 
    });
    
    const result = await orchestrator.run();
    
    expect(result.status).toBe('blocked');
    expect(result.error).toContain('Name too short');
  });

  test('returns PARTIAL if confirmation required', async () => {
    mockConfidenceEngine.evaluate.mockReturnValue({ 
      action: 'REQUIRE_CONFIRMATION', 
      lowConfidenceFields: ['company'] 
    });
    
    const result = await orchestrator.run();
    
    expect(result.status).toBe('partial');
    expect(result.decision.action).toBe('REQUIRE_CONFIRMATION');
  });
});
