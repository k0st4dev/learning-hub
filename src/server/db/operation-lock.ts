import { mkdir, open, readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readConfig } from '../config.ts';
import { AppError } from '../errors.ts';

/** Supported server/recovery entry points hold this lease until fully stopped. */
export async function acquireOperationLock(
  dataDir: string,
  root: string,
  operation: 'server' | 'password-recovery',
  create = false,
) {
  if (create) await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const directory = await realpath(dataDir);
  readConfig({ APP_DATA_DIR: directory }, root);
  const filename = path.join(directory, '.local-operation.lock');
  const owner = randomUUID();
  const file = await open(filename, 'wx', 0o600).catch(() => {
    throw new AppError(
      409,
      'LOCAL_DATA_BUSY',
      'Local data is in use, or .local-operation.lock remains from an interrupted operation. Stop the application and verify that no owning process is active before removing a stale lock.',
    );
  });
  try {
    await file.writeFile(
      JSON.stringify({
        owner,
        pid: process.pid,
        operation,
        startedAt: Date.now(),
      }),
    );
    await file.sync();
  } catch (cause) {
    await file.close();
    await unlink(filename);
    throw cause;
  }
  let released = false;
  return {
    directory,
    async release() {
      if (released) return;
      released = true;
      try {
        const saved = JSON.parse(await readFile(filename, 'utf8'));
        if (saved.owner !== owner)
          throw new AppError(
            409,
            'LOCK_CHANGED',
            'Local operation lock ownership changed. Preserve the lock and inspect the owning process.',
          );
      } finally {
        await file.close();
      }
      await unlink(filename);
    },
  };
}
