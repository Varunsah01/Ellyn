# Testing Guide

Comprehensive testing documentation for Ellyn.

## Table of Contents


1. [Quick Start](#quick-start)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [CI/CD Integration](#cicd-integration)
6. [Best Practices](#best-practices)

## Test Runner Policy

Ellyn standardizes on a single JavaScript test runner:

- **Jest** runs unit, component, and API integration tests.
- **Playwright** runs end-to-end browser tests.
- **Vitest is not used in this repository.**

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run unit tests only
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui
```

## Test Structure

```
tests/
├── extension/               # Extension unit tests
│   ├── email-inference.test.js
│   └── linkedin-extraction.test.js
├── api/                     # API integration tests
│   ├── analytics.test.ts
│   ├── contacts.test.ts
│   └── sequences.test.ts
├── components/              # Component tests
│   ├── analytics/
│   │   ├── overview-metrics.test.tsx
│   │   └── time-series-charts.test.tsx
│   └── contacts/
│       └── contacts-table.test.tsx
└── e2e/                     # End-to-end tests
    ├── dashboard-flow.spec.ts
    ├── extension-sync.spec.ts
    └── analytics.spec.ts
```

## Running Tests

### Unit Tests (Jest)

```bash
# Run all unit tests
npm test

# Run specific test file
npm test email-inference

# Run tests matching pattern
npm test analytics

# Watch mode (reruns on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Update snapshots
npm test -- -u

# Verbose output
npm test -- --verbose
```

### Component Tests (React Testing Library)

```bash
# Run component tests
npm test components/

# Debug specific component
npm test overview-metrics -- --watch

# With coverage
npm test components/ -- --coverage
```

### API Tests (Supertest)

```bash
# Run API tests
npm test api/

# Run specific API test
npm test api/analytics

# With environment variables
NEXT_PUBLIC_SUPABASE_URL=test npm test api/
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run in UI mode (interactive)
npm run test:e2e:ui

# Debug mode (step through)
npm run test:e2e:debug

# Run specific browser
npm run test:e2e -- --project=chromium

# Run specific test file
npm run test:e2e dashboard-flow

# Headed mode (see browser)
npm run test:e2e -- --headed

# Generate report
npm run test:e2e -- --reporter=html
```

## Writing Tests

### Extension Unit Tests

```javascript
// tests/extension/email-inference.test.js

describe('Email Inference', () => {
  test('generates all 13 email patterns', () => {
    const patterns = generateEmailPatterns('John', 'Doe', 'Acme Corp');

    expect(patterns).toHaveLength(13);
    expect(patterns).toContain('john.doe@acmecorp.com');
    expect(patterns).toContain('jdoe@acmecorp.com');
  });

  test('handles edge cases', () => {
    // Test hyphenated names, apostrophes, etc.
  });
});
```

### API Integration Tests

```typescript
// tests/api/analytics.test.ts

import { GET } from '@/app/api/analytics/route';
import { NextRequest } from 'next/server';

describe('Analytics API', () => {
  test('returns overview metrics', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/analytics?metric=overview'
    );

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toHaveProperty('totalContacts');
  });
});
```

### Component Tests

```tsx
// tests/components/analytics/overview-metrics.test.tsx

import { render, screen } from '@testing-library/react';
import { OverviewMetrics } from '@/components/analytics/overview-metrics';

