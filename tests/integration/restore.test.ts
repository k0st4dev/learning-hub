import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { createBackup } from '../../src/server/db/backup';
import {
  executeRestore,
  type RestorePrompts,
} from '../../src/server/db/restore';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import { acquireOperationLock } from '../../src/server/db/operation-lock';
import { readConfig } from '../../src/server/config';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import { register, login, requireStudent } from '../../src/server/auth/service';
import { startCourse, mutateLearning } from '../../src/server/learning/mutate';
import { snapshot, continuePath } from '../../src/server/learning/read';
import { saveNote, readNote } from '../../src/server/learning/notes';

const root = process.cwd();
const password = 'A quiet river under bright stars';
let sourceDir: string, targetDir: string;
let sourceStore: Store, targetStore: Store;

beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  sourceDir = await mkdtemp(path.join(root, '.tmp/restore-src-'));
  targetDir = await mkdtemp(path.join(root, '.tmp/restore-tgt-'));
  await migrate(sourceDir, root);
  await migrate(targetDir, root);
  sourceStore = openDatabase(path.join(sourceDir, 'learning.sqlite'));
  targetStore = openDatabase(path.join(targetDir, 'learning.sqlite'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  sourceStore?.native?.close();
  targetStore?.native?.close();
  for (const dir of [sourceDir, targetDir]) {
    if (
      dir &&
      path.dirname(dir) === path.join(root, '.tmp') &&
      path.basename(dir).startsWith('restore-')
    ) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function populateCourseAndAccounts(store: Store) {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);
  const first = await account(store, 'first@example.test');
  const peer = await account(store, 'peer@example.test');
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
          ? 'Owner čć restored note'
          : 'Peer different restored note',
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
      evidence: 'commit def456: restored exercise evidence',
      selectedScope: '',
      attested: true,
      result: 'passed',
      transferPath: null,
      transferReflection: '',
      scoreEvidence: '',
      remediationNote: '',
    },
  });
  return { first, peer, plan };
}

async function account(store: Store, email: string) {
  await register(store, { email, password, confirmation: password });
  return (await login(store, { email, password })).token;
}

function durableRows(database: Database.Database) {
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'session' ORDER BY name",
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

function mockPrompts(response = 'RESTORE'): RestorePrompts {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    ask: async () => response,
  };
}

it('restores backup bundle to a stopped target: revokes all restored sessions, generates fresh CSRF secret, preserves accounts, notes, learning progress and Continue destination', async () => {
  const { first, peer } = await populateCourseAndAccounts(sourceStore);
  const firstResume = continuePath(snapshot(sourceStore, first));
  const peerResume = continuePath(snapshot(sourceStore, peer));

  // Create initial account in target before restore
  await account(targetStore, 'old-target-user@example.test');
  const targetSecretBefore = await readFile(
    path.join(targetDir, 'csrf-secret'),
    'utf8',
  );

  // Close connections before taking backup / restore
  sourceStore.native.close();
  const backupResult = await createBackup(sourceDir, root);

  // Target server is stopped
  targetStore.native.close();

  let outputText = '';
  const result = await executeRestore({
    dataDir: targetDir,
    root,
    backupPath: backupResult.directory,
    prompts: mockPrompts('RESTORE'),
    output: (text) => {
      outputText += text;
    },
  });

  expect(result.targetFile).toBe(path.join(targetDir, 'learning.sqlite'));
  expect(result.restoredFrom).toBe(backupResult.directory);
  expect(result.safetyBackup).toBeTruthy();
  expect(outputText).toContain('Restore target:');

  // Fresh CSRF secret generated and different from before
  const targetSecretAfter = await readFile(
    path.join(targetDir, 'csrf-secret'),
    'utf8',
  );
  expect(targetSecretAfter).not.toBe(targetSecretBefore);
  expect(targetSecretAfter).toHaveLength(64);

  // Open restored database
  const restored = openDatabase(path.join(targetDir, 'learning.sqlite'));
  try {
    // 1. All restored sessions must be revoked
    const sessionCount = (
      restored.native
        .prepare('SELECT count(*) as count FROM session')
        .get() as {
        count: number;
      }
    ).count;
    expect(sessionCount).toBe(0);

    // 2. Old target account replaced
    const oldUser = restored.native
      .prepare('SELECT id FROM app_user WHERE email=?')
      .get('old-target-user@example.test');
    expect(oldUser).toBeUndefined();

    // 3. Both restored accounts can log in with original passwords
    const restoredFirstToken = (
      await login(restored, { email: 'first@example.test', password })
    ).token;
    const restoredPeerToken = (
      await login(restored, { email: 'peer@example.test', password })
    ).token;

    // 4. Learning progress and continue paths are preserved exactly
    expect(continuePath(snapshot(restored, restoredFirstToken))).toEqual(
      firstResume,
    );
    expect(continuePath(snapshot(restored, restoredPeerToken))).toEqual(
      peerResume,
    );

    // 5. Private notes preserved
    expect(readNote(restored, restoredFirstToken, 'se-26w-v1:d001').body).toBe(
      'Owner čć restored note',
    );
    expect(readNote(restored, restoredPeerToken, 'se-26w-v1:d001').body).toBe(
      'Peer different restored note',
    );

    // 6. Database integrity and foreign keys are valid
    expect(restored.native.pragma('integrity_check', { simple: true })).toBe(
      'ok',
    );
    expect(restored.native.pragma('foreign_key_check')).toEqual([]);

    // 7. Non-session tables match backup database exactly
    const backupDb = new Database(backupResult.file, { readonly: true });
    try {
      expect(durableRows(restored.native)).toEqual(durableRows(backupDb));
    } finally {
      backupDb.close();
    }
  } finally {
    restored.native.close();
  }
});

