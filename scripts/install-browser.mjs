import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { environment, root } from './environment.mjs';
environment();
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [
    path.join(
      path.dirname(require.resolve('playwright/package.json')),
      'cli.js',
    ),
    'install',
    'chromium',
  ],
  {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.tmp/browsers'),
    },
  },
);
process.exitCode = result.status ?? 1;
