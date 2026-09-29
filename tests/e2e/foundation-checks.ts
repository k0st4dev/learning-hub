import assert from 'node:assert/strict';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const viewports = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

export async function verifyFoundation(
  page: Page,
  baseURL: string,
  viewport: { width: number; height: number },
  colorScheme: 'light' | 'dark',
) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ colorScheme });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(baseURL);
  assert.equal(response?.status(), 200);
  assert.equal(
    await page.getByRole('heading', { level: 1 }).textContent(),
    'A clear path from study to independent practice.',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await page
      .getByRole('link', { name: 'Skip to content' })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.deepEqual(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze()
    ).violations,
    [],
  );
  assert.deepEqual(errors, []);
  assert.ok(
    response
      ?.headers()
      ['content-security-policy']?.includes("frame-ancestors 'none'"),
  );
}

export async function verifyBoundaries(page: Page, baseURL: string) {
  assert.equal((await page.goto(`${baseURL}/not-a-route`))?.status(), 404);
  assert.equal(
    await page.getByRole('heading', { name: 'Page not found' }).isVisible(),
    true,
  );
  assert.equal(
    (
      await page.request.get(baseURL, {
        headers: { origin: 'https://attacker.example' },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await page.request.get(baseURL, { headers: { host: 'attacker.example' } })
    ).status(),
    403,
  );
}
