// tests/extension/dom-waiter.test.js
const fs = require('fs');
const path = require('path');

// Jest JSDOM environment provides window and document globals
// We don't need to manually define them, just mock what we need.

// Load the source file
const code = fs.readFileSync(path.resolve(__dirname, '../../extension/utils/dom-waiter.js'), 'utf8');
// Execute in the current scope (which has JSDOM window/document)
eval(code);

const domWaiter = window.EllynDomWaiter;

describe('DomWaiter', () => {
  let querySelectorSpy;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on the real document.querySelector
    querySelectorSpy = jest.spyOn(document, 'querySelector');
    querySelectorSpy.mockReturnValue(null); // Default to not found
  });

  afterEach(() => {
    querySelectorSpy.mockRestore();
  });

  test('resolves true immediately if element exists', async () => {
    querySelectorSpy.mockReturnValue({}); // Element exists
    const promise = domWaiter.waitFor('.test-selector');
    
    // Should resolve immediately
    await expect(promise).resolves.toBe(true);
    expect(querySelectorSpy).toHaveBeenCalledWith('.test-selector');
  });

  test('polls and resolves true when element appears', async () => {
    // 1st check: null
    // 2nd check: null
    // 3rd check: element found
    querySelectorSpy
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({});

    const promise = domWaiter.waitFor('.test-selector', { interval: 100 });

    // Fast-forward time
    jest.advanceTimersByTime(100); // 1st retry
    jest.advanceTimersByTime(100); // 2nd retry

    await expect(promise).resolves.toBe(true);
    expect(querySelectorSpy).toHaveBeenCalledTimes(3);
  });

  test('resolves false after timeout', async () => {
    querySelectorSpy.mockReturnValue(null); // Never found

    const promise = domWaiter.waitFor('.test-selector', { timeout: 1000, interval: 200 });

    // Advance past timeout
    jest.advanceTimersByTime(1000 + 50);

    await expect(promise).resolves.toBe(false);
  });

  test('handles array of selectors (ANY match)', async () => {
    querySelectorSpy.mockImplementation((sel) => {
      if (sel === '.match-me') return {};
      return null;
    });

    const promise = domWaiter.waitFor(['.wrong', '.match-me']);
    
    await expect(promise).resolves.toBe(true);
    expect(querySelectorSpy).toHaveBeenCalledWith('.wrong');
    expect(querySelectorSpy).toHaveBeenCalledWith('.match-me');
  });

  test('never throws error', async () => {
    // Simulate DOM API crash
    querySelectorSpy.mockImplementation(() => {
      throw new Error('DOM Error');
    });

    const promise = domWaiter.waitFor('.crash-test');
    
    // Should return false, not throw
    await expect(promise).resolves.toBe(false);
  });
});