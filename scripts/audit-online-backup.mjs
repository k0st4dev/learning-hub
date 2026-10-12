import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { environment, root } from './environment.mjs';

// Same local TS resolution used by the existing durable-journey test child.
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
const { login, requireStudent } = await import('../src/server/auth/service.ts');
const { snapshot, continuePath } =
  await import('../src/server/learning/read.ts');
const { readNote } = await import('../src/server/learning/notes.ts');
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const mode = process.argv[2];
assert.ok(['prepare', 'verify'].includes(mode));
const statePath = path.join(root, '.tmp/m8-backup-audit-state.json');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = new Database(path.join(config.dataDir, 'learning.sqlite'), {
  readonly: true,
  fileMustExist: true,
});
let temporary, clone;
const fingerprint = (database) => {
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  return tables.map(({ name }) => ({
    table: name,
    sha256: hash(
      JSON.stringify(
        database
          .prepare(
            `SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`,
          )
          .all(),
      ),
    ),
  }));
};
try {
  assert.equal(
    (await fetch(config.origin + '/login', { redirect: 'manual' })).status,
    200,
  );
  assert.equal(
    JSON.parse(
      await readFile(
        path.join(config.dataDir, '.local-operation.lock'),
        'utf8',
      ),
    ).operation,
    'server',
  );
  if (mode === 'prepare') {
    await writeFile(
      statePath,
      JSON.stringify({
        before: fingerprint(source),
        secretHash: hash(
          await readFile(path.join(config.dataDir, 'csrf-secret')),
        ),
        backups: await readdir(path.join(config.dataDir, 'backups')),
      }),
    );
    console.log(
      'Read-only baseline saved. Run the public backup CLI, then verify.',
    );
  } else {
    const { before, secretHash, backups } = JSON.parse(
      await readFile(statePath, 'utf8'),
    );
    const added = (await readdir(path.join(config.dataDir, 'backups'))).filter(
      (name) => name.startsWith('backup-') && !backups.includes(name),
    );
    assert.equal(added.length, 1);
    const backupDirectory = path.join(config.dataDir, 'backups', added[0]);
    assert.ok(backupDirectory);
    assert.equal(
      path.dirname(backupDirectory),
      path.join(config.dataDir, 'backups'),
    );
    assert.deepEqual(await readdir(backupDirectory), [
      'learning.sqlite',
      'manifest.json',
      'source-manifest.json',
    ]);
    const manifest = JSON.parse(
      await readFile(path.join(backupDirectory, 'manifest.json'), 'utf8'),
    );
    const file = path.join(backupDirectory, 'learning.sqlite');
    assert.equal(hash(await readFile(file)), manifest.database.sha256);
    assert.equal(
      hash(await readFile(path.join(backupDirectory, 'source-manifest.json'))),
      manifest.sourceArchive.sha256,
    );
    const copy = new Database(file, { readonly: true, fileMustExist: true });
    try {
      assert.equal(copy.pragma('journal_mode', { simple: true }), 'delete');
      assert.equal(copy.pragma('integrity_check', { simple: true }), 'ok');
      assert.deepEqual(copy.pragma('foreign_key_check'), []);
      assert.deepEqual(fingerprint(copy), before);
    } finally {
      copy.close();
    }
    temporary = await mkdtemp(path.join(root, '.tmp/m8-backup-verification-'));
    // Safe copy of the already verified, closed, standalone backup; never the live WAL file.
    await copyFile(file, path.join(temporary, 'learning.sqlite'));
    clone = openDatabase(path.join(temporary, 'learning.sqlite'));
    const accounts = JSON.parse(
      await readFile(
        path.join(root, '.tmp/m7-recovery-http-state.json'),
        'utf8',
      ),
    ).accounts;
    assert.equal(accounts.length, 2);
    const privateHashes = [],
      resumePaths = [];
    for (const account of accounts) {
      assert.match(account.email, /^recovery-http-[a-f0-9-]+@example\.test$/);
      const token = (
        await login(clone, {
          email: account.email,
          password:
            account.recoveredPassword ??
            account.newPassword ??
            account.password,
        })
      ).token;
      const learning = snapshot(clone, token);
      const expected = source
        .prepare(
          'SELECT * FROM enrollment WHERE user_id=(SELECT id FROM app_user WHERE email_canonical=?)',
        )
        .get(account.email.toLowerCase());
      assert.equal(requireStudent(clone, token).id, expected.user_id);
      assert.equal(learning.revision, expected.revision);
      const note = readNote(clone, token, 'se-26w-v1:d001');
      const originalNote = source
        .prepare(
          'SELECT body_text AS body FROM note WHERE enrollment_id=? AND content_item_id=?',
        )
        .get(expected.id, 'se-26w-v1:d001');
      assert.equal(note.body, originalNote?.body ?? '');
      privateHashes.push(hash(note.body));
      resumePaths.push(continuePath(learning));
    }
    assert.notEqual(privateHashes[0], privateHashes[1]);
    assert.notEqual(resumePaths[0], resumePaths[1]);
    assert.deepEqual(fingerprint(source), before);
    assert.equal(
      hash(await readFile(path.join(config.dataDir, 'csrf-secret'))),
      secretHash,
    );
    assert.equal(
      (await fetch(config.origin + '/login', { redirect: 'manual' })).status,
      200,
    );
    const fullCurriculum = Object.fromEntries(
      [
        ['phases', 'course_module'],
        ['weeks', 'course_week'],
        ['days', 'course_day'],
        ['taskLines', 'exercise_task'],
      ].map(([label, table]) => [
        label,
        source.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,
      ]),
    );
    assert.deepEqual(fullCurriculum, {
      phases: 6,
      weeks: 26,
      days: 182,
      taskLines: 548,
    });
    const report = {
      checkedAt: new Date().toISOString(),
      operation:
        'public backup CLI while ordinary development server remains running',
      checks: {
        databaseSha256: 'ok',
        sourceManifestSha256: 'ok',
        integrity: 'ok',
        foreignKeys: 'ok',
        standaloneWithoutWal: 'ok',
        wholeDatabaseSnapshot: 'ok',
        sourceUnchanged: 'ok',
        csrfSecretUnchanged: 'ok',
        serverAvailableBeforeAndAfter: 'ok',
        isolatedFreshLoginsAndPrivateRecords: 'ok',
      },
      durableTablesIncludingAccountsAndSessions: before.length,
      freshLoginsInIsolatedVerificationCopy: 2,
      fullCurriculum,
      migrations: manifest.migrations.map((entry) => entry.id),
      releases: manifest.releases.map((entry) => ({
        id: entry.id,
        sourceSha256: entry.source_sha256,
        manifestSha256: entry.manifest_sha256,
      })),
      limitation:
        'Standalone snapshot verification is not the stopped-server restore command or A23 restore rehearsal. No live records were written. Concurrent-commit coverage is in automated backup integration tests.',
    };
    await writeFile(
      path.join(root, 'docs/m8-step1-backup-audit.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  clone?.native.close();
  source.close();
  if (temporary) {
    assert.equal(path.dirname(temporary), path.join(root, '.tmp'));
    assert.ok(path.basename(temporary).startsWith('m8-backup-verification-'));
    await rm(temporary, { recursive: true, force: true });
  }
}
