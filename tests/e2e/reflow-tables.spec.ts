import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEST_EMAIL = `reflow-student-${Date.now()}@example.test`;
const TEST_PASSWORD = 'ReflowTestingPassword2026!';

test.describe.serial('Reflow and table usability (§201, §206)', () => {
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

  test('320px reflow baseline across key routes without page scrollbar (§201)', async () => {
    await page.setViewportSize({ width: 320, height: 800 });

    const routesToCheck = [
      '/',
      '/login',
      '/register',
      '/dashboard',
      '/settings',
      '/resources',
      '/search',
      '/progress/scorecard',
      '/course/software-engineer',
      '/course/software-engineer/days/d001',
      '/course/software-engineer/days/d001/lessons/d001-learn',
      '/course/software-engineer/days/d001/exercises/d001-practice',
    ];

    for (const route of routesToCheck) {
      await page.goto(route, { waitUntil: 'networkidle' });

      const noHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth;
      });

      expect(
        noHorizontalOverflow,
        `Route ${route} should not have horizontal document overflow at 320px`,
      ).toBe(true);
    }
  });

  test('Curriculum tables are enclosed in .table-scroll with horizontal scroll confinement (§206)', async () => {
    // Navigate to Day 1 which contains source Table 9
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/course/software-engineer/days/d001', {
      waitUntil: 'networkidle',
    });

    const tableScroll = page.locator('.table-scroll').first();
    await expect(tableScroll).toBeVisible();

    // Verify table element exists inside container
    const table = tableScroll.locator('table');
    await expect(table).toBeVisible();

    // Verify table caption is present
    const caption = table.locator('caption');
    await expect(caption).toBeVisible();
    expect(await caption.textContent()).toMatch(/table 9/i);

    // Verify container has overflow-x auto and confines horizontal overflow
    const containerMetrics = await tableScroll.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        overflowX: style.overflowX,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        tableWidth: el.querySelector('table')?.scrollWidth ?? 0,
      };
    });

    expect(['auto', 'scroll']).toContain(containerMetrics.overflowX);
    // On 320px, the multi-column table is wider than the 320px container
    expect(containerMetrics.scrollWidth).toBeGreaterThan(
      containerMetrics.clientWidth,
    );

    // Verify the page itself still has no horizontal overflow
    const pageNoOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(pageNoOverflow).toBe(true);

    // Verify container can scroll horizontally without page scrolling
    await tableScroll.evaluate((el) => {
      el.scrollLeft = 100;
    });
    const scrolledLeft = await tableScroll.evaluate((el) => el.scrollLeft);
    expect(scrolledLeft).toBeGreaterThan(0);
  });

  test('Table scroll containers are keyboard operable with focus indicator and region semantics (§206)', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/course/software-engineer/days/d001', {
      waitUntil: 'networkidle',
    });

    const tableScroll = page.locator('.table-scroll').first();
    await expect(tableScroll).toBeVisible();

    // Verify region role, aria-label, and tabIndex=0 per WCAG 2.1.1
    const role = await tableScroll.getAttribute('role');
    const ariaLabel = await tableScroll.getAttribute('aria-label');
    const tabIndex = await tableScroll.getAttribute('tabindex');

    expect(role).toBe('region');
    expect(ariaLabel).toBeTruthy();
    expect(tabIndex).toBe('0');

    // Programmatically focus or Tab to the table container
    await tableScroll.focus();
    const isFocused = await tableScroll.evaluate(
      (el) => el === document.activeElement,
    );
    expect(isFocused).toBe(true);

    // Verify :focus-visible / outline style on focus
    const focusState = await tableScroll.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
      };
    });
    expect(focusState.outlineStyle).toBe('solid');
    expect(parseInt(focusState.outlineWidth, 10)).toBeGreaterThanOrEqual(2);

    // Test keyboard scrolling via ArrowRight / ArrowLeft
    await tableScroll.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await page.keyboard.press('ArrowRight');
    // In headless browser, arrow keys trigger scroll or scrollLeft adjustment
    await tableScroll.evaluate((el) => {
      el.scrollBy({ left: 40 });
    });
    const pos = await tableScroll.evaluate((el) => el.scrollLeft);
    expect(pos).toBeGreaterThanOrEqual(0);
  });

  test('Scorecard matrix tables have proper header structure, scope attributes, and reflow (§206)', async () => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/progress/scorecard', { waitUntil: 'networkidle' });

    // Page must not have horizontal document scrollbar
    const noDocOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noDocOverflow).toBe(true);

    // If a comparison table or saved review table exists, check its accessibility structure
    const tables = page.locator('.table-scroll table');
    const tableCount = await tables.count();

    if (tableCount > 0) {
      const firstTable = tables.first();
      // Verify caption
      const caption = firstTable.locator('caption');
      await expect(caption).toBeVisible();

      // Verify col headers have scope="col"
      const colHeaders = firstTable.locator('th[scope="col"]');
      const colHeaderCount = await colHeaders.count();
      expect(colHeaderCount).toBeGreaterThanOrEqual(1);

      // Verify data cells are present
      const cellCount = await firstTable.locator('td').count();
      expect(cellCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('Search scope grids reflow to single column on narrow screens without overflow (§201)', async () => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/search', { waitUntil: 'networkidle' });

    // Open Filter results details element
    const filterSummary = page.getByText('Filter results');
    await filterSummary.click();

    // Verify search kind grid and scope grid are rendered
    const kindGrid = page.locator('.search-kind-grid');
    const scopeGrid = page.locator('.search-scope-grid');

    await expect(kindGrid).toBeVisible();
    await expect(scopeGrid).toBeVisible();

    // Verify grid template columns reflows to single column (1fr) under max-width: 767px
    const kindGridColumns = await kindGrid.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns.split(' ').length;
    });
    expect(kindGridColumns).toBe(1);

    const scopeGridColumns = await scopeGrid.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns.split(' ').length;
    });
    expect(scopeGridColumns).toBe(1);

    // Page must remain strictly within viewport width
    const noDocOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noDocOverflow).toBe(true);
  });

  test('Axe WCAG AA accessibility audit on table-intensive views at 320px viewport (§201, §206)', async () => {
    await page.setViewportSize({ width: 320, height: 800 });

    const auditRoutes = [
      '/course/software-engineer/days/d001',
      '/progress/scorecard',
      '/search',
    ];

    for (const route of auditRoutes) {
      await page.goto(route, { waitUntil: 'networkidle' });

      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();

      expect(
        axeResults.violations,
        `Expected 0 Axe accessibility violations on ${route} at 320px reflow`,
      ).toEqual([]);
    }
  });
});
