import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
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
const { diagnoseDatabase } = await import('../src/server/db/diagnose.ts');
const { executeCurriculumUpgrade } =
  await import('../src/server/content/upgrade.ts');
const { loadArchivedCurriculum, importCurriculum } =
  await import('../src/server/content/import.ts');
const { register, login, requireStudent } =
  await import('../src/server/auth/service.ts');
const { startCourse, mutateLearning } =
  await import('../src/server/learning/mutate.ts');
const { ownedEnrollment } = await import('../src/server/learning/read.ts');
const { saveNote, readNote } = await import('../src/server/learning/notes.ts');

function publishSecondRelease(database) {
  const now = Date.now();
  database.pragma('foreign_keys = OFF');
  try {
    database
      .prepare(
        `
      INSERT INTO course_release (id, course_id, version, status, source_filename, source_sha256, manifest_sha256, created_at, published_at)
      VALUES ('se-26w-v2', 'software-engineer', 'se-26w-v2', 'published', 'se-26w-v2.docx',
              '2222222222222222222222222222222222222222222222222222222222222222',
              '3333333333333333333333333333333333333333333333333333333333333333',
              ?, ?)
    `,
      )
      .run(now, now + 1000);

    const items = database
      .prepare("SELECT * FROM content_item WHERE release_id = 'se-26w-v1'")
      .all();
    for (const item of items) {
      if (
        item.stable_key === 'd003-practice' ||
        item.parent_id === 'se-26w-v1:d003-practice'
      )
        continue;

      let contentHash = item.content_hash;
      if (item.stable_key === 'd002-practice') {
        contentHash =
          'changed-content-hash-for-materially-changed-exercise-99999999';
      }

      const newId = `se-26w-v2:${item.stable_key}`;
      const newParentId = item.parent_id
        ? `se-26w-v2:${item.parent_id.replace(/^se-26w-v1:/, '')}`
        : null;

      database
        .prepare(
          `
        INSERT INTO content_item (id, release_id, stable_key, kind, title, parent_id, order_index, body_markdown, required, metadata_json, content_hash)
        VALUES (?, 'se-26w-v2', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          newId,
          item.stable_key,
          item.kind,
          item.title,
          newParentId,
          item.order_index,
          item.body_markdown,
          item.required,
          item.metadata_json,
          contentHash,
        );
    }

    const modules = database
      .prepare(
        `
      SELECT m.* FROM course_module m
      JOIN content_item ci ON ci.id = m.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all();
    for (const m of modules) {
      const newId = `se-26w-v2:${m.item_id.replace(/^se-26w-v1:/, '')}`;
      database
        .prepare(
          'INSERT INTO course_module (item_id, phase_number, introduction_markdown) VALUES (?, ?, ?)',
        )
        .run(newId, m.phase_number, m.introduction_markdown);
    }

    const weeks = database
      .prepare(
        `
      SELECT w.* FROM course_week w
      JOIN content_item ci ON ci.id = w.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all();
    for (const w of weeks) {
      const newId = `se-26w-v2:${w.item_id.replace(/^se-26w-v1:/, '')}`;
      database
        .prepare(
          'INSERT INTO course_week (item_id, week_number, objective_markdown, primary_resources_text, main_evidence_markdown, source_date_range, phase_signal_markdown) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          newId,
          w.week_number,
          w.objective_markdown,
          w.primary_resources_text,
          w.main_evidence_markdown,
          w.source_date_range,
          w.phase_signal_markdown,
        );
    }

    const days = database
      .prepare(
        `
      SELECT d.* FROM course_day d
      JOIN content_item ci ON ci.id = d.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all();
    for (const d of days) {
      const newId = `se-26w-v2:${d.item_id.replace(/^se-26w-v1:/, '')}`;
      database
        .prepare(
          'INSERT INTO course_day (item_id, day_number, source_date, estimated_minutes, ai_policy_markdown, completion_criterion_markdown, assessment_kind, remediation_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          newId,
          d.day_number,
          d.source_date,
          d.estimated_minutes,
          d.ai_policy_markdown,
          d.completion_criterion_markdown,
          d.assessment_kind,
          d.remediation_json,
        );
    }

    const lessons = database
      .prepare(
        `
      SELECT l.* FROM lesson l
      JOIN content_item ci ON ci.id = l.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all();
    for (const l of lessons) {
      const newId = `se-26w-v2:${l.item_id.replace(/^se-26w-v1:/, '')}`;
      database
        .prepare(
          'INSERT INTO lesson (item_id, objective_markdown, study_instruction_markdown, blocks_json) VALUES (?, ?, ?, ?)',
        )
        .run(
          newId,
          l.objective_markdown,
          l.study_instruction_markdown,
          l.blocks_json,
        );
    }

    const exercises = database
      .prepare(
        `
      SELECT e.* FROM exercise e
      JOIN content_item ci ON ci.id = e.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all();
    for (const e of exercises) {
      const key = e.item_id.replace(/^se-26w-v1:/, '');
      if (key === 'd003-practice') continue;
      const newId = `se-26w-v2:${key}`;
      const newRelatedLessonId = `se-26w-v2:${e.related_lesson_id.replace(/^se-26w-v1:/, '')}`;
      database
        .prepare(
          'INSERT INTO exercise (item_id, related_lesson_id, instructions_markdown, expected_result_markdown, difficulty, estimated_minutes, hints_json, solution_markdown, help_policy, evidence_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          newId,
          newRelatedLessonId,
          e.instructions_markdown,
          e.expected_result_markdown,
          e.difficulty,
          e.estimated_minutes,
          e.hints_json,
          e.solution_markdown,
          e.help_policy,
          e.evidence_required,
        );
    }

    const tasks = database
      .prepare(
        `
      SELECT t.* FROM exercise_task t
      JOIN content_item ci ON ci.id = t.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all();
    for (const t of tasks) {
      const key = t.item_id.replace(/^se-26w-v1:/, '');
      if (key.startsWith('d003-task-')) continue;
      const newId = `se-26w-v2:${key}`;
      database
        .prepare(
          'INSERT INTO exercise_task (item_id, requirement_mode, rule_json) VALUES (?, ?, ?)',
        )
        .run(newId, t.requirement_mode, t.rule_json);
    }
  } finally {
    database.pragma('foreign_keys = ON');
  }
}

const auditDir = await mkdtemp(path.join(root, '.tmp/operations-audit-'));
const dataDir = path.join(auditDir, 'data');
await mkdir(dataDir, { recursive: true });

try {
  console.log(
    '=== Milestone 8 Consolidated Operations Integration Audit ===\n',
  );

  // -------------------------------------------------------------
  // PHASE 1: Setup & Baseline Diagnostics
  // -------------------------------------------------------------
  console.log('Phase 1: Setting up initial database and learner state...');
  await migrate(dataDir, root);
  const store = openDatabase(path.join(dataDir, 'learning.sqlite'));
  const curriculum = await loadArchivedCurriculum(root);
  importCurriculum(store, curriculum.source);

  const password = 'A quiet river under bright stars';
  await register(store, {
    email: 'alice@operations.test',
    password,
    confirmation: password,
  });
  await register(store, {
    email: 'bob@operations.test',
    password,
    confirmation: password,
  });

  const aliceLogin = await login(store, {
    email: 'alice@operations.test',
    password,
  });
  const bobLogin = await login(store, {
    email: 'bob@operations.test',
    password,
  });

  startCourse(store, aliceLogin.token);
  startCourse(store, bobLogin.token);

  // Alice completes Day 1 lesson & Day 1 exercise
  mutateLearning(store, aliceLogin.token, {
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  mutateLearning(store, aliceLogin.token, {
    kind: 'exercise',
    itemId: 'se-26w-v1:d001-practice',
    completed: true,
    expectedRevision: 1,
    mutationId: randomUUID(),
    submission: {
      tasks: curriculum.source.days[0].tasks.map((t) => ({
        taskId: t.id,
        status: 'done',
        reason: '',
        choice: '',
      })),
      evidence: 'Alice Day 1 passing solution evidence',
      selectedScope: '',
      attested: true,
      result: 'passed',
      transferPath: null,
      transferReflection: '',
      scoreEvidence: '',
      remediationNote: '',
    },
  });

  // Alice completes Day 2 exercise (which will be materially changed in v2)
  mutateLearning(store, aliceLogin.token, {
    kind: 'exercise',
    itemId: 'se-26w-v1:d002-practice',
    completed: true,
    expectedRevision: 2,
    mutationId: randomUUID(),
    submission: {
      tasks: curriculum.source.days[1].tasks.map((t) => ({
        taskId: t.id,
        status: 'done',
        reason: '',
        choice: '',
      })),
      evidence: 'Alice Day 2 solution before modification',
      selectedScope: '',
      attested: true,
      result: 'passed',
      transferPath: null,
      transferReflection: '',
      scoreEvidence: '',
      remediationNote: '',
    },
  });

  // Alice points cursor to d003-practice (which will be removed in v2)
  mutateLearning(store, aliceLogin.token, {
    kind: 'cursor',
    itemId: 'se-26w-v1:d003-practice',
    mode: 'study',
    anchor: 'tasks',
    expectedRevision: 3,
    mutationId: randomUUID(),
  });

  // Save private notes
  saveNote(store, aliceLogin.token, {
    itemId: 'se-26w-v1:d001',
    body: 'Alice private note: verified in Phase 1.',
    expectedStudentId: requireStudent(store, aliceLogin.token).id,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  saveNote(store, bobLogin.token, {
    itemId: 'se-26w-v1:d001',
    body: 'Bob private note: distinct learner records.',
    expectedStudentId: requireStudent(store, bobLogin.token).id,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  // Baseline diagnostics
  console.log('   Running baseline diagnostics...');
  const diag1 = await diagnoseDatabase(dataDir, root);
  assert.equal(diag1.ok, true, 'Baseline diagnostics must pass');
  assert.equal(diag1.issues.length, 0, 'Baseline must have zero issues');
  assert.equal(diag1.counts?.users, 2);
  assert.equal(diag1.counts?.enrollments, 2);
  assert.equal(diag1.counts?.lessonsCompleted, 1);
  assert.equal(diag1.counts?.exercisesCompleted, 2);
  assert.equal(diag1.counts?.notes, 2);
  console.log(
    '   [OK] Baseline diagnostics passed cleanly (2 users, 2 notes).\n',
  );

  // -------------------------------------------------------------
  // PHASE 2: Live Online Backup Creation & Snapshot Diagnostics
  // -------------------------------------------------------------
  console.log('Phase 2: Creating live online backup...');
  const backup1 = await createBackup(dataDir, root);
  assert.ok(backup1.directory, 'Backup bundle directory must exist');
  assert.ok(backup1.file, 'Backup SQLite file must exist');

  const backupManifest = JSON.parse(
    await readFile(path.join(backup1.directory, 'manifest.json'), 'utf8'),
  );
  assert.equal(backupManifest.checks.integrity, 'ok');
  assert.deepEqual(
    backupManifest.migrations.map((m) => m.id),
    ['0001', '0002'],
  );
  assert.equal(backupManifest.releases[0]?.id, 'se-26w-v1');

  // Run integrity check on backup snapshot (read-only to avoid altering file checksum)
  const backupDb = new Database(backup1.file, { readonly: true });
  assert.equal(backupDb.pragma('integrity_check', { simple: true }), 'ok');
  assert.deepEqual(backupDb.pragma('foreign_key_check'), []);
  backupDb.close();
  console.log(
    `   [OK] Live backup verified at: ${path.basename(backup1.directory)}\n`,
  );

  // -------------------------------------------------------------
  // PHASE 3: Curriculum Upgrade (Dry-Run & Real Run)
  // -------------------------------------------------------------
  console.log(
    'Phase 3: Publishing release se-26w-v2 and upgrading curriculum...',
  );
  publishSecondRelease(store.native);

  // Pinning check (A24): enrollment must remain se-26w-v1
  const aliceEnrollmentBefore = ownedEnrollment(store, aliceLogin.token);
  assert.equal(
    aliceEnrollmentBefore?.releaseId,
    'se-26w-v1',
    'Student must remain pinned to se-26w-v1 before upgrade (A24)',
  );

  // 3a: Dry-run evaluation (§231)
  console.log('   Evaluating dry-run upgrade...');
  const dryRunResult = await executeCurriculumUpgrade({
    dataDir,
    root,
    dryRun: true,
    targetReleaseId: 'se-26w-v2',
  });
  assert.equal(dryRunResult.dryRun, true);
  assert.equal(
    dryRunResult.backupPath,
    undefined,
    'No backup during dry-run (§231)',
  );
  assert.equal(
    dryRunResult.plans.length,
    2,
    'Must evaluate both student plans',
  );

  // DB unchanged in dry-run
  const aliceEnrollmentDry = ownedEnrollment(store, aliceLogin.token);
  assert.equal(
    aliceEnrollmentDry?.releaseId,
    'se-26w-v1',
    'No DB writes during dry-run',
  );
  console.log(
    '   [OK] Dry-run evaluated without taking backups or modifying database rows (§231).',
  );

  // 3b: Real upgrade execution (§233, §268)
  console.log('   Executing real curriculum upgrade...');
  const realUpgradeResult = await executeCurriculumUpgrade({
    dataDir,
    root,
    dryRun: false,
    targetReleaseId: 'se-26w-v2',
  });

  assert.equal(realUpgradeResult.dryRun, false);
  assert.ok(
    realUpgradeResult.backupPath,
    'Pre-upgrade verified backup must be taken (§268)',
  );

  // Verify pre-upgrade backup on disk
  const preUpgradeFiles = await readFile(
    path.join(realUpgradeResult.backupPath, 'manifest.json'),
    'utf8',
  );
  assert.ok(preUpgradeFiles.length > 0);

  // Verify database state after upgrade
  const aliceEnrollmentAfter = ownedEnrollment(store, aliceLogin.token);
  assert.equal(
    aliceEnrollmentAfter?.releaseId,
    'se-26w-v2',
    'Enrollment updated to se-26w-v2',
  );
  assert.equal(
    aliceEnrollmentAfter?.resumeItemId,
    null,
    'Removed cursor target safely fell back to null (§233)',
  );

  // Day 1 lesson transferred to v2
  const up1 = store.native
    .prepare(
      "SELECT status FROM user_progress WHERE lesson_id = 'se-26w-v2:d001-learn'",
    )
    .get();
  assert.equal(
    up1?.status,
    'completed',
    'Equivalent lesson retained completion (§233)',
  );

  // Day 1 exercise transferred to v2
  const ep1 = store.native
    .prepare(
      "SELECT status, evidence_text FROM exercise_progress WHERE exercise_id = 'se-26w-v2:d001-practice'",
    )
    .get();
  assert.equal(
    ep1?.status,
    'completed',
    'Equivalent exercise retained completion (§233)',
  );
  assert.equal(ep1?.evidence_text, 'Alice Day 1 passing solution evidence');

  // Day 2 exercise (materially changed) NOT transferred as completed
  const ep2 = store.native
    .prepare(
      "SELECT status FROM exercise_progress WHERE exercise_id = 'se-26w-v2:d002-practice'",
    )
    .get();
  assert.equal(
    ep2,
    undefined,
    'Materially changed exercise requires fresh reattempt (§233)',
  );

  // Note transferred to v2
  const aliceNoteV2 = readNote(store, aliceLogin.token, 'se-26w-v2:d001');
  assert.equal(aliceNoteV2?.body, 'Alice private note: verified in Phase 1.');

  // Activity event logged
  const event = store.native
    .prepare("SELECT * FROM activity_event WHERE type = 'release_migrated'")
    .get();
  assert.ok(event, 'release_migrated event must be logged');
  const payload = JSON.parse(event.payload_json);
  assert.equal(payload.fromRelease, 'se-26w-v1');
  assert.equal(payload.toRelease, 'se-26w-v2');

  // Diagnostics post-upgrade
  console.log('   Running diagnostics on upgraded database...');
  const diag2 = await diagnoseDatabase(dataDir, root);
  assert.equal(diag2.ok, true, 'Upgraded database must pass diagnostics');
  assert.equal(diag2.issues.length, 0, 'Upgraded database must have 0 issues');
  console.log(
    '   [OK] Curriculum upgrade and post-upgrade diagnostics passed cleanly.\n',
  );

  store.native.close();

  // -------------------------------------------------------------
  // PHASE 4: Stopped-Server Disaster Recovery / Rollback Restore
  // -------------------------------------------------------------
  console.log(
    'Phase 4: Executing disaster recovery restore back to Phase 2 backup...',
  );
  const restoreResult = await executeRestore({
    dataDir,
    root,
    backupPath: backup1.directory,
    prompts: {
      ask: async () => 'RESTORE',
    },
  });

  assert.ok(
    restoreResult.safetyBackup,
    'Safety backup must be created before restoration',
  );
  assert.equal(restoreResult.targetFile, path.join(dataDir, 'learning.sqlite'));

  // Re-open restored database
  const restoredStore = openDatabase(path.join(dataDir, 'learning.sqlite'));
  assert.equal(
    restoredStore.native.pragma('integrity_check', { simple: true }),
    'ok',
  );
  assert.deepEqual(restoredStore.native.pragma('foreign_key_check'), []);

  // Verify all sessions were revoked
  const activeSessions = restoredStore.native
    .prepare('SELECT count(*) as count FROM session')
    .get().count;
  assert.equal(activeSessions, 0, 'All sessions must be revoked upon restore');

  // Fresh login with Alice & Bob
  const aliceRestored = await login(restoredStore, {
    email: 'alice@operations.test',
    password,
  });
  const bobRestored = await login(restoredStore, {
    email: 'bob@operations.test',
    password,
  });

  // Verify enrollment reverted to se-26w-v1
  const aliceRestoredEnrollment = ownedEnrollment(
    restoredStore,
    aliceRestored.token,
  );
  assert.equal(
    aliceRestoredEnrollment?.releaseId,
    'se-26w-v1',
    'Restored enrollment must revert to se-26w-v1',
  );
  assert.equal(
    aliceRestoredEnrollment?.resumeItemId,
    'se-26w-v1:d003-practice',
    'Restored cursor must match pre-upgrade state',
  );

  // Verify private notes intact
  const aliceRestoredNote = readNote(
    restoredStore,
    aliceRestored.token,
    'se-26w-v1:d001',
  );
  assert.equal(
    aliceRestoredNote?.body,
    'Alice private note: verified in Phase 1.',
  );

  const bobRestoredNote = readNote(
    restoredStore,
    bobRestored.token,
    'se-26w-v1:d001',
  );
  assert.equal(
    bobRestoredNote?.body,
    'Bob private note: distinct learner records.',
  );

  // Diagnostics post-restore
  console.log('   Running diagnostics on restored database...');
  const diag3 = await diagnoseDatabase(dataDir, root);
  assert.equal(diag3.ok, true, 'Restored database must pass diagnostics');
  assert.equal(diag3.issues.length, 0, 'Restored database must have 0 issues');
  console.log('   [OK] Restored database passed all diagnostic checks.\n');

  restoredStore.native.close();

  // -------------------------------------------------------------
  // PHASE 5: Corruption Detection & Actionable Remediation (§525, §526)
  // -------------------------------------------------------------
  console.log(
    'Phase 5: Verifying corruption detection and remediation guidance...',
  );
  const corruptDir = path.join(auditDir, 'corrupt-test');
  await mkdir(corruptDir, { recursive: true });
  const corruptDbFile = path.join(corruptDir, 'learning.sqlite');

  // Copy valid database and corrupt header
  const validBytes = await readFile(path.join(dataDir, 'learning.sqlite'));
  const damagedBytes = Buffer.from(validBytes);
  damagedBytes.write('CORRUPTED_HEADER_DATA', 0, 'utf8');
  await writeFile(corruptDbFile, damagedBytes);

  const diagCorrupt = await diagnoseDatabase(corruptDir, root);
  assert.equal(
    diagCorrupt.ok,
    false,
    'Corrupted database must fail diagnostics',
  );
  const corruptIssue = diagCorrupt.issues.find(
    (i) => i.code === 'DATABASE_CORRUPT',
  );
  assert.ok(corruptIssue, 'Must flag DATABASE_CORRUPT');
  assert.ok(
    corruptIssue.remediation.includes('npm run restore'),
    'Remediation must point to npm run restore (§526)',
  );
  console.log(
    '   [OK] Detected corrupted database with remediation pointing to restore.\n',
  );

  // -------------------------------------------------------------
  // REPORT GENERATION
  // -------------------------------------------------------------
  const auditReport = {
    date: new Date().toISOString(),
    status: 'passed',
    phases: {
      phase1_baseline: {
        status: 'passed',
        userCount: diag1.counts?.users,
        enrollmentCount: diag1.counts?.enrollments,
        completedLessonsCount: diag1.counts?.lessonsCompleted,
        completedExercisesCount: diag1.counts?.exercisesCompleted,
        notesCount: diag1.counts?.notes,
        diagnostics: 'clean (0 issues)',
      },
      phase2_liveBackup: {
        status: 'passed',
        backupDirectory: backup1.directory,
        manifestIntegrity: backupManifest.checks.integrity,
        migrations: backupManifest.migrations.map((m) => m.id),
      },
      phase3_curriculumUpgrade: {
        status: 'passed',
        dryRunVerified: true,
        dryRunNoBackup: true,
        preUpgradeBackupCreated: realUpgradeResult.backupPath,
        transferredLessons: ['d001-learn'],
        transferredExercises: ['d001-practice'],
        reattemptRequiredExercises: ['d002-practice'],
        cursorFallbackVerified: true,
        activityEventLogged: 'release_migrated',
        postUpgradeDiagnostics: 'clean (0 issues)',
      },
      phase4_disasterRecoveryRestore: {
        status: 'passed',
        safetyBackupCreated: restoreResult.safetyBackup,
        sessionsRevoked: restoreResult.sessionsRevoked,
        revertedRelease: 'se-26w-v1',
        freshLoginsVerified: ['alice@operations.test', 'bob@operations.test'],
        notesPreserved: true,
        cursorPreserved: true,
        postRestoreDiagnostics: 'clean (0 issues)',
      },
      phase5_corruptionDetection: {
        status: 'passed',
        flaggedCode: corruptIssue.code,
        remediationVerified: true,
      },
    },
  };

  const reportPath = path.join(root, 'docs/m8-step5-operations-audit.json');
  await writeFile(reportPath, JSON.stringify(auditReport, null, 2) + '\n');
  console.log(`=== Audit Passed Successfully! ===`);
  console.log(`Machine-readable audit report written to: ${reportPath}\n`);
} finally {
  await rm(auditDir, { recursive: true, force: true }).catch(() => {});
}
