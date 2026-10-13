import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import { register, login, requireStudent } from '../../src/server/auth/service';
import { startCourse, mutateLearning } from '../../src/server/learning/mutate';
import { saveNote, readNote } from '../../src/server/learning/notes';
import {
  snapshot,
  continuePath,
  ownedEnrollment,
} from '../../src/server/learning/read';
import { createBackup } from '../../src/server/db/backup';
import { executeRestore } from '../../src/server/db/restore';
import { diagnoseDatabase } from '../../src/server/db/diagnose';
import { executeCurriculumUpgrade } from '../../src/server/content/upgrade';
import { runProcess } from './run-process';

const root = process.cwd();
const password = 'A quiet river under bright stars';
let directory: string;
let store: Store;

beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/ops-audit-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  store?.native?.close();
  if (
    directory &&
    path.dirname(directory) === path.join(root, '.tmp') &&
    path.basename(directory).startsWith('ops-audit-test-')
  ) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function createStudent(email: string) {
  await register(store, { email, password, confirmation: password });
  return (await login(store, { email, password })).token;
}

interface ItemCloneRow {
  id: string;
  stable_key: string;
  kind: string;
  title: string;
  parent_id: string | null;
  order_index: number;
  body_markdown: string;
  required: number;
  metadata_json: string;
  content_hash: string;
}

