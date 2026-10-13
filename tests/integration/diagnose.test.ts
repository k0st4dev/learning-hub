import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireStudent } from '../../src/server/auth/service';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import { register, login } from '../../src/server/auth/service';
import { startCourse, mutateLearning } from '../../src/server/learning/mutate';
import { saveNote } from '../../src/server/learning/notes';
import { runProcess } from './run-process';
import { diagnoseDatabase } from '../../src/server/db/diagnose';

const root = process.cwd();
const password = 'A quiet river under bright stars';
let directory: string;
let store: Store;

beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/diagnose-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  store?.native?.close();
  if (
    directory &&
    path.dirname(directory) === path.join(root, '.tmp') &&
    path.basename(directory).startsWith('diagnose-test-')
  ) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function createStudent(email: string) {
  await register(store, { email, password, confirmation: password });
  return (await login(store, { email, password })).token;
}

it('passes cleanly on a freshly migrated and imported database with progress', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);

  const token = await createStudent('alice@example.com');
  startCourse(store, token);
  mutateLearning(store, token, {
    kind: 'orientation',
    acknowledged: true,
    deferred: true,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });
  mutateLearning(store, token, {
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
    expectedRevision: 1,
    mutationId: randomUUID(),
  });
  saveNote(store, token, {
    itemId: 'se-26w-v1:d001',
    body: 'Test note for Day 1',
    expectedStudentId: requireStudent(store, token).id,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  const result = await diagnoseDatabase(directory, root);
  expect(result.ok).toBe(true);
  expect(result.issues).toHaveLength(0);
  expect(result.checks.storage).toBe(true);
  expect(result.checks.integrity).toBe(true);
  expect(result.checks.foreignKeys).toBe(true);
  expect(result.checks.schema).toBe(true);
  expect(result.checks.release).toBe(true);
  expect(result.checks.progress).toBe(true);
  expect(result.counts?.users).toBe(1);
  expect(result.counts?.enrollments).toBe(1);
  expect(result.counts?.lessonsCompleted).toBe(1);
  expect(result.counts?.notes).toBe(1);
});

it('flags missing database file with restore instructions and backup location (§526)', async () => {
  store.native.close();
  const dbFile = path.join(directory, 'learning.sqlite');
  await rm(dbFile);

  const result = await diagnoseDatabase(directory, root);
  expect(result.ok).toBe(false);
  expect(result.checks.storage).toBe(false);
  const issue = result.issues.find((i) => i.code === 'DATABASE_MISSING');
  expect(issue).toBeDefined();
  expect(issue?.remediation).toContain('restore');
  expect(issue?.remediation).toContain(path.join(directory, 'backups'));
});

it('flags symlinked database file', async () => {
  store.native.close();
  const realDb = path.join(directory, 'real.sqlite');
  const dbFile = path.join(directory, 'learning.sqlite');
  const { rename } = await import('node:fs/promises');
  await rename(dbFile, realDb);
  await symlink(realDb, dbFile);

  const result = await diagnoseDatabase(directory, root);
  expect(result.ok).toBe(false);
  expect(result.checks.storage).toBe(false);
  expect(result.issues.some((i) => i.code === 'DATABASE_SYMLINK')).toBe(true);
});

it('flags corrupted SQLite database with restore instructions (§526)', async () => {
  store.native.close();
  const dbFile = path.join(directory, 'learning.sqlite');
  await writeFile(
    dbFile,
    Buffer.from('NOT A VALID SQLITE DATABASE FILE HEADER'),
  );

  const result = await diagnoseDatabase(directory, root);
  expect(result.ok).toBe(false);
  expect(result.checks.integrity).toBe(false);
  const issue = result.issues.find((i) => i.category === 'integrity');
  expect(issue).toBeDefined();
  expect(issue?.remediation).toContain('npm run restore');
});

it('flags foreign key constraint violations with table, rowid and parent', async () => {
  // Disable FK pragma temporarily on a raw connection to insert invalid FK data
  store.native.close();
  const rawDb = new Database(path.join(directory, 'learning.sqlite'));
  try {
    rawDb.pragma('foreign_keys = OFF');
    rawDb
      .prepare(
        `INSERT INTO session (id, user_id, token_hash, created_at, last_seen_at, expires_at)
       VALUES ('session-orphaned', 'non-existent-user-id', 'dummy-hash-12345678901234567890123456789012', 1000, 1000, 2000)`,
      )
      .run();
  } finally {
    rawDb.close();
  }

  const result = await diagnoseDatabase(directory, root);
  expect(result.ok).toBe(false);
  expect(result.checks.foreignKeys).toBe(false);
  const issue = result.issues.find((i) => i.code === 'FOREIGN_KEY_VIOLATION');
  expect(issue).toBeDefined();
  expect(issue?.table).toBe('session');
  expect(issue?.message).toContain('app_user');
});

