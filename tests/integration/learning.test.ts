import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../src/server/db/migrate.ts';
import { openDatabase, type Store } from '../../src/server/db/connection.ts';
import { seedDay1Fixture } from '../../src/server/content/day1-fixture.ts';
import { register, login } from '../../src/server/auth/service.ts';
import {
  startCourse,
  mutateLearning,
} from '../../src/server/learning/mutate.ts';
import { snapshot, continuePath } from '../../src/server/learning/read.ts';
const root = process.cwd();
let directory: string;
let store: Store;
let token: string;
const password = 'A quiet river under bright stars';
const item = (key: string) => `development-day1-v1:${key}`;
const lesson = item('d001-learn');
const exercise = item('d001-practice');
function save(change: Record<string, unknown>) {
  return mutateLearning(store, token, {
    mutationId: randomUUID(),
    expectedRevision: snapshot(store, token)!.revision,
    ...change,
  });
}
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/learning-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  await seedDay1Fixture(store.orm, root, directory);
  await register(store, {
    email: 'first@example.test',
    password,
    confirmation: password,
  });
  token = (await login(store, { email: 'first@example.test', password })).token;
});
afterEach(async () => {
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('learning-test-')
  )
    throw new Error('Unexpected test directory');
  await rm(directory, { recursive: true, force: true });
});
describe('transactional Day 1 journey', () => {
  it('requires explicit enrollment and preparation acknowledgement; derives two equal units', () => {
    expect(continuePath(snapshot(store, token))).toBe(
      '/course/software-engineer',
    );
    const state = startCourse(store, token);
    expect(startCourse(store, token).revision).toBe(0);
    expect(state.total).toBe(2);
    expect(continuePath(state)).toMatch(/preparation$/);
    expect(() =>
      save({ kind: 'orientation', acknowledged: true, deferred: false }),
    ).toThrow('Complete the preparation');
    save({ kind: 'orientation', acknowledged: true, deferred: true });
    expect(continuePath(snapshot(store, token))).toMatch(
      /lessons\/d001-learn#study$/,
    );
    const partial = save({ kind: 'lesson', itemId: lesson, completed: true });
    expect([partial.completed, partial.total, partial.percent]).toEqual([
      1, 2, 50,
    ]);
    expect(continuePath(partial)).toMatch(/exercises\/d001-practice#tasks$/);
  });
  it('gates exercise completion, persists evidence, and reopens when a required task is unchecked', () => {
    startCourse(store, token);
    save({ kind: 'orientation', acknowledged: true, deferred: true });
    const completion = {
      kind: 'exercise',
      itemId: exercise,
      completed: true,
      evidence: 'Commit abc123: baseline runs.',
      attested: true,
      result: 'passed',
    };
    expect(() => save(completion)).toThrow('Complete every required task');
    for (let n = 1; n <= 4; n++)
      save({ kind: 'task', itemId: item(`d001-task-0${n}`), done: true });
    expect(() => save({ ...completion, attested: false })).toThrow();
    expect(() => save({ ...completion, evidence: ' ' })).toThrow();
    expect(() => save({ ...completion, result: 'needs_review' })).toThrow();
    expect(save(completion).percent).toBe(50);
    expect(
      save({ kind: 'lesson', itemId: lesson, completed: true }).percent,
    ).toBe(100);
    expect(continuePath(snapshot(store, token))).toMatch(/progress$/);
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(snapshot(store, token)?.percent).toBe(100);
    const reopened = save({
      kind: 'task',
      itemId: item('d001-task-02'),
      done: false,
    });
    expect(reopened.percent).toBe(50);
    expect(reopened.exerciseProgress[0]).toMatchObject({
      evidenceText: completion.evidence,
      criterionAttestedAt: null,
      completedAt: null,
      status: 'started',
    });
    expect(reopened.tasks).toHaveLength(3);
    expect(continuePath(reopened)).toMatch(/d001-practice#d001-task-02$/);
    const events = store.native
      .prepare('SELECT type FROM activity_event')
      .all();
    expect(events).toContainEqual({ type: 'day_reopened' });
    expect(events).toContainEqual({ type: 'course_reopened' });
  });
  it('replays the original receipt, rejects conflicting reuse and stale revisions without changes', () => {
    startCourse(store, token);
    const input = {
      kind: 'lesson',
      itemId: lesson,
      completed: true,
      mutationId: randomUUID(),
      expectedRevision: 0,
    };
    const original = mutateLearning(store, token, input);
    expect(mutateLearning(store, token, input)).toEqual(original);
    expect(() =>
      mutateLearning(store, token, { ...input, completed: false }),
    ).toThrow('identifier');
    expect(() =>
      mutateLearning(store, token, { ...input, mutationId: randomUUID() }),
    ).toThrow('another tab');
    expect(snapshot(store, token)?.revision).toBe(1);
    expect(
      store.native
        .prepare(
          "SELECT count(*) AS n FROM activity_event WHERE type='lesson_completed'",
        )
        .get(),
    ).toEqual({ n: 1 });
  });
  it('separates users and rejects forged identity or release IDs', async () => {
    startCourse(store, token);
    save({ kind: 'lesson', itemId: lesson, completed: true });
    await register(store, {
      email: 'second@example.test',
      password,
      confirmation: password,
    });
    const other = (
      await login(store, { email: 'second@example.test', password })
    ).token;
    expect(startCourse(store, other).percent).toBe(0);
    expect(snapshot(store, token)?.percent).toBe(50);
    expect(() =>
      mutateLearning(store, other, {
        kind: 'lesson',
        itemId: 'other-release:d001-learn',
        completed: true,
        expectedRevision: 0,
        mutationId: randomUUID(),
      }),
    ).toThrow('enrolled release');
    expect(() =>
      mutateLearning(store, other, {
        kind: 'lesson',
        itemId: lesson,
        completed: true,
        expectedRevision: 0,
        mutationId: randomUUID(),
        userId: 'first',
      }),
    ).toThrow();
    expect(() => mutateLearning(store, undefined, {})).toThrow('Sign in');
  });
  it('rolls back progress, revision and history if committing a receipt fails', () => {
    startCourse(store, token);
    store.native.exec(
      "CREATE TRIGGER simulate_disk_failure BEFORE INSERT ON mutation_receipt BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;",
    );
    expect(() =>
      save({ kind: 'lesson', itemId: lesson, completed: true }),
    ).toThrow('simulated write failure');
    expect(snapshot(store, token)).toMatchObject({ percent: 0, revision: 0 });
    expect(
      store.native.prepare('SELECT count(*) AS n FROM activity_event').get(),
    ).toEqual({ n: 0 });
  });
  it('keeps reference browsing separate from a study cursor and validates anchors', () => {
    startCourse(store, token);
    save({ kind: 'orientation', acknowledged: true, deferred: true });
    save({
      kind: 'cursor',
      itemId: exercise,
      mode: 'study',
      anchor: 'evidence',
    });
    save({ kind: 'cursor', itemId: lesson, mode: 'open', anchor: 'study' });
    expect(continuePath(snapshot(store, token))).toMatch(
      /d001-practice#evidence$/,
    );
    expect(() =>
      save({
        kind: 'cursor',
        itemId: exercise,
        mode: 'study',
        anchor: 'javascript:bad',
      }),
    ).toThrow();
  });
});