function publishSecondRelease(database: Database.Database) {
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
      .all() as ItemCloneRow[];
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
      .all() as {
      item_id: string;
      phase_number: number;
      introduction_markdown: string;
    }[];
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
      .all() as {
      item_id: string;
      week_number: number;
      objective_markdown: string;
      primary_resources_text: string;
      main_evidence_markdown: string;
      source_date_range: string;
      phase_signal_markdown: string | null;
    }[];
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
      .all() as {
      item_id: string;
      day_number: number;
      source_date: string;
      estimated_minutes: number;
      ai_policy_markdown: string;
      completion_criterion_markdown: string;
      assessment_kind: string;
      remediation_json: string;
    }[];
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
      .all() as {
      item_id: string;
      objective_markdown: string | null;
      study_instruction_markdown: string;
      blocks_json: string;
    }[];
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
      .all() as {
      item_id: string;
      related_lesson_id: string;
      instructions_markdown: string;
      expected_result_markdown: string;
      difficulty: string | null;
      estimated_minutes: number | null;
      hints_json: string;
      solution_markdown: string | null;
      help_policy: string;
      evidence_required: number;
    }[];
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
      .all() as {
      item_id: string;
      requirement_mode: string;
      rule_json: string;
    }[];
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

it('executes complete operational interplay across backup, upgrade, and restore with diagnostic verification', async () => {
  // 1. Initial Setup
  const curriculum = await loadArchivedCurriculum(root);
  importCurriculum(store, curriculum.source);

  const tokenAlice = await createStudent('alice@ops-test.local');
  const tokenBob = await createStudent('bob@ops-test.local');

  startCourse(store, tokenAlice);
  startCourse(store, tokenBob);

  // Alice completes Day 1 lesson and Day 1 exercise
  mutateLearning(store, tokenAlice, {
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  mutateLearning(store, tokenAlice, {
    kind: 'exercise',
    itemId: 'se-26w-v1:d001-practice',
    completed: true,
    expectedRevision: 1,
    mutationId: randomUUID(),
    submission: {
      tasks: curriculum.source.days[0]!.tasks.map((t) => ({
        taskId: t.id,
        status: 'done',
        reason: '',
        choice: '',
      })),
      evidence: 'Alice test passing code',
      selectedScope: '',
      attested: true,
      result: 'passed',
      transferPath: null,
      transferReflection: '',
      scoreEvidence: '',
      remediationNote: '',
    },
  });

  // Save note for Alice
  saveNote(store, tokenAlice, {
    itemId: 'se-26w-v1:d001',
    body: 'Alice note prior to backup and upgrade',
    expectedStudentId: requireStudent(store, tokenAlice).id,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  const aliceResumeBefore = continuePath(snapshot(store, tokenAlice));

  // Baseline diagnosis
  const diagInitial = await diagnoseDatabase(directory, root);
  expect(diagInitial.ok).toBe(true);
  expect(diagInitial.issues).toHaveLength(0);
  expect(diagInitial.counts?.users).toBe(2);
  expect(diagInitial.counts?.enrollments).toBe(2);
  expect(diagInitial.counts?.lessonsCompleted).toBe(1);
  expect(diagInitial.counts?.exercisesCompleted).toBe(1);

  // 2. Live Online Backup
  const backup1 = await createBackup(directory, root);
  expect(backup1.directory).toBeDefined();

  // 3. Publish se-26w-v2 and upgrade
  publishSecondRelease(store.native);

  // Pinning check (A24)
  expect(ownedEnrollment(store, tokenAlice)?.releaseId).toBe('se-26w-v1');

  // Upgrade
  const upgradeResult = await executeCurriculumUpgrade({
    dataDir: directory,
    root,
    dryRun: false,
    targetReleaseId: 'se-26w-v2',
  });
  expect(upgradeResult.dryRun).toBe(false);
  expect(upgradeResult.backupPath).toBeDefined();

  // Verify upgrade in DB
  expect(ownedEnrollment(store, tokenAlice)?.releaseId).toBe('se-26w-v2');

  // Note transferred
  const aliceNoteV2 = readNote(store, tokenAlice, 'se-26w-v2:d001');
  expect(aliceNoteV2?.body).toBe('Alice note prior to backup and upgrade');

  // Post-upgrade diagnosis
  const diagUpgrade = await diagnoseDatabase(directory, root);
  expect(diagUpgrade.ok).toBe(true);
  expect(diagUpgrade.issues).toHaveLength(0);

  store.native.close();

  // 4. Disaster Recovery: Stopped-Server Restore to backup1
  const controller = new AbortController();
  const restoreResult = await executeRestore({
    dataDir: directory,
    root,
    backupPath: backup1.directory,
    prompts: {
      signal: controller.signal,
      ask: async () => 'RESTORE',
    },
  });
  expect(restoreResult.safetyBackup).toBeDefined();

  // Verify restored database
  const restoredStore = openDatabase(path.join(directory, 'learning.sqlite'));
  expect(restoredStore.native.pragma('integrity_check', { simple: true })).toBe(
    'ok',
  );

  // Fresh login
  const aliceFreshLogin = await login(restoredStore, {
    email: 'alice@ops-test.local',
    password,
  });
  expect(ownedEnrollment(restoredStore, aliceFreshLogin.token)?.releaseId).toBe(
    'se-26w-v1',
  );
  expect(continuePath(snapshot(restoredStore, aliceFreshLogin.token))).toEqual(
    aliceResumeBefore,
  );

  const aliceRestoredNote = readNote(
    restoredStore,
    aliceFreshLogin.token,
    'se-26w-v1:d001',
  );
  expect(aliceRestoredNote?.body).toBe(
    'Alice note prior to backup and upgrade',
  );

  // Post-restore diagnosis
  const diagRestore = await diagnoseDatabase(directory, root);
  expect(diagRestore.ok).toBe(true);
  expect(diagRestore.issues).toHaveLength(0);

  restoredStore.native.close();
}, 60000);

it('runs scripts/audit-operations-integration.mjs and validates report output', async () => {
  const { code, stdout } = await runProcess(
    ['scripts/audit-operations-integration.mjs'],
    process.env,
    60000,
  );
  expect(code).toBe(0);
  expect(stdout).toContain(
    'Milestone 8 Consolidated Operations Integration Audit',
  );
  expect(stdout).toContain('Audit Passed Successfully');

  const reportPath = path.join(root, 'docs/m8-step5-operations-audit.json');
  const reportContent = JSON.parse(await readFile(reportPath, 'utf8'));
  expect(reportContent.status).toBe('passed');
  expect(reportContent.phases.phase1_baseline.status).toBe('passed');
  expect(reportContent.phases.phase2_liveBackup.status).toBe('passed');
  expect(reportContent.phases.phase3_curriculumUpgrade.status).toBe('passed');
  expect(reportContent.phases.phase4_disasterRecoveryRestore.status).toBe(
    'passed',
  );
  expect(reportContent.phases.phase5_corruptionDetection.status).toBe('passed');
}, 60000);
