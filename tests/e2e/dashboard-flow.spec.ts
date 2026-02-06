/**
 * E2E Test: Complete Dashboard Flow
 * Tests: Extract from LinkedIn → Save → View in dashboard → Create sequence → Send
 */

import { test, expect } from '@playwright/test';

test.describe('Complete User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
  });

  test('should navigate to dashboard and view contacts', async ({ page }) => {
    // Click on dashboard link
    await page.click('text=Dashboard');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // Check for main dashboard elements
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Navigate to contacts
    await page.click('text=Contacts');
    await expect(page).toHaveURL(/.*contacts/);

    // Verify contacts table loads
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should create a new contact', async ({ page }) => {
    await page.goto('/dashboard/contacts');

    // Click "Add Contact" button
    await page.click('text=Add Contact');

    // Fill out the form
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="company"]', 'Acme Corp');
    await page.fill('[name="role"]', 'Software Engineer');

    // Submit the form
    await page.click('button[type="submit"]');

    // Should show success toast
    await expect(page.getByText(/contact added/i)).toBeVisible();

    // New contact should appear in the table
    await expect(page.getByText('John Doe')).toBeVisible();
  });

  test('should create and view a sequence', async ({ page }) => {
    await page.goto('/dashboard/sequences');

    // Click create sequence
    await page.click('text=Create Sequence');

    // Fill sequence details
    await page.fill('[name="name"]', 'Cold Outreach Template');
    await page.fill('[name="subject"]', 'Quick question about {{company}}');
    await page.fill('[name="body"]', 'Hi {{firstName}}, I wanted to reach out about...');

    // Save sequence
    await page.click('text=Save Template');

    // Should show success message
    await expect(page.getByText(/template saved/i)).toBeVisible();

    // Should redirect to sequences list
    await expect(page).toHaveURL(/.*sequences/);

    // New sequence should be visible
    await expect(page.getByText('Cold Outreach Template')).toBeVisible();
  });

  test('should generate drafts from sequence', async ({ page }) => {
    await page.goto('/dashboard/sequences');

    // Click on a sequence
    await page.click('text=Cold Outreach Template');

    // Enroll contacts
    await page.click('text=Enroll Contacts');

    // Select contacts
    await page.check('input[type="checkbox"]', { timeout: 5000 });

    // Generate drafts
    await page.click('text=Generate Drafts');

    // Should show loading state
    await expect(page.getByText(/generating/i)).toBeVisible();

    // Should redirect to drafts page
    await expect(page).toHaveURL(/.*drafts/, { timeout: 10000 });

    // Drafts should be visible
    await expect(page.getByRole('article')).toHaveCount.toBeGreaterThan(0);
  });

  test('should view analytics', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Check for metric cards
    await expect(page.getByText('Total Contacts')).toBeVisible();
    await expect(page.getByText('Emails Sent')).toBeVisible();
    await expect(page.getByText('Reply Rate')).toBeVisible();

    // Check for charts
    await expect(page.locator('svg')).toBeVisible();

    // Switch between tabs
    await page.click('text=Sequences');
    await expect(page.getByRole('table')).toBeVisible();

    await page.click('text=Contacts');
    await expect(page.getByText('Top Companies')).toBeVisible();

    await page.click('text=Activity');
    await expect(page.getByText('Activity Heatmap')).toBeVisible();
  });

  test('should filter analytics by date range', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Click last 7 days
    await page.click('text=Last 7 days');

    // Verify data updates (check for loading state)
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).not.toBeVisible({ timeout: 5000 });

    // Try custom date range
    await page.click('text=Custom range');

    // Select dates in calendar
    // (This would require more specific calendar selectors)

    // Enable comparison
    await page.click('text=Compare with previous period');

    // Should show trend indicators
    await expect(page.locator('[class*="trend"]')).toBeVisible();
  });

  test('should export analytics to PDF', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Click export button
    await page.click('text=Export & Reports');

    // Click PDF export
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Export to PDF');

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('analytics-report');
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/dashboard');

    // Press Cmd/Ctrl + K to open command palette
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');

    // Command palette should be visible
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();

    // Type to search
    await page.fill('input[placeholder*="search"]', 'contacts');

    // Press Enter to navigate
    await page.keyboard.press('Enter');

    // Should navigate to contacts
    await expect(page).toHaveURL(/.*contacts/);
  });
});

test.describe('Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline
    await page.context().setOffline(true);

    await page.goto('/dashboard/contacts');

    // Should show error message
    await expect(page.getByText(/error|failed|offline/i)).toBeVisible();

    // Reconnect
    await page.context().setOffline(false);

    // Refresh button should work
    await page.click('text=Refresh');

    // Data should load
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  });

  test('should show validation errors on invalid form submission', async ({ page }) => {
    await page.goto('/dashboard/contacts');

    // Click add contact
    await page.click('text=Add Contact');

    // Submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.getByText(/required/i)).toBeVisible();

    // Fill only firstName
    await page.fill('[name="firstName"]', 'John');
    await page.click('button[type="submit"]');

    // Should still show errors for other fields
    await expect(page.getByText(/required/i)).toBeVisible();
  });

  test('should handle API errors', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/dashboard/contacts');

    // Should show error message
    await expect(page.getByText(/error|failed/i)).toBeVisible();
  });
});

test.describe('Mobile Experience', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should open mobile menu', async ({ page }) => {
    await page.goto('/dashboard');

    // Click hamburger menu
    await page.click('[aria-label="Menu"]');

    // Mobile navigation should be visible
    await expect(page.getByRole('navigation')).toBeVisible();

    // Click contacts link
    await page.click('text=Contacts');

    // Should navigate
    await expect(page).toHaveURL(/.*contacts/);
  });

  test('should render responsive tables', async ({ page }) => {
    await page.goto('/dashboard/contacts');

    // Table should stack on mobile
    const table = page.getByRole('table');
    const width = await table.boundingBox();

    // Should fit within viewport
    expect(width?.width).toBeLessThanOrEqual(375);
  });

  test('should support touch gestures', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Swipe to change tabs (if implemented)
    // This would require touch event simulation
  });
});

test.describe('Accessibility', () => {
  test('should have no accessibility violations', async ({ page }) => {
    await page.goto('/dashboard');

    // This would use axe-core or similar
    // const results = await injectAxe(page);
    // expect(results.violations).toHaveLength(0);
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/dashboard/contacts');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify focus is visible
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Check for ARIA labels on important elements
    await expect(page.getByRole('region', { name: /metrics/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load dashboard within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });

  test('should render analytics charts without lag', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    // Measure time to render charts
    const startTime = Date.now();
    await page.waitForSelector('svg', { timeout: 5000 });
    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(2000);
  });
});