it('flags missing or altered schema migrations in _app_migration', async () => {
  store.native.close();
  const rawDb = new Database(path.join(directory, 'learning.sqlite'));
  try {
    rawDb
      .prepare(
        "UPDATE _app_migration SET checksum = '0000000000000000000000000000000000000000000000000000000000000000' WHERE id = '0001'",
      )
      .run();
  } finally {
    rawDb.close();
  }

  const result = await diagnoseDatabase(directory, root);
  expect(result.ok).toBe(false);
  expect(result.checks.schema).toBe(false);
  const issue = result.issues.find(
    (i) => i.code === 'SCHEMA_MIGRATION_MISMATCH',
  );
  expect(issue).toBeDefined();
  expect(issue?.message).toContain('0001');
});

it('flags altered curriculum release in course_release', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);
  store.native.close();

  const rawDb = new Database(path.join(directory, 'learning.sqlite'));
  try {
    rawDb
      .prepare(
        "UPDATE course_release SET source_sha256 = '1111111111111111111111111111111111111111111111111111111111111111' WHERE id = 'se-26w-v1'",
      )
      .run();
  } finally {
    rawDb.close();
  }

  const result = await diagnoseDatabase(directory, root);
  expect(result.ok).toBe(false);
  expect(result.checks.release).toBe(false);
  const issue = result.issues.find((i) => i.code === 'RELEASE_MISMATCH');
  expect(issue).toBeDefined();
  expect(issue?.message).toContain('se-26w-v1');
});

it('flags invalid progress references in user_progress (§525)', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);
  const token = await createStudent('bob@example.com');
  startCourse(store, token);
  store.native.close();

  // Intentionally inject invalid progress record bypassing FK
  const rawDb = new Database(path.join(directory, 'learning.sqlite'));
  try {
    rawDb.pragma('foreign_keys = OFF');
    const enrollment = rawDb
      .prepare('SELECT id, release_id FROM enrollment LIMIT 1')
      .get() as { id: string; release_id: string };
    rawDb
      .prepare(
        `INSERT INTO user_progress (enrollment_id, release_id, lesson_id, status, started_at, completed_at, updated_at)
       VALUES (?, ?, 'non-existent-lesson-id', 'completed', 1000, 1000, 1000)`,
      )
      .run(enrollment.id, enrollment.release_id);
  } finally {
    rawDb.close();
  }

  const result = await diagnoseDatabase(directory, root);
  expect(result.ok).toBe(false);
  expect(result.checks.progress).toBe(false);
  const issue = result.issues.find(
    (i) =>
      i.code === 'INVALID_PROGRESS_REFERENCE' && i.table === 'user_progress',
  );
  expect(issue).toBeDefined();
  expect(issue?.identifier).toContain('non-existent-lesson-id');
  expect(issue?.remediation).toContain('reconciliation plan');
});

it('runs CLI scripts/diagnose.mjs successfully on healthy setup and exits 0', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);
  store.native.close();

  const { code, stdout } = await runProcess(['scripts/diagnose.mjs'], {
    ...process.env,
    APP_DATA_DIR: directory,
  });
  expect(code).toBe(0);
  expect(stdout).toContain('All diagnostic checks passed (OK)');
});

it('runs CLI scripts/diagnose.mjs with --json flag and reports valid JSON', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);
  store.native.close();

  const { code, stdout } = await runProcess(
    ['scripts/diagnose.mjs', '--json'],
    {
      ...process.env,
      APP_DATA_DIR: directory,
    },
  );
  expect(code).toBe(0);
  const parsed = JSON.parse(stdout);
  expect(parsed.ok).toBe(true);
  expect(parsed.checks.integrity).toBe(true);
});

it('runs CLI scripts/diagnose.mjs on damaged database and exits 1 with diagnosis', async () => {
  store.native.close();
  const dbFile = path.join(directory, 'learning.sqlite');
  await writeFile(dbFile, Buffer.from('DAMAGED HEADER'));

  const { code, stdout, stderr } = await runProcess(['scripts/diagnose.mjs'], {
    ...process.env,
    APP_DATA_DIR: directory,
  });
  expect(code).toBe(1);
  const output = stdout + stderr;
  expect(output).toContain('FAIL');
  expect(output).toContain('npm run restore');
});
