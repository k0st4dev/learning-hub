import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';

const root = process.cwd();
let directory: string;
let store: Store;
let original: Record<string, unknown[]>;
function rows() {
  const tables = store.native
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return Object.fromEntries(
    tables
      .filter(({ name }) => name !== 'settings_receipt')
      .map(({ name }) => [
        name,
        store.native
          .prepare(
            name === 'app_user'
              ? 'SELECT id,email,email_canonical,password_hash,display_name,timezone,ui_locale,theme,created_at,updated_at FROM app_user ORDER BY rowid'
              : `SELECT * FROM "${name}" ORDER BY rowid`,
          )
          .all(),
      ]),
  );
}
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/settings-migration-'));
  store = openDatabase(path.join(directory, 'learning.sqlite'), true);
  const ddl = await readFile(
    path.join(root, 'drizzle/0001_reference.sql'),
    'utf8',
  );
  store.native.exec(ddl);
  store.native.exec(
    'CREATE TABLE _app_migration (id TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)',
  );
  store.native
    .prepare('INSERT INTO _app_migration VALUES (?,?,?)')
    .run('0001', createHash('sha256').update(ddl).digest('hex'), 1);
  store.native.exec(
    "INSERT INTO app_user (id,email,email_canonical,password_hash,created_at,updated_at) VALUES ('existing','existing@example.test','existing@example.test','preserved-hash',1,1); INSERT INTO session VALUES ('existing-session','existing','preserved-token-hash',1,2,9999999999999,NULL)",
  );
  await writeFile(path.join(directory, 'csrf-secret'), 'a'.repeat(64));
  original = rows();
});
afterEach(async () => {
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('settings-migration-')
  )
    throw new Error('Unsafe test directory');
  await rm(directory, { recursive: true, force: true });
});
it('upgrades the original schema with a verified backup and preserves existing rows, sessions and secret', async () => {
  const result = await migrate(directory, root);
  expect(result.appliedIds).toEqual(['0002']);
  expect(result.backup).toBeTruthy();
  const backup = openDatabase(result.backup!);
  try {
    expect(backup.native.pragma('integrity_check', { simple: true })).toBe(
      'ok',
    );
    expect(backup.native.prepare('SELECT * FROM app_user').all()).toEqual(
      original.app_user,
    );
    expect(backup.native.prepare('SELECT * FROM _app_migration').all()).toEqual(
      original._app_migration,
    );
  } finally {
    backup.native.close();
  }
  const after = rows();
  delete after._app_migration;
  delete original._app_migration;
  expect(after).toEqual(original);
  expect(
    store.native.prepare('SELECT settings_revision FROM app_user').get(),
  ).toEqual({ settings_revision: 0 });
  expect(await readFile(path.join(directory, 'csrf-secret'), 'utf8')).toBe(
    'a'.repeat(64),
  );
  expect((await migrate(directory, root)).applied).toBe(false);
});
it('rolls back all pending DDL and history on a failed upgrade', async () => {
  const fake = path.join(directory, 'repository');
  await mkdir(path.join(fake, 'drizzle'), { recursive: true });
  for (const file of ['0001_reference.sql', '0002_settings.sql']) {
    let text = await readFile(path.join(root, 'drizzle', file), 'utf8');
    if (file.startsWith('0002'))
      text += '\nINSERT INTO missing_table VALUES (1);';
    await writeFile(path.join(fake, 'drizzle', file), text);
  }
  await expect(migrate(directory, fake)).rejects.toThrow('missing_table');
  expect(rows()).toEqual(original);
  expect(
    store.native
      .prepare("SELECT name FROM sqlite_master WHERE name='settings_receipt'")
      .get(),
  ).toBeUndefined();
});
it('rejects unknown migration history before changing existing data', async () => {
  store.native
    .prepare('INSERT INTO _app_migration VALUES (?,?,?)')
    .run('9999', 'future', 2);
  const before = rows();
  await expect(migrate(directory, root)).rejects.toThrow(
    'newer or out of order',
  );
  expect(rows()).toEqual(before);
});
