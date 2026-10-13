import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEST_EMAIL = `keyboard-student-${Date.now()}@example.test`;
const TEST_PASSWORD = 'KeyboardTestingPassword2026!';

test.describe
  .serial('Keyboard navigation & focus management (§204, §205, §207)', () => {
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

  test('Skip link is first Tab target and moves focus to #main (§204)', async () => {
    await page.goto('/dashboard');

    // Press Tab from initial page load
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to content' });
    const isSkipActive = await skipLink.evaluate(
      (el) => el === document.activeElement,
    );
    expect(isSkipActive).toBe(true);

    // Verify skip link becomes visually positioned when focused
    const skipTop = await skipLink.evaluate(
      (el) => window.getComputedStyle(el).top,
    );
    expect(skipTop).toBe('8px');

    // Press Enter to activate skip link
    await page.keyboard.press('Enter');

    // Verify focus is transferred to main content area
    const isMainActive = await page.evaluate(
      () =>
        document.activeElement?.id === 'main' &&
        document.activeElement?.tagName === 'MAIN',
    );
    expect(isMainActive).toBe(true);

    // Subsequent Tab continues into main content
    await page.keyboard.press('Tab');
    const activeInsideMain = await page.evaluate(() => {
      const main = document.getElementById('main');
      return main?.contains(document.activeElement) ?? false;
    });
    expect(activeInsideMain).toBe(true);
  });

  test('Sequential keyboard Tab navigation through form elements (§204)', async () => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Settings',
    );

    // Focus display name input directly
    const nameInput = page.getByLabel('Display name');
    await nameInput.focus();
    expect(
      await nameInput.evaluate((el) => el === document.activeElement),
    ).toBe(true);

    // Tab to timezone input
    await page.keyboard.press('Tab');
    const timezoneInput = page.getByLabel('Timezone');
    expect(
      await timezoneInput.evaluate((el) => el === document.activeElement),
    ).toBe(true);

    // Tab to theme select
    await page.keyboard.press('Tab');
    const themeSelect = page.getByLabel('Theme');
    expect(
      await themeSelect.evaluate((el) => el === document.activeElement),
    ).toBe(true);

    // Tab to Save button or next control
    await page.keyboard.press('Tab');
    const currentActive = await page.evaluate(() =>
      document.activeElement?.tagName.toLowerCase(),
    );
    expect(['button', 'input']).toContain(currentActive);
  });

  test('Focus indicators have visible outline on interactive elements (§205)', async () => {
    await page.goto('/settings');

    // 1. Tab from top to reach interactive elements via keyboard
    await page.keyboard.press('Tab'); // Skip link
    const skipLink = page.getByRole('link', { name: 'Skip to content' });
    const skipFocusVisible = await skipLink.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        matchesFocusVisible: el.matches(':focus-visible'),
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
      };
    });
    expect(skipFocusVisible.matchesFocusVisible).toBe(true);
    expect(skipFocusVisible.outlineStyle).toBe('solid');
    expect(skipFocusVisible.outlineWidth).toBe('2px');

    // Tab through header links to verify focus-visible persists on keyboard nav
    await page.keyboard.press('Tab'); // Brand link
    const brandLink = page
      .getByRole('banner')
      .getByRole('link', { name: 'Programming Learning Platform' });
    const brandFocusVisible = await brandLink.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        matchesFocusVisible: el.matches(':focus-visible'),
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
      };
    });
    expect(brandFocusVisible.matchesFocusVisible).toBe(true);
    expect(brandFocusVisible.outlineStyle).toBe('solid');
    expect(brandFocusVisible.outlineWidth).toBe('2px');
  });

  test('Modal leave dialog traps focus, dismisses with Escape, and restores state (§207)', async () => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Settings',
    );

    // Type unconfirmed settings draft
    const nameInput = page.getByLabel('Display name');
    await nameInput.fill('Unconfirmed student name for leave test');
    const profileSection = page.getByRole('region', { name: 'Your profile' });
    await expect(profileSection.getByRole('status')).toHaveText(
      'Unsaved changes',
    );

    // Attempt to navigate away via link to trigger leave dialog
    const dashboardLink = page
      .getByRole('navigation', { name: 'Student' })
      .getByRole('link', { name: 'Dashboard' });
    await dashboardLink.click();

    // Verify dialog appears
    const dialog = page.getByRole('dialog', {
      name: 'Leave with unsaved settings?',
    });
    await expect(dialog).toBeVisible();

    // Verify initial focus is on the primary button ("Stay and keep my draft")
    const stayButton = dialog.getByRole('button', {
      name: 'Stay and keep my draft',
    });
    await expect(stayButton).toBeFocused();

    // Press Tab: moves to "Leave and discard unconfirmed text"
    await page.keyboard.press('Tab');
    const leaveButton = dialog.getByRole('button', {
      name: 'Leave and discard unconfirmed text',
    });
    await expect(leaveButton).toBeFocused();

    // Press Tab again: wraps back to "Stay and keep my draft" (Focus trap verified)
    await page.keyboard.press('Tab');
    await expect(stayButton).toBeFocused();

    // Press Shift+Tab: wraps back to "Leave and discard unconfirmed text" (Reverse trap verified)
    await page.keyboard.press('Shift+Tab');
    await expect(leaveButton).toBeFocused();

    // Run Axe audit while modal dialog is active
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // Press Escape to dismiss dialog safely (§207)
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Verify student stays on settings page with their draft preserved
    expect(page.url()).toContain('/settings');
    await expect(nameInput).toHaveValue(
      'Unconfirmed student name for leave test',
    );
  });

  test('Mobile navigation drawer traps focus, closes on Escape, and restores focus to trigger (§207)', async () => {
    // Set viewport to mobile 360x800
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Dashboard',
    );

    // Menu trigger button is visible on mobile
    const menuButton = page.getByRole('button', { name: 'Menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.focus();
    expect(
      await menuButton.evaluate((el) => el === document.activeElement),
    ).toBe(true);

    // Open drawer via keyboard (Enter on focused trigger)
    await page.keyboard.press('Enter');

    const drawer = page.locator('dialog.mobile-drawer');
    await expect(drawer).toBeVisible();

    // Verify focus is inside the drawer
    const isFocusInsideDrawer = await page.evaluate(() => {
      const d = document.querySelector('dialog.mobile-drawer');
      return d?.contains(document.activeElement) ?? false;
    });
    expect(isFocusInsideDrawer).toBe(true);

    // Close button inside drawer
    const closeButton = drawer.getByRole('button', { name: 'Close' });
    await closeButton.focus();
    await expect(closeButton).toBeFocused();

    // Reverse Tab from first control wraps to last control in drawer
    await page.keyboard.press('Shift+Tab');
    const isFocusStillInDrawerAfterShiftTab = await page.evaluate(() => {
      const d = document.querySelector('dialog.mobile-drawer');
      return d?.contains(document.activeElement) ?? false;
    });
    expect(isFocusStillInDrawerAfterShiftTab).toBe(true);

    // Tab from last control wraps to first control
    await page.keyboard.press('Tab');
    await expect(closeButton).toBeFocused();

    // Run Axe audit on open mobile drawer
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // Press Escape to dismiss drawer (§207)
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Verify focus is restored to the trigger button that opened it
    expect(
      await menuButton.evaluate((el) => el === document.activeElement),
    ).toBe(true);
  });

  test('Live regions announce status and alert messages accurately', async () => {
    // Reset to desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/settings');

    const profileSection = page.getByRole('region', { name: 'Your profile' });
    const statusRegion = profileSection.getByRole('status');

    // Initial status announcement
    await expect(statusRegion).toHaveText('Saved settings confirmed');

    // Changing a field updates live status to unsaved
    await profileSection
      .getByLabel('Display name')
      .fill('Keyboard Hero Student');
    await expect(statusRegion).toHaveText('Unsaved changes');

    // Saving updates status back to confirmed
    await profileSection.getByRole('button', { name: 'Save settings' }).click();
    await expect(statusRegion).toHaveText('Saved settings confirmed');

    // Form errors render with role="alert"
    const passwordSection = page.getByRole('region', {
      name: 'Change password',
    });
    await passwordSection
      .getByRole('button', { name: 'Change password' })
      .click();
    const alert = passwordSection.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Check the highlighted password fields/i);
  });
});
