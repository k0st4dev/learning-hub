import { beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import { register, login } from '../../src/server/auth/service';
import { startCourse, mutateLearning } from '../../src/server/learning/mutate';
import { snapshot } from '../../src/server/learning/read';
import { loadExerciseRequirements } from '../../src/server/learning/exercise-work';
import {
  alternativeRoutes,
  type ExerciseSubmission,
} from '../../src/domain/exercise-requirements';

const root = process.cwd();
let plan: Awaited<ReturnType<typeof loadArchivedCurriculum>>;
let store: Store;
let directory: string;
let token: string;
const password = 'Local exercise persistence test password';
const id = (key: string) => `se-26w-v1:${key}`;
beforeAll(async () => {
  plan = await loadArchivedCurriculum(root);
});
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/exercise-work-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  importCurriculum(store, plan.source);
  await register(store, {
    email: 'work@example.test',
    password,
    confirmation: password,
  });
  token = (await login(store, { email: 'work@example.test', password })).token;
  startCourse(store, token);
});
afterEach(async () => {
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('exercise-work-test-')
  )
    throw new Error('Unexpected test directory');
  await rm(directory, { recursive: true, force: true });
});
function payload(number: number, completed = true) {
  const day = plan.source.days.find((day) => day.number === number)!;
  const submission: ExerciseSubmission = {
    tasks: day.tasks.map((task) => ({
      taskId: task.id,
      status: 'done',
      reason: '',
      choice:
        task.requirement_mode === 'alternative'
          ? alternativeRoutes[task.id as keyof typeof alternativeRoutes][0]
          : '',
    })),
    evidence: 'commit abc123: independent implementation and criterion review',
    selectedScope: 'Recorded assignment identifiers and permitted path',
    attested: true,
    result: 'passed',
    transferPath: number === 125 ? 'go' : null,
    transferReflection: '',
  };
  return {
    kind: 'exercise' as const,
    itemId: id(day.exercise_id),
    completed,
    submission,
  };
}
function save(change: Record<string, unknown>, session = token) {
  return mutateLearning(store, session, {
    mutationId: randomUUID(),
    expectedRevision: snapshot(store, session)!.revision,
    ...change,
  });
}
function counts() {
  return [
    'task_progress',
    'exercise_progress',
    'activity_event',
    'mutation_receipt',
  ].map((table) =>
    store.native.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get(),
  );
}

