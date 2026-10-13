import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { viewports } from './foundation-checks';

const TEST_EMAIL = `a11y-student-${Date.now()}@example.test`;
const TEST_PASSWORD = 'A11yTestingPassword2026!';

test.describe
  .serial('Authenticated student routes accessibility & responsive', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // 1. Register
    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL(/\/login/);
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

    // 2. Login
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Dashboard',
    );

    // 3. Enroll if not enrolled yet
    const startButton = page.getByRole('button', { name: 'Start course' });
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForURL(/\/preparation/);
    }
  });

  test.afterAll(async () => {
    // Playwright automatically cleans up browser contexts at worker teardown
  });

  const routesToAudit = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Settings', path: '/settings' },
    { name: 'Resource Library', path: '/resources' },
    { name: 'Curriculum Search', path: '/search' },
    { name: 'Monthly Scorecard', path: '/progress/scorecard' },
    { name: 'Course Overview', path: '/course/software-engineer' },
    {
      name: 'Day 1 Overview',
      path: '/course/software-engineer/days/d001',
    },
    {
      name: 'Day 1 Study',
      path: '/course/software-engineer/days/d001/lessons/d001-learn',
    },
    {
      name: 'Day 1 Exercise',
      path: '/course/software-engineer/days/d001/exercises/d001-practice',
    },
  ];

  for (const route of routesToAudit) {
    for (const viewport of viewports) {
      test(`${route.name} at ${viewport.width}px reflow & a11y`, async () => {
        await page.setViewportSize(viewport);
        const pageErrors: string[] = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));

        const response = await page.goto(route.path);
        expect(response?.status()).toBe(200);

        // Verify reflow: document width does not exceed viewport width (no horizontal scrolling)
        const hasHorizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(
          hasHorizontalOverflow,
          `Horizontal overflow detected on ${route.path} at ${viewport.width}px`,
        ).toBe(false);

        // Tab to verify skip link
        await page.keyboard.press('Tab');
        const isSkipFocused = await page
          .getByRole('link', { name: 'Skip to content' })
          .evaluate((el) => el === document.activeElement);
        expect(isSkipFocused).toBe(true);

        // Run Axe accessibility audit
        const axeResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
          .analyze();

        expect(
          axeResults.violations,
          `Axe violations on ${route.path} (${viewport.width}px): ${JSON.stringify(
            axeResults.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
            })),
            null,
            2,
          )}`,
        ).toEqual([]);

        expect(pageErrors).toEqual([]);
      });
    }
  }
});
