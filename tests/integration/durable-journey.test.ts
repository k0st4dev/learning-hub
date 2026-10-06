import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  importCurriculum,
  loadArchivedCurriculum,
} from '../../src/server/content/import';
import { login, register } from '../../src/server/auth/service';
import { mutateLearning, startCourse } from '../../src/server/learning/mutate';
import { continuePath, snapshot } from '../../src/server/learning/read';
import { readActivity } from '../../src/server/learning/activity';

it('recovers an acknowledged full-release mutation after killing its writer, preserving both users and exact retry', async () => {
  const root = process.cwd();
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  const directory = await mkdtemp(
    path.join(root, '.tmp/durable-journey-test-'),
  );
  let store: Store | undefined;
  let child: ReturnType<typeof spawn> | undefined;
  let childExit: Promise<void> | undefined;
  try {
    await migrate(directory, root);
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    const plan = await loadArchivedCurriculum(root);
    importCurriculum(store, plan.source);
    const password = 'Synthetic acknowledged crash recovery journey';
    const owner = { email: 'crash-owner@example.test', password };
    const other = { email: 'crash-other@example.test', password };
    await register(store, { ...owner, confirmation: password });
    await register(store, { ...other, confirmation: password });
    const token = (await login(store, owner)).token;
    const otherToken = (await login(store, other)).token;
    startCourse(store, token);
    const otherBefore = startCourse(store, otherToken);
    const id = (key: string) => `se-26w-v1:${key}`;
    const save = (change: Record<string, unknown>) =>
      mutateLearning(store!, token, {
        mutationId: randomUUID(),
        expectedRevision: snapshot(store!, token)!.revision,
        ...change,
      });
    save({ kind: 'orientation', acknowledged: true, deferred: true });
    save({ kind: 'lesson', itemId: id('d001-learn'), completed: true });
    const dayOne = plan.source.days[0]!;
    save({
      kind: 'exercise',
      itemId: id(dayOne.exercise_id),
      completed: true,
      submission: {
        tasks: dayOne.tasks.map((task) => ({
          taskId: task.id,
          status: 'done',
          reason: '',
          choice: '',
        })),
        evidence: 'Synthetic Day 1 evidence',
        selectedScope: '',
        result: 'passed',
        attested: true,
      },
    });
    expect(continuePath(snapshot(store, token))).toContain('/d002-learn#study');
    const payload = {
      kind: 'exercise',
      itemId: id('d002-practice'),
      anchor: 'd002-task-02',
      completed: false,
      mutationId: randomUUID(),
      expectedRevision: snapshot(store, token)!.revision,
      submission: {
        tasks: [
          { taskId: 'd002-task-01', status: 'done', reason: '', choice: '' },
        ],
        evidence: 'Acknowledged Day 2 draft survives abrupt writer exit',
        selectedScope: '',
        result: null,
        attested: false,
      },
    };
    await writeFile(
      path.join(directory, 'request.json'),
      JSON.stringify({ token, payload }),
    );
    store.native.close();
    store = undefined;
    child = spawn(
      process.execPath,
      ['tests/fixtures/durable-journey.mjs', directory],
      { cwd: root, stdio: 'ignore', windowsHide: true },
    );
    childExit = new Promise<void>((resolve, reject) => {
      child!.once('error', reject);
      child!.once('exit', () => resolve());
    });
    let acknowledged: ReturnType<typeof snapshot> | undefined;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Test writer exited before acknowledgement');
      try {
        acknowledged = JSON.parse(
          await readFile(path.join(directory, 'acknowledged.json'), 'utf8'),
        ) as ReturnType<typeof snapshot>;
        break;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !('code' in error) ||
          error.code !== 'ENOENT'
        )
          throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(acknowledged).toBeTruthy();
    expect(child.kill('SIGKILL')).toBe(true);
    await childExit;
    child = undefined;
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(store.native.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(store.native.pragma('foreign_key_check')).toEqual([]);
    expect(snapshot(store, token)).toEqual(acknowledged);
    expect(snapshot(store, otherToken)).toEqual(otherBefore);
    const freshToken = (await login(store, owner)).token;
    const restored = snapshot(store, freshToken)!;
    expect(restored).toEqual(acknowledged);
    expect(restored).toMatchObject({ completed: 2, total: 364, percent: 0 });
    expect(
      restored.exerciseProgress.find(
        (p) => p.exerciseId === id('d002-practice'),
      ),
    ).toMatchObject({ submission: { evidence: payload.submission.evidence } });
    expect(continuePath(restored)).toContain('/d002-practice#d002-task-02');
    const activity = readActivity(store, freshToken, { limit: 20 });
    expect(mutateLearning(store, freshToken, payload)).toEqual(acknowledged);
    expect(readActivity(store, freshToken, { limit: 20 })).toEqual(activity);
    expect(snapshot(store, freshToken)).toEqual(restored);
  } finally {
    if (child) {
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGKILL');
      await childExit;
    }
    store?.native.close();
    if (
      path.dirname(directory) !== path.join(root, '.tmp') ||
      !path.basename(directory).startsWith('durable-journey-test-')
    )
      throw new Error('Unexpected temporary path');
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
