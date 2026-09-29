import { defineConfig } from '@playwright/test';
import path from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve('.tmp/browsers');
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/run-next.mjs start',
    url: 'http://127.0.0.1:3100',
    env: {
      APP_MODE: 'local',
      PORT: '3100',
      APP_ORIGIN: 'http://127.0.0.1:3100',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    reuseExistingServer: false,
    timeout: 60000,
  },
});
