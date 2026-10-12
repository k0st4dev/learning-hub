import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createBackup } from '../../src/server/db/backup';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import { acquireOperationLock } from '../../src/server/db/operation-lock';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import { register, login, requireStudent } from '../../src/server/auth/service';
import { startCourse, mutateLearning } from '../../src/server/learning/mutate';
import { snapshot, continuePath } from '../../src/server/learning/read';
import { saveNote, readNote } from '../../src/server/learning/notes';

const root = process.cwd(),
  password = 'A quiet river under bright stars';
let directory: string, store: Store;
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/backup-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('backup-test-')
  )
    throw new Error('Unsafe backup test directory');
  await rm(directory, { recursive: true, force: true });
});
async function account(email: string) {
  await register(store, { email, password, confirmation: password });
  return (await login(store, { email, password })).token;
}
function durableRows(database: Database.Database) {
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return tables.map(({ name }) => ({
    name,
    sha256: createHash('sha256')
      .update(
        JSON.stringify(
          database
            .prepare(
              `SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`,
            )
            .all(),
        ),
      )
      .digest('hex'),
  }));
}
it('backs up all curriculum, two isolated accounts and confirmed work from live WAL; authenticates and resumes from a standalone copied snapshot', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);
  const first = await account('first@example.test'),
    peer = await account('peer@example.test');
  for (const token of [first, peer]) {
    startCourse(store, token);
    mutateLearning(store, token, {
      kind: 'orientation',
      acknowledged: true,
      deferred: true,
      expectedRevision: 0,
      mutationId: randomUUID(),
    });
    saveNote(store, token, {
      itemId: 'se-26w-v1:d001',
      body:
        token === first
          ? 'Owner čć private note'
          : 'Peer different private note',
      expectedStudentId: requireStudent(store, token).id,
      expectedRevision: 0,
      mutationId: randomUUID(),
    });
  }
  mutateLearning(store, first, {
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
    expectedRevision: 1,
    mutationId: randomUUID(),
  });
  mutateLearning(store, first, {
    kind: 'exercise',
    itemId: 'se-26w-v1:d001-practice',
    completed: true,
    expectedRevision: 2,
    mutationId: randomUUID(),
    submission: {
      tasks: plan.source.days[0]!.tasks.map((task) => ({
        taskId: task.id,
        status: 'done',
        reason: '',
        choice: '',
      })),
      evidence: 'commit abc123: local backup exercise evidence',
      selectedScope: '',
      attested: true,
      result: 'passed',
      transferPath: null,
      transferReflection: '',
      scoreEvidence: '',
      remediationNote: '',
    },
  });
  const before = durableRows(store.native),
    resume = continuePath(snapshot(store, first)),
    peerResume = continuePath(snapshot(store, peer));
  const secret = await readFile(path.join(directory, 'csrf-secret'));
  expect(
    (await readFile(path.join(directory, 'learning.sqlite-wal'))).length,
  ).toBeGreaterThan(0);
  const lease = await acquireOperationLock(directory, root, 'server');
  let result;
  try {
    result = await createBackup(directory, root);
  } finally {
    await lease.release();
  }
  expect(durableRows(store.native)).toEqual(before);
  expect(await readFile(path.join(directory, 'csrf-secret'))).toEqual(secret);
  expect(await readdir(result.directory)).toEqual([
    'learning.sqlite',
    'manifest.json',
    'source-manifest.json',
  ]);
  expect(result.manifest.releases[0]!.manifest_sha256).toBe(
    plan.manifestSha256,
  );
  expect(result.manifest.database.sha256).toBe(
    createHash('sha256')
      .update(await readFile(result.file))
      .digest('hex'),
  );
  expect(
    JSON.parse(
      await readFile(path.join(result.directory, 'manifest.json'), 'utf8'),
    ),
  ).toEqual(result.manifest);
  const portable = path.join(directory, 'verification');
  await mkdir(portable);
  await writeFile(
    path.join(portable, 'learning.sqlite'),
    await readFile(result.file),
  );
  const clone = openDatabase(path.join(portable, 'learning.sqlite'));
  try {
    expect(durableRows(clone.native)).toEqual(before);
    const restoredFirst = (
      await login(clone, { email: 'first@example.test', password })
    ).token;
    const restoredPeer = (
      await login(clone, { email: 'peer@example.test', password })
    ).token;
    expect(continuePath(snapshot(clone, restoredFirst))).toEqual(resume);
    expect(continuePath(snapshot(clone, restoredPeer))).toEqual(peerResume);
    expect(readNote(clone, restoredFirst, 'se-26w-v1:d001').body).toBe(
      'Owner čć private note',
    );
    expect(readNote(clone, restoredPeer, 'se-26w-v1:d001').body).toBe(
      'Peer different private note',
    );
    expect(clone.native.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(clone.native.pragma('foreign_key_check')).toEqual([]);
  } finally {
    clone.native.close();
  }
  const second = await createBackup(directory, root);
  expect(second.directory).not.toBe(result.directory);
  expect(
    (await readFile(result.file)).equals(await readFile(second.file)),
  ).toBe(true);
  expect(durableRows(store.native)).toEqual(before);
});
it('takes a transaction-consistent snapshot while another connection commits during incremental page transfer', async () => {
  await account('first@example.test');
  await account('peer@example.test');
  store.native.exec(
    'CREATE TABLE backup_test_padding (value BLOB); INSERT INTO backup_test_padding VALUES (zeroblob(2000000))',
  );
  const original = Database.prototype.backup;
  let writes = 0;
  vi.spyOn(Database.prototype, 'backup').mockImplementation(function (
    this: Database.Database,
    file,
    options,
  ) {
    return original.call(this, file, {
      ...options,
      progress: () => {
        if (!writes) {
          store.native
            .transaction(() =>
              store.native
                .prepare('UPDATE app_user SET display_name=?')
                .run('Concurrent atomic update'),
            )
            .immediate();
          writes++;
        }
        return 20;
      },
    });
  });
  const result = await createBackup(directory, root);
  expect(writes).toBe(1);
  const copy = new Database(result.file, { readonly: true });
  try {
    expect(
      copy.prepare('SELECT DISTINCT display_name FROM app_user').all(),
    ).toEqual([{ display_name: 'Concurrent atomic update' }]);
    expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
  } finally {
    copy.close();
  }
});
it('refuses missing data without creating a blank database or installation', async () => {
  await expect(
    createBackup(path.join(directory, 'absent'), root),
  ).rejects.toThrow();
  await expect(access(path.join(directory, 'absent'))).rejects.toThrow();
  store.native.close();
  await rm(path.join(directory, 'learning.sqlite'));
  await expect(createBackup(directory, root)).rejects.toThrow();
  await expect(
    access(path.join(directory, 'learning.sqlite')),
  ).rejects.toThrow();
});
it('retains a foreign/stale fence and refuses overlapping setup, recovery or backup', async () => {
  const lock = path.join(directory, '.setup.lock');
  await writeFile(lock, 'foreign owner');
  await expect(createBackup(directory, root)).rejects.toMatchObject({
    code: 'BACKUP_BUSY',
  });
  expect(await readFile(lock, 'utf8')).toBe('foreign owner');
  await expect(access(path.join(directory, 'backups'))).rejects.toThrow();
});
it.each(['checksum', 'newer', 'foreign-key', 'release'])(
  'never publishes an invalid %s snapshot and preserves the original data',
  async (kind) => {
    if (kind === 'checksum')
      store.native.exec(
        "UPDATE _app_migration SET checksum='" +
          'a'.repeat(64) +
          "' WHERE id='0002'",
      );
    if (kind === 'newer')
      store.native.exec(
        "INSERT INTO _app_migration VALUES ('9999','" + 'b'.repeat(64) + "',1)",
      );
    if (kind === 'foreign-key') {
      store.native.pragma('foreign_keys = OFF');
      store.native.exec(
        "INSERT INTO session VALUES ('broken','absent','token',1,1,100,NULL)",
      );
    }
    if (kind === 'release') {
      importCurriculum(store, (await loadArchivedCurriculum(root)).source);
      store.native.exec(
        "UPDATE course_release SET manifest_sha256='" + 'c'.repeat(64) + "'",
      );
    }
    const before = durableRows(store.native);
    await expect(createBackup(directory, root)).rejects.toThrow();
    expect(durableRows(store.native)).toEqual(before);
    expect(
      (await readdir(path.join(directory, 'backups'))).every((name) =>
        name.endsWith('.partial'),
      ),
    ).toBe(true);
    await expect(access(path.join(directory, '.setup.lock'))).rejects.toThrow();
  },
);
it('refuses a symlinked backup directory before writing into its target', async () => {
  const target = path.join(directory, 'redirected');
  await mkdir(target);
  await symlink(
    target,
    path.join(directory, 'backups'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await expect(createBackup(directory, root)).rejects.toMatchObject({
    code: 'BACKUP_PATH_INVALID',
  });
  expect(await readdir(target)).toEqual([]);
});
it('never removes a changed fence and does not report the operation as successful', async () => {
  const original = Database.prototype.backup;
  vi.spyOn(Database.prototype, 'backup').mockImplementation(async function (
    this: Database.Database,
    file,
    options,
  ) {
    await writeFile(
      path.join(directory, '.setup.lock'),
      JSON.stringify({ owner: 'foreign' }),
    );
    return original.call(this, file, options);
  });
  await expect(createBackup(directory, root)).rejects.toMatchObject({
    code: 'LOCK_CHANGED',
  });
  expect(
    JSON.parse(await readFile(path.join(directory, '.setup.lock'), 'utf8'))
      .owner,
  ).toBe('foreign');
  expect(
    (await readdir(path.join(directory, 'backups'))).every((name) =>
      name.endsWith('.partial'),
    ),
  ).toBe(true);
});
it('retains only an incomplete bundle after a driver/storage failure, releases its fence and preserves existing records', async () => {
  const before = durableRows(store.native);
  vi.spyOn(Database.prototype, 'backup').mockRejectedValueOnce(
    new Error('Simulated storage interruption'),
  );
  await expect(createBackup(directory, root)).rejects.toThrow(
    'Simulated storage interruption',
  );
  expect(durableRows(store.native)).toEqual(before);
  const names = await readdir(path.join(directory, 'backups'));
  expect(names).toHaveLength(1);
  expect(names[0]).toMatch(/^\.backup-.*\.partial$/);
  await expect(
    access(path.join(directory, 'backups', names[0]!, 'manifest.json')),
  ).rejects.toThrow();
  await expect(access(path.join(directory, '.setup.lock'))).rejects.toThrow();
});
