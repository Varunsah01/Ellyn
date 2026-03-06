/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');

describe('extension quota guard regression checks', () => {
  test('background script keeps credit limits enabled and avoids stale payload references', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'extension/background.js'),
      'utf8'
    );

    expect(source).toContain('DISABLE_CREDIT_LIMITS: false');
    expect(source).not.toContain('Credit limits disabled');
    expect(source).not.toContain('payload?.tabId');
  });
});
