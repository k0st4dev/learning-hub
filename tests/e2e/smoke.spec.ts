import { test, expect } from '@playwright/test';

test.describe('Smoke test web aplikacije', () => {
  test('početna stranica se uspešno učitava (status 200, bez JS grešaka, ključni elementi prisutni)', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const networkFailures: string[] = [];

    // Hvatanje konzolnih grešaka, runtime JS izuzetaka i stvarnih network failure-a u stdout
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const errorText = `[Browser Console Error] ${msg.text()}`;
        console.log(errorText);
        consoleErrors.push(errorText);
      }
    });

    page.on('pageerror', (err) => {
      const errorText = `[Browser Runtime Error] ${err.message}`;
      console.log(errorText);
      pageErrors.push(errorText);
    });

    page.on('requestfailed', (req) => {
      const errorText = req.failure()?.errorText;
      // Ignoriši otkazane prefetch zahteve Next.js rutera
      if (errorText === 'net::ERR_ABORTED') return;
      const failText = `[Network Failure] ${req.method()} ${req.url()} - ${errorText || 'failed'}`;
      console.log(failText);
      networkFailures.push(failText);
    });

    // a) Otvaranje početne stranice
    const response = await page.goto('/');

    // b) Provera HTTP statusa 200
    expect(response?.status()).toBe(200);

    // c) Provera da u browser konzoli i runtime-u nema JS grešaka ili network neuspeha
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(networkFailures).toEqual([]);

    // d) Provera prisustva ključnih elemenata
    // 1. Glavni naslov (h1)
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // 2. Zaglavlje i navigacija
    const header = page.locator('header.site-header');
    await expect(header).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Account' });
    await expect(nav).toBeVisible();

    // 3. Ključni navigacioni linkovi
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Create account' }),
    ).toBeVisible();
  });

  test('glavna forma (autentifikacija / prijava) je dostupna i ispravno renderovana', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const networkFailures: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const errorText = `[Browser Console Error] ${msg.text()}`;
        console.log(errorText);
        consoleErrors.push(errorText);
      }
    });

    page.on('pageerror', (err) => {
      const errorText = `[Browser Runtime Error] ${err.message}`;
      console.log(errorText);
      pageErrors.push(errorText);
    });

    page.on('requestfailed', (req) => {
      const errorText = req.failure()?.errorText;
      if (errorText === 'net::ERR_ABORTED') return;
      const failText = `[Network Failure] ${req.method()} ${req.url()} - ${errorText || 'failed'}`;
      console.log(failText);
      networkFailures.push(failText);
    });

    // Otvaranje stranice sa formom
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);

    // Provera JS grešaka
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(networkFailures).toEqual([]);

    // Provera prisustva forme i njenih ključnih polja
    const form = page.locator('form');
    await expect(form).toBeVisible();

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
