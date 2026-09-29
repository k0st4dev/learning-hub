import path from 'node:path';
import { spawn } from 'node:child_process';
import { root } from './environment.mjs';
const mode = process.argv[2];
if (!['setup', 'dev', 'start'].includes(mode))
  throw new Error('Use setup:demo, dev:demo or start:demo.');
const env = {
  ...process.env,
  APP_DATA_DIR: path.join(root, '.tmp/m1-demo'),
  APP_DEVELOPMENT_FIXTURE: 'day1',
};
const args =
  mode === 'setup' ? ['scripts/setup.mjs'] : ['scripts/run-next.mjs', mode];
const child = spawn(process.execPath, args, {
  env,
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
