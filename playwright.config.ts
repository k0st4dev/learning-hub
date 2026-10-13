import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Osiguraj pronalazak lokalno instaliranih browsera
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve('.tmp/browsers');
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results',
  use: {
    baseURL: process.env.APP_ORIGIN || 'http://127.0.0.1:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node scripts/prepare-test-server.mjs',
    url: 'http://127.0.0.1:3000',
    env: {
      APP_MODE: 'local',
      PORT: '3000',
      APP_ORIGIN: 'http://127.0.0.1:3000',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    reuseExistingServer: true,
    timeout: 60000,
  },
});
