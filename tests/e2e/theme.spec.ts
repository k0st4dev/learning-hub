import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEST_EMAIL = `theme-student-${Date.now()}@example.test`;
const TEST_PASSWORD = 'ThemeTestingPassword2026!';

function parseColor(color: string): [number, number, number] {
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  throw new Error(`Invalid color format: ${color}`);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [sR, sG, sB] = [r, g, b].map((val) => {
    const c = val / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sR + 0.7152 * sG + 0.0722 * sB;
}

function contrastRatio(fgColor: string, bgColor: string): number {
  const l1 = relativeLuminance(parseColor(fgColor));
  const l2 = relativeLuminance(parseColor(bgColor));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe.serial('Theme switching and contrast verification (§203)', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test('Public routes follow OS media query when data-theme is system', async () => {
    // 1. Dark OS preference
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');

    const darkBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('background-color'),
    );
    expect(darkBg).toBe('rgb(11, 18, 32)');

    const darkTextColor = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('color'),
    );
    expect(darkTextColor).toBe('rgb(241, 245, 249)');

    const darkHeaderBg = await page.evaluate(() =>
      window.getComputedStyle(document.querySelector('.site-header')!).getPropertyValue('background-color'),
    );
    expect(darkHeaderBg).toBe('rgb(17, 24, 39)');

    let axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // 2. Light OS preference
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');

    const lightBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('background-color'),
    );
    expect(lightBg).toBe('rgb(248, 250, 252)');

    const lightTextColor = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('color'),
    );
    expect(lightTextColor).toBe('rgb(15, 23, 42)');

    const lightHeaderBg = await page.evaluate(() =>
      window.getComputedStyle(document.querySelector('.site-header')!).getPropertyValue('background-color'),
    );
    expect(lightHeaderBg).toBe('rgb(255, 255, 255)');

    axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('User can switch theme to dark, persisting across reloads and navigation', async () => {
    // Register test student
    await page.goto('/register');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL(/\/login/);
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');

    // Enroll if start button visible
    const startButton = page.getByRole('button', { name: 'Start course' });
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForURL(/\/preparation/);
    }

    // Navigate to settings
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    const profileSection = page.getByRole('region', { name: 'Your profile' });
    await expect(profileSection.getByRole('status')).toHaveText('Saved settings confirmed');

    // Switch to dark theme
    await profileSection.getByLabel('Theme').selectOption('dark');
    await expect(profileSection.getByRole('status')).toHaveText('Unsaved changes');
    await profileSection.getByRole('button', { name: 'Save settings' }).click();
    await expect(profileSection.getByRole('status')).toHaveText('Saved settings confirmed');

    // Verify dark theme on html attribute
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Verify dark colors apply even when OS prefers light
    await page.emulateMedia({ colorScheme: 'light' });
    const bgInLightOS = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('background-color'),
    );
    expect(bgInLightOS).toBe('rgb(11, 18, 32)');

    // Reload page to verify server persistence from database
    await page.reload();
    const reloadedProfileSection = page.getByRole('region', { name: 'Your profile' });
    await expect(reloadedProfileSection.getByRole('status')).toHaveText('Saved settings confirmed');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const reloadedBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('background-color'),
    );
    expect(reloadedBg).toBe('rgb(11, 18, 32)');

    // Axe audit on settings in dark mode
    let axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // Navigate to dashboard - verify dark theme retained
    await page.goto('/dashboard');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // Check additional core routes under dark mode
    const darkRoutes = [
      '/resources',
      '/search',
      '/progress/scorecard',
      '/course/software-engineer',
      '/course/software-engineer/days/d001',
      '/course/software-engineer/days/d001/lessons/d001-learn',
      '/course/software-engineer/days/d001/exercises/d001-practice',
    ];

    for (const route of darkRoutes) {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      const routeAxe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      expect(
        routeAxe.violations,
        `Axe violations on ${route} in dark mode: ${JSON.stringify(routeAxe.violations, null, 2)}`,
      ).toEqual([]);
    }
  });

  test('Component-level color contrast exceeds WCAG AA across light and dark tokens', async () => {
    // 1. Audit dark theme token contrast ratios
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const darkTokens = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement);
      const bodyStyle = window.getComputedStyle(document.body);
      const button = document.querySelector('.button.primary') as HTMLElement | null;
      const buttonStyle = button ? window.getComputedStyle(button) : null;
      return {
        bg: bodyStyle.getPropertyValue('background-color'),
        surface: style.getPropertyValue('--surface').trim(),
        text: style.getPropertyValue('--text').trim(),
        muted: style.getPropertyValue('--muted').trim(),
        primary: style.getPropertyValue('--primary').trim(),
        buttonBg: buttonStyle?.getPropertyValue('background-color') ?? '',
        buttonText: buttonStyle?.getPropertyValue('color') ?? '',
      };
    });

    // Dark body text contrast on dark background (WCAG AA requirement >= 4.5:1)
    const darkTextContrast = contrastRatio(darkTokens.text, darkTokens.bg);
    expect(darkTextContrast).toBeGreaterThanOrEqual(4.5);

    // Dark muted text contrast on dark surface (WCAG AA requirement >= 4.5:1)
    const darkMutedContrast = contrastRatio(darkTokens.muted, darkTokens.surface);
    expect(darkMutedContrast).toBeGreaterThanOrEqual(4.5);

    // Dark primary button contrast (WCAG AA requirement >= 4.5:1)
    const darkButtonContrast = contrastRatio(darkTokens.buttonText, darkTokens.buttonBg);
    expect(darkButtonContrast).toBeGreaterThanOrEqual(4.5);

    // 2. Switch to light theme and audit light token contrast ratios
    const profileSection = page.getByRole('region', { name: 'Your profile' });
    await profileSection.getByLabel('Theme').selectOption('light');
    await profileSection.getByRole('button', { name: 'Save settings' }).click();
    await expect(profileSection.getByRole('status')).toHaveText('Saved settings confirmed');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const lightTokens = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement);
      const bodyStyle = window.getComputedStyle(document.body);
      const button = document.querySelector('.button.primary') as HTMLElement | null;
      const buttonStyle = button ? window.getComputedStyle(button) : null;
      return {
        bg: bodyStyle.getPropertyValue('background-color'),
        surface: style.getPropertyValue('--surface').trim(),
        text: style.getPropertyValue('--text').trim(),
        muted: style.getPropertyValue('--muted').trim(),
        primary: style.getPropertyValue('--primary').trim(),
        buttonBg: buttonStyle?.getPropertyValue('background-color') ?? '',
        buttonText: buttonStyle?.getPropertyValue('color') ?? '',
      };
    });

    // Light body text contrast on light background (WCAG AA requirement >= 4.5:1)
    const lightTextContrast = contrastRatio(lightTokens.text, lightTokens.bg);
    expect(lightTextContrast).toBeGreaterThanOrEqual(4.5);

    // Light muted text contrast on light surface (WCAG AA requirement >= 4.5:1)
    const lightMutedContrast = contrastRatio(lightTokens.muted, lightTokens.surface);
    expect(lightMutedContrast).toBeGreaterThanOrEqual(4.5);

    // Light primary button contrast (WCAG AA requirement >= 4.5:1)
    const lightButtonContrast = contrastRatio(lightTokens.buttonText, lightTokens.buttonBg);
    expect(lightButtonContrast).toBeGreaterThanOrEqual(4.5);
  });

  test('User can switch theme to light, persisting across reloads and navigation', async () => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    const profileSection = page.getByRole('region', { name: 'Your profile' });
    await expect(profileSection.getByRole('status')).toHaveText('Saved settings confirmed');

    // Switch to light theme
    await profileSection.getByLabel('Theme').selectOption('light');
    if (await profileSection.getByRole('button', { name: 'Save settings' }).isEnabled()) {
      await profileSection.getByRole('button', { name: 'Save settings' }).click();
      await expect(profileSection.getByRole('status')).toHaveText('Saved settings confirmed');
    }

    // Verify light theme on html attribute
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Verify light colors apply even when OS prefers dark
    await page.emulateMedia({ colorScheme: 'dark' });
    const bgInDarkOS = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('background-color'),
    );
    expect(bgInDarkOS).toBe('rgb(248, 250, 252)');

    // Reload page to verify server persistence from database
    await page.reload();
    const reloadedProfileSection = page.getByRole('region', { name: 'Your profile' });
    await expect(reloadedProfileSection.getByRole('status')).toHaveText('Saved settings confirmed');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const reloadedBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('background-color'),
    );
    expect(reloadedBg).toBe('rgb(248, 250, 252)');

    // Axe audit on settings in light mode
    let axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // Navigate to dashboard - verify light theme retained
    await page.goto('/dashboard');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('User can switch theme back to system, responding dynamically to OS preference', async () => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    const profileSection = page.getByRole('region', { name: 'Your profile' });
    await expect(profileSection.getByRole('status')).toHaveText('Saved settings confirmed');

    // Switch back to system theme
    await profileSection.getByLabel('Theme').selectOption('system');
    await expect(profileSection.getByRole('status')).toHaveText('Unsaved changes');
    await profileSection.getByRole('button', { name: 'Save settings' }).click();
    await expect(profileSection.getByRole('status')).toHaveText('Saved settings confirmed');

    // Reload to confirm persistence
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');

    // Test dark OS preference
    await page.emulateMedia({ colorScheme: 'dark' });
    let currentBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('background-color'),
    );
    expect(currentBg).toBe('rgb(11, 18, 32)');

    // Test light OS preference
    await page.emulateMedia({ colorScheme: 'light' });
    currentBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('background-color'),
    );
    expect(currentBg).toBe('rgb(248, 250, 252)');
  });
});