it('refuses restore when local server is running and holds operation lock', async () => {
  const backupResult = await createBackup(sourceDir, root);
  targetStore.native.close();

  const lease = await acquireOperationLock(targetDir, root, 'server');
  try {
    await expect(
      executeRestore({
        dataDir: targetDir,
        root,
        backupPath: backupResult.directory,
        prompts: mockPrompts('RESTORE'),
      }),
    ).rejects.toMatchObject({ code: 'LOCAL_DATA_BUSY' });
  } finally {
    await lease.release();
  }
});

it('refuses restore when local server port is in use', async () => {
  const backupResult = await createBackup(sourceDir, root);
  targetStore.native.close();
  const config = readConfig({ APP_DATA_DIR: targetDir }, root);

  const portServer = createServer((sock) => sock.destroy());
  await new Promise<void>((resolve) =>
    portServer.listen(config.port, config.host, () => resolve()),
  );

  try {
    await expect(
      executeRestore({
        dataDir: targetDir,
        root,
        backupPath: backupResult.directory,
        prompts: mockPrompts('RESTORE'),
      }),
    ).rejects.toMatchObject({ code: 'SERVER_RUNNING' });
  } finally {
    await new Promise<void>((resolve) => portServer.close(() => resolve()));
  }
});

it('refuses restore when .setup.lock is present in target', async () => {
  const backupResult = await createBackup(sourceDir, root);
  targetStore.native.close();

  const lockPath = path.join(targetDir, '.setup.lock');
  await writeFile(lockPath, 'stale setup lock');

  await expect(
    executeRestore({
      dataDir: targetDir,
      root,
      backupPath: backupResult.directory,
      prompts: mockPrompts('RESTORE'),
    }),
  ).rejects.toMatchObject({ code: 'SETUP_RUNNING' });

  expect(await readFile(lockPath, 'utf8')).toBe('stale setup lock');
});

it('cancels restore if confirmation is not provided', async () => {
  const backupResult = await createBackup(sourceDir, root);
  targetStore.native.close();

  const targetDbBefore = await readFile(
    path.join(targetDir, 'learning.sqlite'),
  );

  await expect(
    executeRestore({
      dataDir: targetDir,
      root,
      backupPath: backupResult.directory,
      prompts: mockPrompts('CANCEL'),
    }),
  ).rejects.toMatchObject({ code: 'RESTORE_CANCELED' });

  // Target database untouched
  expect(await readFile(path.join(targetDir, 'learning.sqlite'))).toEqual(
    targetDbBefore,
  );
});