describe('owned full-course exercise transactions', () => {
  it('derives all 548 task requirements from the published database and reviewed assignment scope', () => {
    let count = 0;
    for (const day of plan.source.days) {
      const { requirements, taskIds } = loadExerciseRequirements(
        store,
        plan.releaseId,
        id(day.exercise_id),
      );
      expect(requirements.tasks).toEqual(
        day.tasks.map((task) => ({
          id: task.id,
          requirement_mode: task.requirement_mode,
          completion_rule: task.completion_rule,
        })),
      );
      for (const task of day.tasks)
        expect(taskIds.get(task.id)).toBe(id(task.id));
      count += taskIds.size;
    }
    expect(count).toBe(548);
    for (const day of [85, 89, 96, 117, 123, 131, 135, 152, 160, 167, 174]) {
      const data = payload(day);
      data.submission.selectedScope = ' ';
      expect(() => save(data), `day ${day}`).toThrow('selected scope');
    }
    const day1 = payload(1);
    day1.submission.selectedScope = '';
    expect(save(day1).completed).toBe(1);
  });
  it('persists alternatives and Day 125 reflection through database restart and login', async () => {
    const alternate = payload(17);
    alternate.submission.tasks[1]!.choice = 'manual_copy';
    save(alternate);
    const transfer = payload(125);
    transfer.submission.transferPath = 'existing_languages';
    transfer.submission.transferReflection =
      'Compared prior JS/C/Python binary search: same invariant, different types and syntax.';
    transfer.submission.tasks = transfer.submission.tasks.filter(
      (task) => task.taskId !== 'd125-task-01',
    );
    transfer.submission.tasks[0]!.status = 'not_applicable';
    transfer.submission.tasks[0]!.reason =
      'Existing-language transfer selected';
    const saved = save(transfer);
    expect(saved.completed).toBe(2);
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    token = (await login(store, { email: 'work@example.test', password }))
      .token;
    const restored = snapshot(store, token)!;
    expect(
      restored.exerciseProgress.find((p) => p.exerciseId === transfer.itemId)
        ?.submission,
    ).toEqual(transfer.submission);
    expect(
      restored.exerciseProgress.find((p) => p.exerciseId === alternate.itemId)
        ?.submission,
    ).toEqual(alternate.submission);
    expect(restored.completed).toBe(2);
    const firstTimestamp = restored.exerciseProgress.find(
      (p) => p.exerciseId === transfer.itemId,
    )!.completedAt;
    expect(
      save(transfer).exerciseProgress.find(
        (p) => p.exerciseId === transfer.itemId,
      )!.completedAt,
    ).toBe(firstTimestamp);
  });
  it('saves incomplete drafts, requires valid decisions, and completes optional/mixed work correctly', () => {
    const draft = payload(17, false);
    draft.submission.tasks = [];
    draft.submission.evidence = '';
    draft.submission.attested = false;
    draft.submission.result = null;
    draft.submission.selectedScope = '';
    const state = save(draft);
    expect(state.completed).toBe(0);
    expect(state.exerciseProgress[0]?.submission).toEqual(draft.submission);
    expect(() => save({ ...draft, completed: true })).toThrow();
    const optional = payload(131);
    optional.submission.tasks = optional.submission.tasks.filter(
      (task) => task.taskId !== 'd131-task-03',
    );
    expect(save(optional).completed).toBe(1);
    const mixed = payload(20);
    mixed.submission.tasks.pop();
    expect(() => save(mixed)).toThrow();
    expect(save(payload(20)).completed).toBe(2);
    const conditional = payload(25);
    conditional.submission.tasks[2]!.status = 'not_applicable';
    conditional.submission.tasks[2]!.reason =
      'Manual testing path; overall suite criterion satisfied';
    expect(save(conditional).completed).toBe(3);
  });
  it.each([7, 28, 182])(
    'keeps needs-review day %i started and rejects forged completion',
    (number) => {
      const data = payload(number);
      data.submission.result = 'needs_review';
      const before = snapshot(store, token);
      expect(() => save(data)).toThrow();
      expect(snapshot(store, token)).toEqual(before);
      const saved = save({ ...data, completed: false });
      expect(saved.completed).toBe(0);
      expect(saved.exerciseProgress[0]).toMatchObject({
        result: 'needs_review',
        status: 'started',
        completedAt: null,
        criterionAttestedAt: null,
      });
    },
  );
  it('rejects foreign/duplicate tasks, invalid skips and choices even in draft saves', () => {
    const before = snapshot(store, token);
    const baseline = counts();
    const cases = [
      payload(17, false),
      payload(17, false),
      payload(17, false),
      payload(17, false),
      payload(25, false),
    ];
    cases[0]!.submission.tasks[0]!.taskId = 'd018-task-01';
    cases[1]!.submission.tasks.push(cases[1]!.submission.tasks[0]!);
    cases[2]!.submission.tasks[0]!.status = 'not_applicable';
    cases[2]!.submission.tasks[0]!.reason = 'skip';
    cases[3]!.submission.tasks[1]!.choice = 'skip_work';
    cases[4]!.submission.tasks[2]!.status = 'not_applicable';
    for (const data of cases) {
      expect(() => save(data)).toThrow();
      expect(snapshot(store, token)).toEqual(before);
      expect(counts()).toEqual(baseline);
    }
    const transfer = payload(125);
    transfer.submission.tasks[1]!.status = 'not_applicable';
    transfer.submission.tasks[1]!.reason = 'skip';
    expect(() => save(transfer)).toThrow();
  });
  it('closes the legacy API bypass and rejects client-supplied policies or ownership', async () => {
    expect(() =>
      save({ kind: 'task', itemId: id('d001-task-01'), done: true }),
    ).toThrow('full exercise');
    expect(() =>
      save({
        kind: 'exercise',
        itemId: id('d001-practice'),
        completed: true,
        evidence: 'x',
        attested: true,
        result: 'passed',
      }),
    ).toThrow('full exercise');
    expect(() =>
      save({ ...payload(1), itemId: 'development-day1-v1:d001-practice' }),
    ).toThrow('enrolled release');
    expect(() => save({ ...payload(1), userId: 'someone-else' })).toThrow();
    expect(() =>
      save({ ...payload(1), requirements: { requiresScope: false } }),
    ).toThrow();
    save(payload(17));
    const owner = snapshot(store, token);
    await register(store, {
      email: 'other-work@example.test',
      password,
      confirmation: password,
    });
    const other = (
      await login(store, { email: 'other-work@example.test', password })
    ).token;
    expect(startCourse(store, other).exerciseProgress).toHaveLength(0);
    expect(snapshot(store, other)!.tasks).toHaveLength(0);
    const beforeAccountChange = counts();
    expect(() =>
      save(
        { ...payload(1), expectedStudentId: 'previous-session-owner' },
        other,
      ),
    ).toThrow('account changed');
    expect(counts()).toEqual(beforeAccountChange);
    expect(snapshot(store, other)!.exerciseProgress).toHaveLength(0);
    save(payload(1), other);
    expect(
      snapshot(store, other)!.exerciseProgress.map((p) => p.exerciseId),
    ).toEqual([id('d001-practice')]);
    expect(snapshot(store, token)).toEqual(owner);
  });
  it('replays exact receipts, rejects stale/reused saves, and preserves timestamps', () => {
    const data = {
      ...payload(17),
      expectedRevision: 0,
      mutationId: randomUUID(),
    };
    const original = mutateLearning(store, token, data);
    const baseline = counts();
    expect(mutateLearning(store, token, data)).toEqual(original);
    expect(counts()).toEqual(baseline);
    expect(() =>
      mutateLearning(store, token, { ...data, completed: false }),
    ).toThrow('identifier');
    expect(() =>
      mutateLearning(store, token, { ...data, mutationId: randomUUID() }),
    ).toThrow('another tab');
    expect(snapshot(store, token)).toEqual(original);
  });
  it('explicitly reopens one exercise without changing another or erasing unrelated rubric fields', () => {
    save(payload(17));
    save(payload(20));
    store.native
      .prepare(
        "UPDATE exercise_progress SET rubric_json=json_set(rubric_json, '$.futureRubric', 'retained') WHERE exercise_id=?",
      )
      .run(id('d017-practice'));
    const other = snapshot(store, token)!.exerciseProgress.find(
      (p) => p.exerciseId === id('d020-practice'),
    );
    const reopen = payload(17, false);
    reopen.submission.tasks = [];
    const saved = save(reopen);
    expect(saved.completed).toBe(1);
    expect(
      saved.exerciseProgress.find((p) => p.exerciseId === id('d020-practice')),
    ).toEqual(other);
    const work = saved.exerciseProgress.find(
      (p) => p.exerciseId === reopen.itemId,
    )!;
    expect(work).toMatchObject({
      status: 'started',
      completedAt: null,
      criterionAttestedAt: null,
    });
    expect(JSON.parse(work.rubricJson).futureRubric).toBe('retained');
    expect(
      store.native
        .prepare(
          "SELECT count(*) AS n FROM activity_event WHERE type='exercise_reopened'",
        )
        .get(),
    ).toEqual({ n: 1 });
  });
  it('rolls back task decisions, evidence, cursor, events and revision on a failed receipt write', () => {
    const before = snapshot(store, token);
    const baseline = counts();
    store.native.exec(
      "CREATE TRIGGER fail_receipt BEFORE INSERT ON mutation_receipt BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END;",
    );
    expect(() => save(payload(17))).toThrow('simulated disk failure');
    expect(snapshot(store, token)).toEqual(before);
    expect(counts()).toEqual(baseline);
  });
  it('refuses unpublished pinned release writes and malformed saved decisions without resetting data', () => {
    save(payload(17));
    store.native
      .prepare("UPDATE course_release SET status='retired' WHERE id=?")
      .run(plan.releaseId);
    const before = snapshot(store, token);
    expect(() => save(payload(20))).toThrow('course version');
    expect(snapshot(store, token)).toEqual(before);
    store.native
      .prepare('UPDATE exercise_progress SET rubric_json=?')
      .run(JSON.stringify({ exerciseWork: { version: 999 } }));
    expect(() => snapshot(store, token)).toThrow('decisions are unavailable');
    expect(
      store.native.prepare('SELECT count(*) AS n FROM exercise_progress').get(),
    ).toEqual({ n: 1 });
  });
});
