import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import { seedDay1Fixture } from '../../src/server/content/day1-fixture';
import { register, login } from '../../src/server/auth/service';
import { mutateLearning, startCourse } from '../../src/server/learning/mutate';
import { snapshot } from '../../src/server/learning/read';
import { readActivity } from '../../src/server/learning/activity';
let store: Store;
let directory: string;
let token: string;
const root = process.cwd();
const password = 'Activity history local test password';
const lesson = 'development-day1-v1:d001-learn';
const exercise = 'development-day1-v1:d001-practice';
function save(change: Record<string, unknown>) {
  return mutateLearning(store, token, {
    mutationId: randomUUID(),
    expectedRevision: snapshot(store, token)!.revision,
    ...change,
  });
}
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/activity-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  await seedDay1Fixture(store.orm, root, directory);
  await register(store, {
    email: 'activity@example.test',
    password,
    confirmation: password,
  });
  token = (await login(store, { email: 'activity@example.test', password }))
    .token;
});
afterEach(async () => {
  vi.restoreAllMocks();
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('activity-test-')
  )
    throw new Error('Unexpected test directory');
  await rm(directory, { recursive: true, force: true });
});
describe('owned immutable activity reads', () => {
  it('requires a session and enrollment, validates limits/cursors and never turns a read failure into empty history', () => {
    expect(() => readActivity(store, undefined, { limit: 5 })).toThrow();
    expect(() => readActivity(store, token, { limit: 5 })).toThrow(
      'Start the course',
    );
    startCourse(store, token);
    const before = snapshot(store, token);
    expect(readActivity(store, token, { limit: 5 })).toEqual({
      events: [],
      next: null,
    });
    for (const query of [
      { limit: 0 },
      { limit: 21 },
      { limit: 5, before: 'bad' },
      { limit: 5, userId: 'foreign' },
      { limit: 5, before: randomUUID() },
    ])
      expect(() => readActivity(store, token, query)).toThrow('history page');
    expect(snapshot(store, token)).toEqual(before);
    store.native.close();
    expect(() => readActivity(store, token, { limit: 5 })).toThrow();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
  });
  it('retains completion/reopening/day/course transitions while excluding repeated confirmations, drafts and cursor visits', () => {
    startCourse(store, token);
    save({ kind: 'lesson', itemId: lesson, completed: true });
    const tasks = snapshot(store, token)!.items.filter(
      (item) => item.kind === 'task',
    );
    for (const task of tasks)
      save({ kind: 'task', itemId: task.id, done: true });
    const completion = {
      kind: 'exercise',
      itemId: exercise,
      completed: true,
      evidence: 'Local evidence',
      attested: true,
      result: 'passed',
    };
    save(completion);
    const types = readActivity(store, token, { limit: 20 }).events.map(
      (event) => event.type,
    );
    expect(types).toEqual([
      'course_completed',
      'day_completed',
      'exercise_completed',
      'lesson_completed',
    ]);
    const before = readActivity(store, token, { limit: 20 });
    save(completion);
    save({ kind: 'lesson', itemId: lesson, completed: true });
    save({ kind: 'cursor', mode: 'open', itemId: lesson, anchor: 'study' });
    expect(readActivity(store, token, { limit: 20 })).toEqual(before);
    save({ kind: 'lesson', itemId: lesson, completed: false });
    expect(
      readActivity(store, token, { limit: 20 }).events.map(
        (event) => event.type,
      ),
    ).toEqual(['course_reopened', 'day_reopened', 'lesson_reopened', ...types]);
    expect(snapshot(store, token)!.completed).toBe(1);
  });
  it('paginates all events without overlap at tied timestamps, remains stable after new writes, and survives DB restart', async () => {
    startCourse(store, token);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
    for (let i = 0; i < 14; i++) {
      save({ kind: 'lesson', itemId: lesson, completed: true });
      save({ kind: 'lesson', itemId: lesson, completed: false });
    }
    const recent = readActivity(store, token, { limit: 5 });
    expect(recent.events).toHaveLength(5);
    const first = readActivity(store, token, { limit: 20 });
    expect(first.events).toHaveLength(20);
    expect(first.next).toBe(first.events.at(-1)!.id);
    const older = readActivity(store, token, {
      limit: 20,
      before: first.next!,
    });
    expect(older.events).toHaveLength(8);
    expect(older.next).toBeNull();
    expect(
      new Set([...first.events, ...older.events].map((event) => event.id)).size,
    ).toBe(28);
    expect(first.events.slice(0, 5)).toEqual(recent.events);
    expect(first.events.map((event) => event.type)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        index % 2 ? 'lesson_completed' : 'lesson_reopened',
      ),
    );
    save({ kind: 'lesson', itemId: lesson, completed: true });
    expect(
      readActivity(store, token, { limit: 20, before: first.next! }),
    ).toEqual(older);
    const latest = readActivity(store, token, { limit: 20 });
    vi.restoreAllMocks();
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    token = (await login(store, { email: 'activity@example.test', password }))
      .token;
    expect(readActivity(store, token, { limit: 20 })).toEqual(latest);
  });
  it('replays exact receipts without extra events and keeps reads outside enrollment revision and receipt payloads', () => {
    startCourse(store, token);
    const input = {
      kind: 'lesson',
      itemId: lesson,
      completed: true,
      mutationId: randomUUID(),
      expectedRevision: 0,
    };
    const result = mutateLearning(store, token, input);
    const history = readActivity(store, token, { limit: 5 });
    expect(mutateLearning(store, token, input)).toEqual(result);
    expect(readActivity(store, token, { limit: 5 })).toEqual(history);
    expect(snapshot(store, token)).toEqual(result);
    expect(result).not.toHaveProperty('activity');
    expect(history.events[0]).toEqual({
      id: expect.any(String),
      type: 'lesson_completed',
      itemStableKey: 'd001-learn',
      occurredAt: expect.any(Number),
    });
  });
  it('isolates accounts and rejects another enrollment’s history cursor without disclosing it', async () => {
    startCourse(store, token);
    save({ kind: 'lesson', itemId: lesson, completed: true });
    const before = readActivity(store, token, { limit: 5 });
    await register(store, {
      email: 'other-activity@example.test',
      password,
      confirmation: password,
    });
    const other = (
      await login(store, { email: 'other-activity@example.test', password })
    ).token;
    startCourse(store, other);
    expect(readActivity(store, other, { limit: 5 })).toEqual({
      events: [],
      next: null,
    });
    expect(() =>
      readActivity(store, other, { limit: 5, before: before.events[0]!.id }),
    ).toThrow('history page');
    expect(readActivity(store, token, { limit: 5 })).toEqual(before);
    expect(snapshot(store, other)!.completed).toBe(0);
  });
});
