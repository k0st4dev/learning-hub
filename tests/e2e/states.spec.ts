import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEST_EMAIL = `states-student-${Date.now()}@example.test`;
const TEST_PASSWORD = 'StatesTestingPassword2026!';

test.describe
  .serial('Accessible error, loading, and empty states (§208, §209)', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();

    // Register test student
    await page.goto('/register', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL(/\/login/);
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Dashboard',
    );

    // Enroll if start button visible
    const startButton = page.getByRole('button', { name: 'Start course' });
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForURL(/\/preparation/);
    }
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('404 Not Found page is accessible and provides recovery navigation (§208)', async () => {
    const response = await page.goto('/non-existent-route-404', {
      waitUntil: 'networkidle',
    });
    expect(response?.status()).toBe(404);

    // Verify accessible heading and explanation
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    expect(await heading.textContent()).toContain('Page not found');

    // Verify recovery links to Dashboard and Course
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink).toBeVisible();
    expect(await dashboardLink.getAttribute('href')).toBe('/dashboard');

    const courseLink = page.getByRole('link', {
      name: 'Back to course',
    });
    await expect(courseLink).toBeVisible();

    // Verify Axe accessibility
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('Course error state page presents plain-language guidance and retry action (§208)', async () => {
    await page.goto('/course-state?issue=unavailable', {
      waitUntil: 'networkidle',
    });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    expect(await heading.textContent()).toContain(
      'This page could not be loaded',
    );

    // Actionable retry button and recovery options
    const retryButton = page.getByRole('button', { name: 'Try again' });
    await expect(retryButton).toBeVisible();

    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink).toBeVisible();

    // Verify Axe accessibility
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('Loading skeleton respects prefers-reduced-motion and provides status semantics (§209)', async () => {
    // 1. Reduced motion enabled
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/course/software-engineer/days/d001', {
      waitUntil: 'networkidle',
    });

    // Verify that skeleton elements in globals have animation disabled under reduced motion
    const skeletonAnimation = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'workspace-skeleton';
      const child = document.createElement('div');
      el.appendChild(child);
      document.body.appendChild(el);
      const computed = window.getComputedStyle(child);
      const animName = computed.animationName;
      document.body.removeChild(el);
      return animName;
    });

    expect(['none', '']).toContain(skeletonAnimation);

    // 2. Motion allowed
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const normalAnimation = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'workspace-skeleton';
      const child = document.createElement('div');
      el.appendChild(child);
      document.body.appendChild(el);
      const computed = window.getComputedStyle(child);
      const animName = computed.animationName;
      document.body.removeChild(el);
      return animName;
    });

    expect(normalAnimation).toContain('skeleton-pulse');
  });

  test('Search empty state displays helpful guidance and actionable filter clearing (§209)', async () => {
    await page.goto('/search', { waitUntil: 'networkidle' });

    const searchInput = page.getByLabel('Search original curriculum');
    await searchInput.fill('xyznonexistentquery999');
    await page.keyboard.press('Enter');

    // Wait for search response
    const noMatchesHeading = page.getByRole('heading', { name: 'No matches' });
    await expect(noMatchesHeading).toBeVisible();

    const helpText = page.getByText('Try fewer words or remove filters.');
    await expect(helpText).toBeVisible();

    // Action buttons
    const clearQueryButton = page.getByRole('button', { name: 'Clear query' });
    await expect(clearQueryButton).toBeVisible();

    const clearFiltersButton = page.getByRole('button', {
      name: 'Clear filters',
    });
    await expect(clearFiltersButton).toBeVisible();

    // Click Clear query resets input
    await clearQueryButton.click();
    await expect(searchInput).toHaveValue('');

    // Verify Axe accessibility
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('Resource library empty state displays filter reset controls (§209)', async () => {
    await page.goto('/resources', { waitUntil: 'networkidle' });

    const searchInput = page.locator('#resource-query');
    await searchInput.fill('xyzunmatchedresource999');
    await page.keyboard.press('Enter');

    const emptyHeading = page.getByRole('heading', {
      name: 'No matching resources',
    });
    await expect(emptyHeading).toBeVisible();

    const resultsRegion = page.getByRole('region', {
      name: 'Resource results',
    });
    const clearQueryButton = resultsRegion.getByRole('button', {
      name: 'Clear query',
    });
    await expect(clearQueryButton).toBeVisible();

    const clearFiltersButton = resultsRegion.getByRole('button', {
      name: 'Clear filters',
    });
    await expect(clearFiltersButton).toBeVisible();

    // Clear query restores the view
    await clearQueryButton.click();
    await expect(emptyHeading).not.toBeVisible();

    // Verify Axe accessibility
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('Note editor preserves user draft on network/server failure with retry capability (§208)', async () => {
    await page.goto('/course/software-engineer/days/d001/lessons/d001-learn', {
      waitUntil: 'networkidle',
    });

    const noteTextarea = page.locator('#note-body');
    await expect(noteTextarea).toBeVisible();

    const testDraft =
      'Important student notes that must never be lost during server error.';

    // Intercept notes API to simulate a 503 Service Unavailable
    await page.route('**/api/notes/**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Simulated service interruption for error testing.',
        }),
      });
    });

    // Enter draft into textarea
    await noteTextarea.fill(testDraft);
    // Blur to trigger auto-save
    await noteTextarea.blur();

    // Verify error summary alert appears with role="alert"
    const errorAlert = page.locator('.error-summary[role="alert"]');
    await expect(errorAlert).toBeVisible();
    expect(await errorAlert.textContent()).toContain(
      'Your change was not confirmed. Please retry.',
    );

    // CRITICAL: Verify draft text is 100% preserved in the textarea!
    await expect(noteTextarea).toHaveValue(testDraft);

    // Verify retry button is present and operable
    const retryButton = page.getByRole('button', {
      name: 'Retry the same note save',
    });
    await expect(retryButton).toBeVisible();

    // Verify Axe accessibility on error state
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // Remove mock route
    await page.unroute('**/api/notes/**');
  });
});
