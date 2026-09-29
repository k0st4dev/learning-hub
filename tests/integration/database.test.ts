import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { migrate } from '../../src/server/db/migrate.ts';
import { openDatabase, type Store } from '../../src/server/db/connection.ts';
import { seedDay1Fixture } from '../../src/server/content/day1-fixture.ts';
import * as s from '../../src/server/db/schema.ts';

const root = process.cwd();
let directory: string;
let store: Store | undefined;
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/db-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
});
afterEach(async () => {
  store?.native.close();
  store = undefined;
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('db-test-')
  )
    throw new Error('Unexpected temporary directory');
  await rm(directory, { recursive: true, force: true });
});
describe('reviewed reference database', () => {
  it('matches all typed table columns, primary keys and foreign-key counts', () => {
    for (const table of Object.values(s)) {
      const config = getTableConfig(table);
      const columns = store!.native.pragma(`table_info(${config.name})`) as {
        name: string;
        type: string;
        notnull: number;
      }[];
      expect(columns.map((c) => c.name)).toEqual(
        config.columns.map((c) => c.name),
      );
      expect(columns.map((c) => c.notnull)).toEqual(
        config.columns.map((c) => Number(c.notNull)),
      );
      const foreignKeys = store!.native.pragma(
        `foreign_key_list(${config.name})`,
      ) as { id: number }[];
      expect(new Set(foreignKeys.map((f) => f.id)).size).toBe(
        config.foreignKeys.length,
      );
    }
    expect(store!.native.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(store!.native.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(store!.native.pragma('synchronous', { simple: true })).toBe(2);
    expect(store!.native.pragma('busy_timeout', { simple: true })).toBe(5000);
  });
  it('repeats migration and fixture import without touching accounts', async () => {
    const userId = randomUUID();
    store!.orm
      .insert(s.appUser)
      .values({
        id: userId,
        email: 'student@example.test',
        emailCanonical: 'student@example.test',
        passwordHash: 'test-only',
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    await seedDay1Fixture(store!.orm, root, directory);
    await seedDay1Fixture(store!.orm, root, directory);
    store!.native.close();
    store = undefined;
    const result = await migrate(directory, root);
    expect(result.applied).toBe(false);
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(
      store.orm.select().from(s.appUser).where(eq(s.appUser.id, userId)).get()
        ?.email,
    ).toBe('student@example.test');
    expect(store.orm.select().from(s.exerciseTask).all()).toHaveLength(4);
    expect(store.orm.select().from(s.lesson).all()).toHaveLength(1);
    expect(await readFile(path.join(directory, 'csrf-secret'), 'utf8')).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
  it('rejects fixture publication outside the isolated development directory', async () => {
    await expect(
      seedDay1Fixture(store!.orm, root, path.join(root, 'data')),
    ).rejects.toThrow('Development fixture');
    expect(store!.orm.select().from(s.courseRelease).all()).toHaveLength(0);
  });
  it('detects changed applied migrations instead of rewriting student data', async () => {
    store!.native
      .prepare('UPDATE _app_migration SET checksum = ?')
      .run('tampered');
    await expect(migrate(directory, root)).rejects.toThrow('checksum changed');
    expect(store!.native.pragma('integrity_check', { simple: true })).toBe(
      'ok',
    );
  });
});
