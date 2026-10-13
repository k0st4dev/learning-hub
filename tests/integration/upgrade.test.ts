import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
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
import { ownedEnrollment } from '../../src/server/learning/read';
import { runProcess } from './run-process';
import { executeCurriculumUpgrade } from '../../src/server/content/upgrade';
import * as s from '../../src/server/db/schema';
import { eq } from 'drizzle-orm';

const root = process.cwd();
const password = 'A quiet river under bright stars';
let directory: string;
let store: Store;

beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/upgrade-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  store?.native?.close();
  if (
    directory &&
    path.dirname(directory) === path.join(root, '.tmp') &&
    path.basename(directory).startsWith('upgrade-test-')
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
interface ModuleCloneRow {
  item_id: string;
  phase_number: number;
  introduction_markdown: string;
}
interface WeekCloneRow {
  item_id: string;
  week_number: number;
  objective_markdown: string;
  primary_resources_text: string;
  main_evidence_markdown: string;
  source_date_range: string;
  phase_signal_markdown: string | null;
}
interface DayCloneRow {
  item_id: string;
  day_number: number;
  source_date: string;
  estimated_minutes: number;
  ai_policy_markdown: string;
  completion_criterion_markdown: string;
  assessment_kind: string;
  remediation_json: string;
}
interface LessonCloneRow {
  item_id: string;
  objective_markdown: string | null;
  study_instruction_markdown: string;
  blocks_json: string;
}
interface ExerciseCloneRow {
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
}
interface TaskCloneRow {
  item_id: string;
  requirement_mode: string;
  rule_json: string;
}

/** Helper to publish a second release (se-26w-v2) based on se-26w-v1 with controlled differences:
 * - Equivalent lessons (e.g. d001-learn)
 * - Equivalent exercise (e.g. d001-practice)
 * - Materially changed exercise (e.g. d002-practice with changed contentHash)
 * - Removed item (e.g. d003-practice omitted)
 */
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

    // Clone content_item from se-26w-v1 to se-26w-v2
    const items = database
      .prepare("SELECT * FROM content_item WHERE release_id = 'se-26w-v1'")
      .all() as ItemCloneRow[];
    for (const item of items) {
      // Deliberately omit d003-practice and its task children to simulate removed items
      if (
        item.stable_key === 'd003-practice' ||
        item.parent_id === 'se-26w-v1:d003-practice'
      )
        continue;

      let contentHash = item.content_hash;
      // Deliberately change content_hash for d002-practice to simulate materially changed exercise
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

    // Clone course_module
    const modules = database
      .prepare(
        `
      SELECT m.* FROM course_module m
      JOIN content_item ci ON ci.id = m.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all() as ModuleCloneRow[];
    for (const m of modules) {
      const newId = `se-26w-v2:${m.item_id.replace(/^se-26w-v1:/, '')}`;
      database
        .prepare(
          'INSERT INTO course_module (item_id, phase_number, introduction_markdown) VALUES (?, ?, ?)',
        )
        .run(newId, m.phase_number, m.introduction_markdown);
    }

    // Clone course_week
    const weeks = database
      .prepare(
        `
      SELECT w.* FROM course_week w
      JOIN content_item ci ON ci.id = w.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all() as WeekCloneRow[];
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

    // Clone course_day
    const days = database
      .prepare(
        `
      SELECT d.* FROM course_day d
      JOIN content_item ci ON ci.id = d.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all() as DayCloneRow[];
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

    // Clone lesson
    const lessons = database
      .prepare(
        `
      SELECT l.* FROM lesson l
      JOIN content_item ci ON ci.id = l.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all() as LessonCloneRow[];
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

    // Clone exercise
    const exercises = database
      .prepare(
        `
      SELECT e.* FROM exercise e
      JOIN content_item ci ON ci.id = e.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all() as ExerciseCloneRow[];
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

    // Clone exercise_task
    const tasks = database
      .prepare(
        `
      SELECT t.* FROM exercise_task t
      JOIN content_item ci ON ci.id = t.item_id
      WHERE ci.release_id = 'se-26w-v1'
    `,
      )
      .all() as TaskCloneRow[];
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

it('dry-run evaluates prospective upgrade without taking backups or modifying database rows (§231)', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);

  const token = await createStudent('alice@example.com');
  startCourse(store, token);
  mutateLearning(store, token, {
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  publishSecondRelease(store.native);

  const result = await executeCurriculumUpgrade({
    dataDir: directory,
    root,
    dryRun: true,
    targetReleaseId: 'se-26w-v2',
  });

  expect(result.dryRun).toBe(true);
  expect(result.targetReleaseId).toBe('se-26w-v2');
  expect(result.backupPath).toBeUndefined();
  expect(result.plans).toHaveLength(1);

  const plan0 = result.plans[0]!;
  expect(plan0.userEmail).toBe('alice@example.com');
  expect(plan0.sourceReleaseId).toBe('se-26w-v1');
  expect(plan0.targetReleaseId).toBe('se-26w-v2');
  expect(
    plan0.transferredLessons.some((l) => l.stableKey === 'd001-learn'),
  ).toBe(true);

  // Database must NOT have been modified
  const enrollment = ownedEnrollment(store, token);
  expect(enrollment?.releaseId).toBe('se-26w-v1');

  // Backups directory must NOT have been created
  const backupsDir = path.join(directory, 'backups');
  const exists = await readdir(backupsDir).catch(() => null);
  expect(exists).toBeNull();
}, 30000);

it('creates pre-upgrade verified backup before applying enrollment changes (§268)', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);

  const token = await createStudent('bob@example.com');
  startCourse(store, token);

  publishSecondRelease(store.native);

  const result = await executeCurriculumUpgrade({
    dataDir: directory,
    root,
    dryRun: false,
    targetReleaseId: 'se-26w-v2',
  });

  expect(result.dryRun).toBe(false);
  expect(result.backupPath).toBeDefined();

  // Verify backup bundle exists on disk
  const files = await readdir(result.backupPath!);
  expect(files).toContain('learning.sqlite');
  expect(files).toContain('manifest.json');
  expect(files).toContain('source-manifest.json');
}, 30000);

it('transfers equivalent completed units and requires reattempt for materially changed exercises (§233)', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);

  const token = await createStudent('carol@example.com');
  startCourse(store, token);

  // Complete Day 1 lesson (equivalent)
  mutateLearning(store, token, {
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  // Complete Day 1 exercise (equivalent)
  mutateLearning(store, token, {
    kind: 'exercise',
    itemId: 'se-26w-v1:d001-practice',
    completed: true,
    expectedRevision: 1,
    mutationId: randomUUID(),
    submission: {
      tasks: plan.source.days[0]!.tasks.map((task) => ({
        taskId: task.id,
        status: 'done',
        reason: '',
        choice: '',
      })),
      evidence: 'Valid Day 1 passing code solution',
      selectedScope: '',
      attested: true,
      result: 'passed',
      transferPath: null,
      transferReflection: '',
      scoreEvidence: '',
      remediationNote: '',
    },
  });

  // Complete Day 2 exercise (will be materially changed in v2)
  mutateLearning(store, token, {
    kind: 'exercise',
    itemId: 'se-26w-v1:d002-practice',
    completed: true,
    expectedRevision: 2,
    mutationId: randomUUID(),
    submission: {
      tasks: plan.source.days[1]!.tasks.map((task) => ({
        taskId: task.id,
        status: 'done',
        reason: '',
        choice: '',
      })),
      evidence: 'Valid Day 2 solution before change',
      selectedScope: '',
      attested: true,
      result: 'passed',
      transferPath: null,
      transferReflection: '',
      scoreEvidence: '',
      remediationNote: '',
    },
  });

  // Save a note on Day 1
  saveNote(store, token, {
    itemId: 'se-26w-v1:d001',
    body: 'My private note on Day 1',
    expectedStudentId: requireStudent(store, token).id,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  publishSecondRelease(store.native);

  // Execute upgrade
  const result = await executeCurriculumUpgrade({
    dataDir: directory,
    root,
    dryRun: false,
    targetReleaseId: 'se-26w-v2',
  });

  expect(
    result.plans[0]!.transferredLessons.some(
      (l) => l.stableKey === 'd001-learn',
    ),
  ).toBe(true);
  expect(
    result.plans[0]!.transferredExercises.some(
      (e) => e.stableKey === 'd001-practice',
    ),
  ).toBe(true);
  // Day 2 exercise was materially changed -> must require reattempt
  expect(
    result.plans[0]!.reattemptRequiredExercises.some(
      (e) => e.stableKey === 'd002-practice',
    ),
  ).toBe(true);

  // Verify database state after upgrade
  const enrollment = ownedEnrollment(store, token);
  expect(enrollment?.releaseId).toBe('se-26w-v2');

  // Verify Day 1 lesson progress transferred to v2
  const up1 = store.orm
    .select()
    .from(s.userProgress)
    .where(eq(s.userProgress.lessonId, 'se-26w-v2:d001-learn'))
    .get();
  expect(up1?.status).toBe('completed');

  // Verify Day 1 exercise progress transferred to v2
  const ep1 = store.orm
    .select()
    .from(s.exerciseProgress)
    .where(eq(s.exerciseProgress.exerciseId, 'se-26w-v2:d001-practice'))
    .get();
  expect(ep1?.status).toBe('completed');
  expect(ep1?.evidenceText).toBe('Valid Day 1 passing code solution');

  // Verify Day 2 exercise (materially changed) did NOT transfer as completed
  const ep2 = store.orm
    .select()
    .from(s.exerciseProgress)
    .where(eq(s.exerciseProgress.exerciseId, 'se-26w-v2:d002-practice'))
    .get();
  expect(ep2).toBeUndefined(); // requires fresh reattempt

  // Verify note transferred to v2 content item
  const note1 = readNote(store, token, 'se-26w-v2:d001');
  expect(note1?.body).toBe('My private note on Day 1');
}, 30000);

it('safely falls back cursor when resume target was removed in new release (§233)', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);

  const token = await createStudent('dan@example.com');
  startCourse(store, token);

  // Point cursor to d003-practice (which is removed in v2)
  mutateLearning(store, token, {
    kind: 'cursor',
    itemId: 'se-26w-v1:d003-practice',
    mode: 'study',
    anchor: 'tasks',
    expectedRevision: 0,
    mutationId: randomUUID(),
  });

  publishSecondRelease(store.native);

  const enrollmentBefore = ownedEnrollment(store, token);
  expect(enrollmentBefore?.resumeItemId).toBe('se-26w-v1:d003-practice');

  // Execute upgrade
  const result = await executeCurriculumUpgrade({
    dataDir: directory,
    root,
    dryRun: false,
    targetReleaseId: 'se-26w-v2',
  });

  expect(result.plans[0]!.cursorResolution.fallbackApplied).toBe(true);

  // In database, resumeItemId should have safely fallen back (null so resolver handles it)
  const enrollmentAfter = ownedEnrollment(store, token);
  expect(enrollmentAfter?.releaseId).toBe('se-26w-v2');
  expect(enrollmentAfter?.resumeItemId).toBeNull();
}, 30000);

it('records release_migrated activity event during upgrade', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);

  const token = await createStudent('eva@example.com');
  startCourse(store, token);

  publishSecondRelease(store.native);

  await executeCurriculumUpgrade({
    dataDir: directory,
    root,
    dryRun: false,
    targetReleaseId: 'se-26w-v2',
  });

  const events = store.orm
    .select()
    .from(s.activityEvent)
    .where(eq(s.activityEvent.type, 'release_migrated'))
    .all();

  expect(events).toHaveLength(1);
  const payload = JSON.parse(events[0]!.payloadJson);
  expect(payload.fromRelease).toBe('se-26w-v1');
  expect(payload.toRelease).toBe('se-26w-v2');
}, 30000);

it('does not silently change enrollments when new release is imported (A24)', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);

  const token = await createStudent('frank@example.com');
  startCourse(store, token);

  // Now publish a second release
  publishSecondRelease(store.native);

  // Existing student MUST remain pinned to se-26w-v1
  const enrollment = ownedEnrollment(store, token);
  expect(enrollment?.releaseId).toBe('se-26w-v1');
}, 30000);

it('runs CLI scripts/upgrade-curriculum.mjs with --dry-run and reports plan', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);

  const token = await createStudent('grace@example.com');
  startCourse(store, token);

  publishSecondRelease(store.native);

  const { code, stdout } = await runProcess(
    [
      'scripts/upgrade-curriculum.mjs',
      '--dry-run',
      '--target-release',
      'se-26w-v2',
    ],
    {
      ...process.env,
      APP_DATA_DIR: directory,
    },
  );

  expect(code).toBe(0);
  expect(stdout).toContain('Curriculum Upgrade Plan (DRY RUN)');
  expect(stdout).toContain('grace@example.com');
  expect(stdout).toContain('se-26w-v1 -> se-26w-v2');
}, 30000);