it('rejects incomplete .partial backup bundles without modifying target', async () => {
  const partialDir = path.join(sourceDir, 'backups/.backup-2026.partial');
  await mkdir(partialDir, { recursive: true });
  await writeFile(path.join(partialDir, 'learning.sqlite'), 'incomplete');
  targetStore.native.close();

  await expect(
    executeRestore({
      dataDir: targetDir,
      root,
      backupPath: partialDir,
      prompts: mockPrompts('RESTORE'),
    }),
  ).rejects.toMatchObject({ code: 'RESTORE_BUNDLE_INVALID' });
});

it('rejects corrupt backup bundle with mismatched checksum', async () => {
  const backupResult = await createBackup(sourceDir, root);
  targetStore.native.close();

  // Corrupt the manifest hash
  const manifestPath = path.join(backupResult.directory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.database.sha256 = '0'.repeat(64);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  await expect(
    executeRestore({
      dataDir: targetDir,
      root,
      backupPath: backupResult.directory,
      prompts: mockPrompts('RESTORE'),
    }),
  ).rejects.toMatchObject({ code: 'RESTORE_BUNDLE_INVALID' });
});

it('rejects a symlinked backup path', async () => {
  const backupResult = await createBackup(sourceDir, root);
  targetStore.native.close();

  const linkPath = path.join(sourceDir, 'symlink-backup');
  await symlink(
    backupResult.directory,
    linkPath,
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  await expect(
    executeRestore({
      dataDir: targetDir,
      root,
      backupPath: linkPath,
      prompts: mockPrompts('RESTORE'),
    }),
  ).rejects.toMatchObject({ code: 'RESTORE_PATH_INVALID' });
});

it('rolls back completely to previous database and secret if post-swap verification fails', async () => {
  const backupResult = await createBackup(sourceDir, root);
  targetStore.native.close();

  const targetDbBefore = await readFile(
    path.join(targetDir, 'learning.sqlite'),
  );
  const targetSecretBefore = await readFile(
    path.join(targetDir, 'csrf-secret'),
  );

  // Spy on openDatabase to fail verification after swap
  const connectionModule = await import('../../src/server/db/connection');
  const originalOpen = connectionModule.openDatabase;
  let attempts = 0;
  vi.spyOn(connectionModule, 'openDatabase').mockImplementation(
    (filename: string, create?: boolean) => {
      attempts++;
      if (filename.includes(targetDir) && attempts > 0) {
        throw new Error('Simulated verification failure after swap');
      }
      return originalOpen(filename, create);
    },
  );

  await expect(
    executeRestore({
      dataDir: targetDir,
      root,
      backupPath: backupResult.directory,
      prompts: mockPrompts('RESTORE'),
    }),
  ).rejects.toThrow('Simulated verification failure after swap');

  // Verify rollback preserved exact original target database and secret
  expect(await readFile(path.join(targetDir, 'learning.sqlite'))).toEqual(
    targetDbBefore,
  );
  expect(await readFile(path.join(targetDir, 'csrf-secret'))).toEqual(
    targetSecretBefore,
  );
});

it('creates emergency safety backup when target database is damaged, then restores successfully', async () => {
  const backupResult = await createBackup(sourceDir, root);
  targetStore.native.close();

  // Corrupt the target database file so normal createBackup would fail on it
  const corruptedContent = Buffer.from(
    'Corrupted database content not valid SQLite',
  );
  await writeFile(path.join(targetDir, 'learning.sqlite'), corruptedContent);

  const result = await executeRestore({
    dataDir: targetDir,
    root,
    backupPath: backupResult.directory,
    prompts: mockPrompts('RESTORE'),
  });

  expect(result.safetyBackup).toBeTruthy();
  expect(result.safetyBackup).toContain('safety-damaged-');
  expect(await readFile(result.safetyBackup!)).toEqual(corruptedContent);

  // Target database was replaced with clean restored database
  const restored = openDatabase(path.join(targetDir, 'learning.sqlite'));
  try {
    expect(restored.native.pragma('integrity_check', { simple: true })).toBe(
      'ok',
    );
  } finally {
    restored.native.close();
  }
});
