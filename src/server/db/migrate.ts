import { readFile, mkdir, open, unlink, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { openDatabase } from './connection.ts';
import { readConfig } from '../config.ts';
import { reviewedMigrations } from './migrations.ts';

export async function migrate(dataDir: string, repositoryRoot: string) {
  await mkdir(dataDir, { recursive: true });
  readConfig({ APP_DATA_DIR: await realpath(dataDir) }, repositoryRoot);
  const lockPath = path.join(dataDir, '.setup.lock');
  const lock = await open(lockPath, 'wx', 0o600).catch(() => {
    throw new Error(
      'Setup is already running or .setup.lock remains from an interrupted setup. Verify no setup process is active before removing that lock.',
    );
  });
  let store;
  try {
    const filename = path.join(dataDir, 'learning.sqlite');
    const existed = existsSync(filename);
    store = openDatabase(filename, true);
    const migrations = await Promise.all(
      reviewedMigrations.map(async (entry) => {
        const ddl = await readFile(
          path.join(repositoryRoot, 'drizzle', entry.file),
          'utf8',
        );
        return {
          ...entry,
          ddl,
          checksum: createHash('sha256').update(ddl).digest('hex'),
        };
      }),
    );
    const hasHistory = store.native
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_app_migration'",
      )
      .get();
    const history = hasHistory
      ? (store.native
          .prepare('SELECT id,checksum FROM _app_migration ORDER BY id')
          .all() as { id: string; checksum: string }[])
      : [];
    for (const [index, prior] of history.entries()) {
      const expected = migrations[index];
      if (!expected || prior.id !== expected.id)
        throw new Error(
          'Migration history is newer or out of order. Preserve this database and use its compatible application version.',
        );
      if (prior.checksum !== expected.checksum)
        throw new Error(
          'Applied migration checksum changed. Restore the committed migration; do not reset student data.',
        );
    }
    const pending = migrations.slice(history.length);
    let backup: string | null = null;
    if (pending.length) {
      if (existed) {
        await mkdir(path.join(dataDir, 'backups'), { recursive: true });
        backup = path.join(
          dataDir,
          'backups',
          `before-${pending[0]!.id}-${Date.now()}-${randomBytes(4).toString('hex')}.sqlite`,
        );
        await store.native.backup(backup);
        const verification = openDatabase(backup);
        try {
          if (
            verification.native.pragma('integrity_check', { simple: true }) !==
            'ok'
          )
            throw new Error(
              'Pre-migration backup failed integrity verification.',
            );
        } finally {
          verification.native.close();
        }
      }
      store.native
        .transaction(() => {
          store!.native.exec(
            'CREATE TABLE IF NOT EXISTS _app_migration (id TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)',
          );
          for (const migration of pending) {
            store!.native.exec(migration.ddl);
            store!.native
              .prepare('INSERT INTO _app_migration VALUES (?, ?, ?)')
              .run(migration.id, migration.checksum, Date.now());
          }
          if ((store!.native.pragma('foreign_key_check') as unknown[]).length)
            throw new Error(
              'Migration foreign key check failed. Changes were rolled back; preserve your data.',
            );
        })
        .immediate();
    }
    const secretPath = path.join(dataDir, 'csrf-secret');
    if (!existsSync(secretPath)) {
      const secret = await open(secretPath, 'wx', 0o600);
      try {
        await secret.writeFile(randomBytes(32).toString('hex'));
        await secret.sync();
      } finally {
        await secret.close();
      }
    }
    if (
      store.native.pragma('integrity_check', { simple: true }) !== 'ok' ||
      (store.native.pragma('foreign_key_check') as unknown[]).length
    )
      throw new Error(
        'Database integrity check failed. Preserve the database and restore from a verified backup.',
      );
    return {
      applied: pending.length > 0,
      appliedIds: pending.map((entry) => entry.id),
      backup,
      filename,
    };
  } finally {
    store?.native.close();
    await lock.close();
    await unlink(lockPath);
  }
}