describe('OverviewMetrics', () => {
  const mockData = {
    totalContacts: 150,
    emailsSent: 120,
    replyRate: '32.5',
  };

  test('renders metric cards', () => {
    render(<OverviewMetrics data={mockData} loading={false} />);

    expect(screen.getByText('Total Contacts')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    render(<OverviewMetrics data={mockData} loading={true} />);

    // Should show skeletons
    expect(screen.queryByText('150')).not.toBeInTheDocument();
  });
});
```

### E2E Tests

```typescript
// tests/e2e/dashboard-flow.spec.ts

import { test, expect } from '@playwright/test';

test('complete user flow', async ({ page }) => {
  await page.goto('/dashboard');

  // Navigate to contacts
  await page.click('text=Contacts');
  await expect(page).toHaveURL(/.*contacts/);

  // Create new contact
  await page.click('text=Add Contact');
  await page.fill('[name="firstName"]', 'John');
  await page.fill('[name="lastName"]', 'Doe');
  await page.click('button[type="submit"]');

  // Verify success
  await expect(page.getByText(/contact added/i)).toBeVisible();
});
```

## Coverage Reports

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html  # Windows
xdg-open coverage/lcov-report/index.html  # Linux
```

### Coverage Thresholds

Configured in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

## Mocking

### Mocking Next.js Router

```javascript
// Automatically mocked in jest.setup.js
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
}));
```

### Mocking Supabase

```javascript
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));
```

### Mocking API Calls

```typescript
// In E2E tests
await page.route('**/api/analytics', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ data: mockData }),
  });
});
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests
- Manual workflow dispatch

Pipeline includes:
1. **Lint** - ESLint + TypeScript checks (`npm run lint`)
2. **Unit Tests** - Jest with coverage (`npm test -- --coverage --maxWorkers=2`)
3. **E2E Tests** - Playwright (`npx playwright test`)
4. **Build** - Production build verification (`npm run build`)
5. **Security** - npm audit + Snyk scan
6. **Performance** - Lighthouse CI

### Viewing Results

1. Go to GitHub Actions tab
2. Click on workflow run
3. View logs and artifacts
4. Download Playwright report if tests fail

### Required Secrets

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SNYK_TOKEN (optional)
```

## Debugging Tests

### Jest Debugging

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# VSCode: Use "Jest: Debug" launch configuration
```

### Playwright Debugging

```bash
# Debug mode (step through tests)
npm run test:e2e:debug

# UI mode (visual debugging)
npm run test:e2e:ui

# Show browser
npm run test:e2e -- --headed

# Slow motion
npm run test:e2e -- --slow-mo=1000

# Pause on failure
npm run test:e2e -- --pause-on-failure
```

### Component Debugging

```jsx
import { render, screen, debug } from '@testing-library/react';

test('debugging example', () => {
  render(<Component />);

  // Print DOM
  screen.debug();

  // Print specific element
  screen.debug(screen.getByText('Hello'));
});
```

## Best Practices

### General

- ✅ Write tests that test behavior, not implementation
- ✅ Keep tests simple and focused
- ✅ Use descriptive test names
- ✅ Follow AAA pattern: Arrange, Act, Assert
- ✅ Mock external dependencies
- ❌ Don't test third-party libraries
- ❌ Don't test framework code

### Unit Tests

- Test pure functions in isolation
- Cover edge cases and error conditions
- Aim for >80% coverage on critical code
- Use test.each for parameterized tests

### Component Tests

- Test user interactions, not implementation details
- Use accessible queries (getByRole, getByLabelText)
- Test loading, error, and empty states
- Verify accessibility (ARIA labels)

### E2E Tests

- Test critical user flows end-to-end
- Keep tests independent (can run in any order)
- Use data-testid sparingly (prefer semantic selectors)
- Wait for elements explicitly (await expect)

### Performance

- Run tests in parallel when possible
- Use `.only` during development
- Skip slow tests in watch mode
- Cache node_modules in CI

## Troubleshooting

### Tests Timing Out

```javascript
// Increase timeout for specific test
test('slow test', async () => {
  // ...
}, 10000); // 10 seconds

// Or globally in jest.config.js
testTimeout: 10000
```

### Flaky Tests

```javascript
// Add retries for flaky E2E tests
test.describe.configure({ retries: 2 });

// Use proper waitFor
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### Mock Not Working

```javascript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Or reset all mocks
jest.resetAllMocks();
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Support

For questions or issues:
1. Check this guide
2. Review existing tests for examples
3. Consult test logs and error messages
4. Ask in team chat
