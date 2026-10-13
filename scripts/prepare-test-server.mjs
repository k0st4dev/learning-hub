import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lockFile = path.join(root, 'data', '.local-operation.lock');

// Očisti zaostali lock fajl samo ako proces koji ga drži više nije živ
if (fs.existsSync(lockFile)) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    try {
      process.kill(lock.pid, 0);
    } catch {
      fs.unlinkSync(lockFile);
    }
  } catch {}
}

const dbFile = path.join(root, 'data', 'learning.sqlite');
if (fs.existsSync(dbFile)) {
  try {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbFile);
    db.prepare('DELETE FROM auth_throttle;').run();
    db.close();
  } catch {}
}

const child = spawn(
  process.execPath,
  [path.join(root, 'scripts/run-next.mjs'), 'start'],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
