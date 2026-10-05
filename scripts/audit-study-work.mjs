import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { environment, root } from './environment.mjs';
import { loadArchivedCurriculum } from '../src/server/content/import.ts';

// Writes only synthetic student records in the isolated preview database.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const plan = await loadArchivedCurriculum(root);
function client() {
  const cookies = new Map();
  return async (route, body, expected = 200, method = 'POST') => {
    const cookie = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const remember = (response) => {
      for (const value of response.headers.getSetCookie()) {
        const [pair] = value.split(';');
        const at = pair.indexOf('=');
        cookies.set(pair.slice(0, at), pair.slice(at + 1));
      }
    };
    const csrfResponse = await fetch(config.origin + '/api/auth/csrf', {
      headers: { cookie: cookie() },
    });
    remember(csrfResponse);
    const csrf = await csrfResponse.json();
    const response = await fetch(config.origin + route, {
      method,
      redirect: 'manual',
      headers: {
        cookie: cookie(),
        origin: config.origin,
        'content-type': 'application/json',
        'x-csrf-token': csrf.data.token,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    remember(response);
    if (method !== 'GET')
      assert.equal(response.status, expected, `${method} ${route}`);
    if (method === 'GET') return response;
    return response.status === 204 ? null : response.json();
  };
}
const first = client();
const second = client();
const email = `study-http-${randomUUID()}@example.test`;
const password = randomUUID() + randomUUID();
await first(
  '/api/auth/register',
  { email, password, confirmation: password },
  201,
);
await first('/api/auth/login', { email, password });
let state = (await first('/api/enrollment', {})).data;
const id = (key) => `se-26w-v1:${key}`;
async function save(change) {
  const route =
    change.kind === 'cursor' || change.kind === 'orientation'
      ? `/api/enrollment/${change.kind}`
      : `/api/progress/${change.kind === 'lesson' ? 'lessons' : 'exercises'}/${encodeURIComponent(change.itemId)}`;
  const input = {
    mutationId: randomUUID(),
    expectedRevision: state.revision,
    ...change,
  };
  state = (await first(route, input, 200, 'PUT')).data;
  assert.deepEqual(
    (await first(route, input, 200, 'PUT')).data,
    state,
    'Exact retry receipt',
  );
}
async function destination(expected) {
  const response = await first('/continue', undefined, 307, 'GET');
  assert.ok([200, 307].includes(response.status));
  const meta = new JSDOM(await response.text()).window.document
    .querySelector('meta[http-equiv="refresh"]')
    ?.getAttribute('content');
  const target = response.headers.get('location') ?? meta?.split('url=')[1];
  assert.equal(target, expected);
}
await destination('/course/software-engineer/preparation');
await save({ kind: 'orientation', acknowledged: true, deferred: true });
await save({
  kind: 'cursor',
  mode: 'study',
  itemId: id('d001-learn'),
  anchor: 'study',
});
assert.equal(state.completed, 0);
assert.equal(state.lessonProgress[0].status, 'started');
await save({ kind: 'lesson', itemId: id('d001-learn'), completed: true });
assert.equal(state.completed, 1);
assert.equal(state.total, 364);
assert.equal(state.percent, 0);
await destination(
  '/course/software-engineer/days/d001/exercises/d001-practice#tasks',
);
const day = plan.source.days.find((day) => day.number === 1);
const exercise = {
  kind: 'exercise',
  itemId: id(day.exercise_id),
  completed: true,
  submission: {
    tasks: day.tasks.map((task) => ({
      taskId: task.id,
      status: 'done',
      reason: '',
      choice: '',
    })),
    evidence: 'Synthetic audit: original Day 1 tasks checked locally',
    selectedScope: '',
    attested: true,
    result: 'passed',
  },
};
await save(exercise);
assert.equal(state.completed, 2);
assert.equal(state.percent, 0);
await destination(
  '/course/software-engineer/days/d002/lessons/d002-learn#study',
);
await save({
  kind: 'cursor',
  mode: 'study',
  itemId: id('d002-learn'),
  anchor: 'study',
});
for (const mode of ['open', 'study'])
  await save({
    kind: 'cursor',
    mode,
    itemId: id('d001-learn'),
    anchor: 'study',
  });
await save({ kind: 'lesson', itemId: id('d001-learn'), completed: true });
await save(exercise);
assert.equal(state.enrollment.resumeItemId, id('d002-learn'));
await destination(
  '/course/software-engineer/days/d002/lessons/d002-learn#study',
);
await first('/api/auth/logout', {}, 204);
await first('/api/auth/login', { email, password });
assert.deepEqual((await first('/api/enrollment', {})).data, state);
const secondEmail = `study-other-login-${randomUUID()}@example.test`;
await second(
  '/api/auth/register',
  { email: secondEmail, password, confirmation: password },
  201,
);
await second('/api/auth/login', { email: secondEmail, password });
const other = (await second('/api/enrollment', {})).data;
assert.equal(other.completed, 0);
assert.equal(other.lessonProgress.length, 0);
assert.equal(other.exerciseProgress.length, 0);
assert.deepEqual((await first('/api/enrollment', {})).data, state);
await save({ kind: 'lesson', itemId: id('d001-learn'), completed: false });
assert.equal(state.completed, 1);
assert.equal(state.exerciseProgress[0].status, 'completed');
await destination(
  '/course/software-engineer/days/d001/lessons/d001-learn#study',
);
await first('/api/auth/logout', {}, 204);
await second('/api/auth/logout', {}, 204);
const report = {
  date: new Date().toISOString(),
  server: 'development',
  release: plan.releaseId,
  preparationPriority: 'passed',
  independentStudyExerciseCredit: 'passed',
  requiredUnits: 364,
  floorPercentage: 'passed',
  explicitStudyWithoutCredit: 'passed',
  referenceAndCompletedVisitsPreserveActiveStudy: 'passed',
  exactRetry: 'passed',
  loginReloadPersistence: 'passed',
  twoUserIsolation: 'passed',
  reopenPreservesExercise: 'passed',
  continueDestinations: 'passed',
};
await writeFile(
  path.join(root, 'docs/m5-step1-http-audit.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(report);
