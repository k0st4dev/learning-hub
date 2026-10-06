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
import { digest } from '../../src/server/auth/crypto';
import {
  startCourse,
  mutateLearning,
  mutationSchema,
} from '../../src/server/learning/mutate';
import { snapshot, continuePath } from '../../src/server/learning/read';
import { readActivity } from '../../src/server/learning/activity';
import { studyContext } from '../../src/domain/study-context';
import { requiredProgress } from '../../src/domain/progress';
import { progressPresentation } from '../../src/domain/progress-presentation';
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
    scoreEvidence: '',
    remediationNote: '',
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
  it('persists only active allowlisted anchors without progress, history or reference changes; replays and rejects stale writes', async () => {
    save({ kind: 'orientation', acknowledged: true, deferred: true });
    save({
      kind: 'cursor',
      mode: 'study',
      itemId: id('d017-practice'),
      anchor: 'tasks',
    });
    save({
      kind: 'cursor',
      mode: 'open',
      itemId: id('d028-learn'),
      anchor: 'study',
    });
    const before = snapshot(store, token)!;
    const history = counts()[2];
    const data = {
      kind: 'cursor',
      mode: 'anchor',
      itemId: id('d017-practice'),
      anchor: 'd017-task-02',
      expectedRevision: before.revision,
      mutationId: randomUUID(),
    };
    const saved = mutateLearning(store, token, data);
    expect(saved.enrollment).toMatchObject({
      resumeItemId: id('d017-practice'),
      resumeAnchor: 'd017-task-02',
      lastOpenedItemId: before.enrollment.lastOpenedItemId,
      lastOpenedAt: before.enrollment.lastOpenedAt,
    });
    expect(saved.completed).toBe(0);
    expect(saved.exerciseProgress).toEqual(before.exerciseProgress);
    expect(saved.tasks).toEqual(before.tasks);
    expect(counts()[2]).toEqual(history);
    expect(continuePath(saved)).toContain('#d017-task-02');
    const baseline = counts();
    expect(mutateLearning(store, token, data)).toEqual(saved);
    expect(counts()).toEqual(baseline);
    expect(() =>
      mutateLearning(store, token, { ...data, mutationId: randomUUID() }),
    ).toThrow('another tab');
    for (const change of [
      { itemId: id('d017-practice'), anchor: 'd018-task-01' },
      { itemId: id('d017-practice'), anchor: 'javascript:bad' },
      { itemId: id('d028-learn'), anchor: 'study' },
      {
        itemId: id('d017-practice'),
        anchor: 'ai',
        expectedStudentId: 'other-account',
      },
    ]) {
      expect(() =>
        save({ kind: 'cursor', mode: 'anchor', ...change }),
      ).toThrow();
      expect(snapshot(store, token)).toEqual(saved);
      expect(counts()).toEqual(baseline);
    }
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    token = (await login(store, { email: 'work@example.test', password }))
      .token;
    expect(continuePath(snapshot(store, token))).toContain('#d017-task-02');
    expect(snapshot(store, token)!.completed).toBe(0);
    save(payload(17));
    const completedState = snapshot(store, token);
    expect(() =>
      save({
        kind: 'cursor',
        mode: 'anchor',
        itemId: id('d017-practice'),
        anchor: 'ai',
      }),
    ).toThrow('active study location');
    expect(snapshot(store, token)).toEqual(completedState);
  });
  it('acknowledges the current task in the same exercise transaction and validates its pinned section', () => {
    const data = { ...payload(17, false), anchor: 'd017-task-02' };
    expect(save(data).enrollment.resumeAnchor).toBe('d017-task-02');
    const before = snapshot(store, token);
    const baseline = counts();
    expect(() => save({ ...data, anchor: 'd018-task-01' })).toThrow('section');
    expect(snapshot(store, token)).toEqual(before);
    expect(counts()).toEqual(baseline);
    expect(
      save({
        kind: 'cursor',
        mode: 'study',
        itemId: id('d001-learn'),
        anchor: 'criterion',
      }).enrollment.resumeAnchor,
    ).toBe('criterion');
    expect(() =>
      save({
        kind: 'cursor',
        mode: 'anchor',
        itemId: id('d001-learn'),
        anchor: 'evidence',
      }),
    ).toThrow('section');
  });
  it('derives all published scope denominators and the 13/14 week example; reopening cascades', () => {
    const initial = progressPresentation(snapshot(store, token)!);
    expect(initial.summary).toMatchObject({
      total: 364,
      completed: 0,
      totalDays: 182,
      remainingLessons: 182,
      remainingExercises: 182,
    });
    expect(
      initial.modules.map(
        (phase) => requiredProgress(initial.scopes.get(phase.id)!).total,
      ),
    ).toEqual([56, 28, 84, 98, 84, 14]);
    for (const week of snapshot(store, token)!.items.filter(
      (item) => item.kind === 'week',
    ))
      expect(requiredProgress(initial.scopes.get(week.id)!).total).toBe(14);
    for (let day = 1; day <= 6; day++) {
      save({
        kind: 'lesson',
        itemId: id(`d${String(day).padStart(3, '0')}-learn`),
        completed: true,
      });
      save(payload(day));
    }
    save({ kind: 'lesson', itemId: id('d007-learn'), completed: true });
    const review = payload(7, false);
    review.submission.result = 'needs_review';
    save(review);
    let state = snapshot(store, token)!;
    let model = progressPresentation(state);
    expect(model.summary).toMatchObject({
      completed: 13,
      percent: 3,
      completedDays: 6,
      needsReview: 1,
    });
    expect(requiredProgress(model.scopes.get(id('w01'))!)).toMatchObject({
      completed: 13,
      total: 14,
      percent: 92,
    });
    expect(model.checkpoint).toMatchObject({
      id: id('d007-practice'),
      complete: false,
      needsReview: true,
    });
    const dayOne = model.scopes.get(id('d001'))!;
    expect(requiredProgress(dayOne).completedAt).toBe(
      Math.max(...dayOne.map((unit) => unit.completedAt!)),
    );
    save({ kind: 'lesson', itemId: id('d003-learn'), completed: false });
    state = snapshot(store, token)!;
    model = progressPresentation(state);
    expect(model.summary).toMatchObject({
      completed: 12,
      percent: 3,
      completedDays: 5,
    });
    expect(requiredProgress(model.scopes.get(id('w01'))!)).toMatchObject({
      completed: 12,
      percent: 85,
      completedAt: null,
    });
    expect(requiredProgress(model.scopes.get(id('f1'))!)).toMatchObject({
      completed: 12,
      total: 56,
    });
    expect(requiredProgress(model.scopes.get(id('d003'))!).percent).toBe(50);
    expect(model.scopes.get(id('appendix-g'))).toBeUndefined();
  });
  it('derives 100 percent only after all 364 confirmed units, then removes it on reopening', () => {
    save({ kind: 'orientation', acknowledged: true, deferred: true });
    const enrollment = store.native
      .prepare('SELECT id FROM enrollment')
      .get() as { id: string };
    // Read-model fixture in this isolated test DB; no import or real student data is modified.
    const timestamp = Date.UTC(2026, 9, 5, 12);
    const lessonInsert = store.native.prepare(
      "INSERT INTO user_progress (enrollment_id,release_id,lesson_id,status,started_at,completed_at,updated_at) VALUES (?, ?, ?, 'completed', ?, ?, ?)",
    );
    const exerciseInsert = store.native.prepare(
      "INSERT INTO exercise_progress (enrollment_id,release_id,exercise_id,status,started_at,completed_at,updated_at,criterion_attested_at,result,evidence_text) VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, 'passed', 'Synthetic read-model fixture')",
    );
    for (const unit of snapshot(store, token)!.units)
      if (unit.kind === 'lesson')
        lessonInsert.run(
          enrollment.id,
          plan.releaseId,
          unit.id,
          timestamp,
          timestamp,
          timestamp,
        );
      else
        exerciseInsert.run(
          enrollment.id,
          plan.releaseId,
          unit.id,
          timestamp,
          timestamp,
          timestamp,
          timestamp,
        );
    let state = snapshot(store, token)!;
    expect(progressPresentation(state).summary).toMatchObject({
      completed: 364,
      total: 364,
      percent: 100,
      completedDays: 182,
      remainingLessons: 0,
      remainingExercises: 0,
      completedAt: timestamp,
    });
    expect(continuePath(state)).toBe('/course/software-engineer/progress');
    save({ kind: 'lesson', itemId: id('d182-learn'), completed: false });
    state = snapshot(store, token)!;
    expect(progressPresentation(state).summary).toMatchObject({
      completed: 363,
      percent: 99,
      completedDays: 181,
      completedAt: null,
    });
    expect(continuePath(state)).toContain('/d182/lessons/d182-learn#study');
  });
  it('records reference visits separately, starts deliberate study without credit, and survives restart', async () => {
    save({ kind: 'orientation', acknowledged: true, deferred: true });
    save({
      kind: 'cursor',
      mode: 'study',
      itemId: id('d002-learn'),
      anchor: 'study',
    });
    const before = snapshot(store, token)!;
    expect(before.completed).toBe(0);
    expect(before.lessonProgress).toMatchObject([
      { lessonId: id('d002-learn'), status: 'started', completedAt: null },
    ]);
    save({
      kind: 'cursor',
      mode: 'open',
      itemId: id('d028-learn'),
      anchor: 'study',
    });
    expect(snapshot(store, token)!.enrollment.resumeItemId).toBe(
      id('d002-learn'),
    );
    expect(continuePath(snapshot(store, token))).toContain(
      '/d002/lessons/d002-learn#study',
    );
    expect(
      store.native
        .prepare('SELECT last_opened_item_id AS item FROM enrollment')
        .get(),
    ).toEqual({ item: id('d028-learn') });
    expect(
      studyContext(snapshot(store, token)!, id('d028-learn')).outOfSequence,
    ).toBe(true);
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    token = (await login(store, { email: 'work@example.test', password }))
      .token;
    expect(continuePath(snapshot(store, token))).toContain(
      '/d002/lessons/d002-learn#study',
    );
    expect(snapshot(store, token)!.completed).toBe(0);
  });
  it('keeps study/exercise independent and completed review visits cannot replace Day 2', () => {
    save({ kind: 'orientation', acknowledged: true, deferred: true });
    expect(
      save({ kind: 'lesson', itemId: id('d001-learn'), completed: true })
        .completed,
    ).toBe(1);
    let state = snapshot(store, token)!;
    expect(state.total).toBe(364);
    expect(studyContext(state, id('d001-learn'))).toMatchObject({
      completed: 1,
      total: 2,
      lessonComplete: true,
      exerciseComplete: false,
    });
    expect(continuePath(state)).toContain(
      '/d001/exercises/d001-practice#tasks',
    );
    state = save(payload(1));
    expect(state.completed).toBe(2);
    expect(continuePath(state)).toContain('/d002/lessons/d002-learn#study');
    save({
      kind: 'cursor',
      mode: 'study',
      itemId: id('d002-learn'),
      anchor: 'study',
    });
    const timestamp = state.lessonProgress[0]!.completedAt;
    save({
      kind: 'cursor',
      mode: 'open',
      itemId: id('d001-learn'),
      anchor: 'study',
    });
    save({
      kind: 'cursor',
      mode: 'study',
      itemId: id('d001-learn'),
      anchor: 'study',
    });
    save({ kind: 'lesson', itemId: id('d001-learn'), completed: true });
    save(payload(1));
    expect(snapshot(store, token)!.enrollment.resumeItemId).toBe(
      id('d002-learn'),
    );
    expect(
      snapshot(store, token)!.lessonProgress.find(
        (p) => p.lessonId === id('d001-learn'),
      )!.completedAt,
    ).toBe(timestamp);
    state = save({
      kind: 'lesson',
      itemId: id('d001-learn'),
      completed: false,
    });
    expect(state.completed).toBe(1);
    expect(state.exerciseProgress[0]!.status).toBe('completed');
    expect(continuePath(state)).toContain('/d001/lessons/d001-learn#study');
  });
  it('returns from completed later work to earlier gaps and rejects changed-account study writes atomically', () => {
    save({ kind: 'orientation', acknowledged: true, deferred: true });
    save({
      kind: 'cursor',
      mode: 'study',
      itemId: id('d028-learn'),
      anchor: 'study',
    });
    save({ kind: 'lesson', itemId: id('d028-learn'), completed: true });
    expect(continuePath(snapshot(store, token))).toContain(
      '/d028/exercises/d028-practice#tasks',
    );
    save(payload(28));
    expect(continuePath(snapshot(store, token))).toContain(
      '/d001/lessons/d001-learn#study',
    );
    const before = snapshot(store, token);
    for (const change of [
      { kind: 'lesson', itemId: id('d001-learn'), completed: true },
      {
        kind: 'cursor',
        mode: 'study',
        itemId: id('d001-learn'),
        anchor: 'study',
      },
    ]) {
      expect(() =>
        save({ ...change, expectedStudentId: 'other-account' }),
      ).toThrow('account changed');
      expect(snapshot(store, token)).toEqual(before);
    }
  });
  it('loads every assessment from published metadata without inventing pass marks', () => {
    const assessments = plan.source.days.filter(
      (day) => day.assessment_kind !== 'practice',
    );
    expect(assessments).toHaveLength(26);
    for (const day of assessments) {
      const { requirements } = loadExerciseRequirements(
        store,
        plan.releaseId,
        id(day.exercise_id),
      );
      expect(requirements.assessment).toEqual({
        kind: day.assessment_kind,
        dayNumber: day.number,
        criterion: day.completion_criterion,
        aiPolicy: day.ai_policy,
        studyInstruction: day.study_instruction,
      });
    }
  });
  it('restores assessment notes after restart, retains lesson credit and records review transitions once', async () => {
    const data = payload(7, false);
    data.submission.result = 'needs_review';
    data.submission.scoreEvidence =
      '6/10; isPrime and reverseNumber need fixes';
    data.submission.remediationNote = 'Repeat Days 3–5 before another attempt';
    save({ kind: 'lesson', itemId: id('d007-learn'), completed: true });
    const saved = save(data);
    expect(saved.completed).toBe(1);
    save(data);
    const reviewHistory = readActivity(store, token, { limit: 20 });
    expect(reviewHistory.events.map((event) => event.type)).toEqual([
      'checkpoint_needs_review',
      'lesson_completed',
    ]);
    expect(reviewHistory.events[0]!.itemStableKey).toBe('d007-practice');
    expect(JSON.stringify(reviewHistory)).not.toContain('remediationNote');
    expect(
      store.native
        .prepare(
          "SELECT count(*) AS n FROM activity_event WHERE type='checkpoint_needs_review'",
        )
        .get(),
    ).toEqual({ n: 1 });
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    token = (await login(store, { email: 'work@example.test', password }))
      .token;
    expect(snapshot(store, token)!.exerciseProgress[0]!.submission).toEqual(
      data.submission,
    );
    expect(snapshot(store, token)!.exerciseProgress[0]!.status).toBe('started');
    expect(snapshot(store, token)!.completed).toBe(1);
    expect(readActivity(store, token, { limit: 20 })).toEqual(reviewHistory);
    data.submission.result = 'passed';
    data.submission.scoreEvidence = '8/10, all three problems solved';
    expect(save({ ...data, completed: true }).completed).toBe(2);
    data.submission.result = 'needs_review';
    expect(save(data).completed).toBe(1);
    const beforeReading = snapshot(store, token);
    expect(
      readActivity(store, token, { limit: 20 }).events.map(
        (event) => event.type,
      ),
    ).toEqual([
      'day_reopened',
      'checkpoint_needs_review',
      'exercise_reopened',
      'day_completed',
      'exercise_completed',
      'checkpoint_needs_review',
      'lesson_completed',
    ]);
    expect(snapshot(store, token)).toEqual(beforeReading);
    expect(
      store.native
        .prepare(
          "SELECT count(*) AS n FROM activity_event WHERE type='checkpoint_needs_review'",
        )
        .get(),
    ).toEqual({ n: 2 });
  });
  it('supports legacy saved work and receipt retries while rejecting assessment notes on practice', () => {
    const data = {
      ...payload(1),
      expectedRevision: 0,
      mutationId: randomUUID(),
    };
    const saved = mutateLearning(store, token, data);
    const canonical = mutationSchema.parse(data);
    if (!('submission' in canonical)) throw new Error('Expected exercise work');
    const legacy = {
      ...canonical,
      submission: Object.fromEntries(
        Object.entries(canonical.submission).filter(
          ([key]) => !['scoreEvidence', 'remediationNote'].includes(key),
        ),
      ),
    };
    store.native
      .prepare('UPDATE mutation_receipt SET request_hash=? WHERE mutation_id=?')
      .run(digest(JSON.stringify(legacy)), data.mutationId);
    expect(mutateLearning(store, token, legacy)).toEqual(saved);
    store.native
      .prepare(
        "UPDATE exercise_progress SET rubric_json=json_remove(rubric_json, '$.exerciseWork.scoreEvidence', '$.exerciseWork.remediationNote')",
      )
      .run();
    expect(
      snapshot(store, token)!.exerciseProgress[0]!.submission,
    ).toMatchObject({ scoreEvidence: '', remediationNote: '' });
    const forged = payload(1, false);
    forged.submission.remediationNote = 'not an assessment';
    const before = snapshot(store, token);
    expect(() => save(forged)).toThrow('Assessment notes');
    expect(snapshot(store, token)).toEqual(before);
    const oversized = payload(7, false);
    oversized.submission.remediationNote = 'x'.repeat(2001);
    expect(() => save(oversized)).toThrow();
    expect(snapshot(store, token)).toEqual(before);
  });
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
