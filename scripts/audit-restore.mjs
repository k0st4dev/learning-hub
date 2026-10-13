import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { root } from './environment.mjs';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (cause) {
      if (cause.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.'))
        throw cause;
      return next(specifier + '.ts', context);
    }
  },
});

const { openDatabase } = await import('../src/server/db/connection.ts');
const { migrate } = await import('../src/server/db/migrate.ts');
const { createBackup } = await import('../src/server/db/backup.ts');
const { executeRestore } = await import('../src/server/db/restore.ts');
const { loadArchivedCurriculum, importCurriculum } =
  await import('../src/server/content/import.ts');
const { register, login, requireStudent } =
  await import('../src/server/auth/service.ts');
const { startCourse, mutateLearning } =
  await import('../src/server/learning/mutate.ts');
const { snapshot, continuePath } =
  await import('../src/server/learning/read.ts');
const { saveNote, readNote } = await import('../src/server/learning/notes.ts');

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

const auditDir = await mkdtemp(path.join(root, '.tmp/restore-rehearsal-'));
const srcDir = path.join(auditDir, 'source');
const tgtDir = path.join(auditDir, 'target');
await mkdir(srcDir, { recursive: true });
await mkdir(tgtDir, { recursive: true });

try {
  console.log(
    '1. Setting up source database with curriculum and two test users...',
  );
  await migrate(srcDir, root);
  const srcStore = openDatabase(path.join(srcDir, 'learning.sqlite'));
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(srcStore, plan.source);

  const password = 'A quiet river under bright stars';
  await register(srcStore, {
    email: 'alpha@example.test',
    password,
    confirmation: password,
  });
  await register(srcStore, {
    email: 'beta@example.test',
    password,
    confirmation: password,
  });

  const alphaLogin = await login(srcStore, {
    email: 'alpha@example.test',
    password,
  });
  const betaLogin = await login(srcStore, {
    email: 'beta@example.test',
    password,
  });

  for (const token of [alphaLogin.token, betaLogin.token]) {
    startCourse(srcStore, token);
    mutateLearning(srcStore, token, {
      kind: 'orientation',
      acknowledged: true,
      deferred: true,
      expectedRevision: 0,
      mutationId: randomUUID(),
    });
    saveNote(srcStore, token, {
      itemId: 'se-26w-v1:d001',
      body:
        token === alphaLogin.token
          ? 'Alpha čć note: rehearsal persistence verified.'
          : 'Beta note: distinct student records.',
      expectedStudentId: requireStudent(srcStore, token).id,
      expectedRevision: 0,
      mutationId: randomUUID(),
    });
  }

  mutateLearning(srcStore, alphaLogin.token, {
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
    expectedRevision: 1,
    mutationId: randomUUID(),
  });

  const alphaResumeBefore = continuePath(snapshot(srcStore, alphaLogin.token));
  const betaResumeBefore = continuePath(snapshot(srcStore, betaLogin.token));

  srcStore.native.close();

  console.log('2. Creating verified online backup of source...');
  const backupResult = await createBackup(srcDir, root);
  console.log(`   Backup bundle: ${backupResult.directory}`);

  console.log('3. Setting up target database with dummy initial account...');
  await migrate(tgtDir, root);
  const tgtStore = openDatabase(path.join(tgtDir, 'learning.sqlite'));
  await register(tgtStore, {
    email: 'obsolete@example.test',
    password,
    confirmation: password,
  });
  tgtStore.native.close();

  const targetSecretBefore = await readFile(
    path.join(tgtDir, 'csrf-secret'),
    'utf8',
  );

  console.log('4. Executing stopped-server restore...');
  let logOutput = '';
  const controller = new AbortController();
  const restoreResult = await executeRestore({
    dataDir: tgtDir,
    root,
    backupPath: backupResult.directory,
    prompts: {
      signal: controller.signal,
      ask: async (prompt) => {
        logOutput += prompt;
        return 'RESTORE';
      },
    },
    output: (text) => {
      logOutput += text;
    },
  });

  console.log('5. Verifying restore results...');
  assert.ok(restoreResult.safetyBackup, 'Safety backup should exist');
  assert.equal(restoreResult.targetFile, path.join(tgtDir, 'learning.sqlite'));

  // Check CSRF secret changed
  const targetSecretAfter = await readFile(
    path.join(tgtDir, 'csrf-secret'),
    'utf8',
  );
  assert.notEqual(targetSecretAfter, targetSecretBefore);
  assert.equal(targetSecretAfter.length, 64);

  // Check restored database
  const restoredStore = openDatabase(path.join(tgtDir, 'learning.sqlite'));
  assert.equal(
    restoredStore.native.pragma('integrity_check', { simple: true }),
    'ok',
  );
  assert.deepEqual(restoredStore.native.pragma('foreign_key_check'), []);

  // Check all sessions revoked
  const sessionCount = restoredStore.native
    .prepare('SELECT count(*) as count FROM session')
    .get().count;
  assert.equal(sessionCount, 0, 'All sessions must be revoked');

  // Check obsolete account was replaced
  const obsoleteUser = restoredStore.native
    .prepare('SELECT id FROM app_user WHERE email=?')
    .get('obsolete@example.test');
  assert.equal(obsoleteUser, undefined);

  // Check both users can freshly log in
  const alphaFresh = await login(restoredStore, {
    email: 'alpha@example.test',
    password,
  });
  const betaFresh = await login(restoredStore, {
    email: 'beta@example.test',
    password,
  });

  // Verify learning snapshot / continue path
  assert.deepEqual(
    continuePath(snapshot(restoredStore, alphaFresh.token)),
    alphaResumeBefore,
  );
  assert.deepEqual(
    continuePath(snapshot(restoredStore, betaFresh.token)),
    betaResumeBefore,
  );

  // Verify private notes
  const alphaNote = readNote(restoredStore, alphaFresh.token, 'se-26w-v1:d001');
  assert.equal(
    alphaNote.body,
    'Alpha čć note: rehearsal persistence verified.',
  );
  const betaNote = readNote(restoredStore, betaFresh.token, 'se-26w-v1:d001');
  assert.equal(betaNote.body, 'Beta note: distinct student records.');

  // Fingerprint non-session tables between backup and restored database
  const getTableFingerprints = (db) => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'session' ORDER BY name",
      )
      .all();
    return tables.map(({ name }) => ({
      table: name,
      sha256: hash(
        JSON.stringify(
          db
            .prepare(
              `SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`,
            )
            .all(),
        ),
      ),
    }));
  };

  const backupDb = new Database(backupResult.file, { readonly: true });
  const backupFps = getTableFingerprints(backupDb);
  const restoredFps = getTableFingerprints(restoredStore.native);
  backupDb.close();
  restoredStore.native.close();

  assert.deepEqual(
    restoredFps,
    backupFps,
    'All non-session tables must match backup database byte-for-byte in serialized form',
  );

  const auditReport = {
    date: new Date().toISOString(),
    status: 'passed',
    bundleRestored: backupResult.directory,
    safetyBackupCreated: restoreResult.safetyBackup,
    targetFile: restoreResult.targetFile,
    sessionsRevoked: restoreResult.sessionsRevoked,
    integrityCheck: 'ok',
    foreignKeyCheck: 'ok',
    tableCount: restoredFps.length,
    usersRehearsed: ['alpha@example.test', 'beta@example.test'],
    notesVerified: [alphaNote.body, betaNote.body],
    continuePathsVerified: [alphaResumeBefore, betaResumeBefore],
    rehearsalOutput: logOutput,
  };

  const reportPath = path.join(root, 'docs/m8-step2-restore-audit.json');
  await writeFile(reportPath, JSON.stringify(auditReport, null, 2) + '\n');
  console.log(`\nRehearsal passed! Audit report written to: ${reportPath}`);
} finally {
  await rm(auditDir, { recursive: true, force: true }).catch(() => {});
}
