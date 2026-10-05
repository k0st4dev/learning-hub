import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { environment, root } from './environment.mjs';

// Existing synthetic fixtures only; never reset student data or run against normal data/.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const verifyRestart = process.argv[2] === '--verify-restart';
assert.ok(process.argv.length <= 3 && (!process.argv[2] || verifyRestart));
const reportPath = path.join(root, 'docs/m5-step3-http-audit.json');
const credentials = {
  email: 'm5-anchors-http@example.test',
  password: 'Synthetic section resume verification October 2026',
};
function client() {
  const cookies = new Map();
  async function request(route, options = {}) {
    const response = await fetch(config.origin + route, {
      ...options,
      redirect: 'manual',
      headers: {
        cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...options.headers,
      },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const at = pair.indexOf('=');
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return response;
  }
  async function write(route, body, expected = 200, method = 'POST') {
    const csrf = await (await request('/api/auth/csrf')).json();
    const response = await request(route, {
      method,
      headers: {
        origin: config.origin,
        'content-type': 'application/json',
        'x-csrf-token': csrf.data.token,
      },
      body: JSON.stringify(body),
    });
    assert.equal(
      response.status,
      expected,
      `${route}: HTTP ${response.status}`,
    );
    return response.status === 204 ? null : response.json();
  }
  return { request, write };
}
const first = client();
// Try the reusable account first, creating it only on the first audit run.
const csrf = await (await first.request('/api/auth/csrf')).json();
const login = await first.request('/api/auth/login', {
  method: 'POST',
  headers: {
    origin: config.origin,
    'content-type': 'application/json',
    'x-csrf-token': csrf.data.token,
  },
  body: JSON.stringify(credentials),
});
if (login.status === 401) {
  assert.ok(!verifyRestart, 'Restart fixture must already exist');
  await first.write(
    '/api/auth/register',
    { ...credentials, confirmation: credentials.password },
    201,
  );
  await first.write('/api/auth/login', credentials);
} else assert.equal(login.status, 200);
let state = (await first.write('/api/enrollment', {})).data;
const id = (key) => `se-26w-v1:${key}`;
async function destination(expected) {
  const response = await first.request('/continue');
  assert.ok([200, 307].includes(response.status));
  const html = new JSDOM(await response.text());
  const target =
    response.headers.get('location') ??
    html.window.document
      .querySelector('meta[http-equiv="refresh"]')
      ?.getAttribute('content')
      ?.split('url=')[1];
  assert.equal(target, expected);
  html.window.close();
}
const second = client();
await second.write('/api/auth/login', {
  email: 'm4-ui-20261005@example.test',
  password: 'Synthetic UI verification only October 2026',
});
const otherBefore = (await second.write('/api/enrollment', {})).data;
const expectedTarget =
  '/course/software-engineer/days/d017/exercises/d017-practice#d017-task-02';
if (verifyRestart) {
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(state.revision, report.finalRevision);
  assert.equal(state.completed, report.completed);
  assert.equal(state.enrollment.resumeAnchor, 'd017-task-02');
  assert.equal(state.tasks.length, report.savedTasks);
  assert.equal(
    state.exerciseProgress.find((p) => p.exerciseId === id('d017-practice'))
      .submission.evidence,
    'Synthetic saved evidence for section persistence',
  );
  await destination(expectedTarget);
  report.serverRestartAndFreshLogin = 'passed';
  report.restartVerifiedAt = new Date().toISOString();
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log({
    restart: 'passed',
    completed: state.completed,
    anchor: state.enrollment.resumeAnchor,
  });
  process.exit(0);
}
async function save(change) {
  const route = ['cursor', 'orientation'].includes(change.kind)
    ? `/api/enrollment/${change.kind}`
    : `/api/progress/exercises/${encodeURIComponent(change.itemId)}`;
  const input = {
    mutationId: randomUUID(),
    expectedRevision: state.revision,
    ...change,
  };
  state = (await first.write(route, input, 200, 'PUT')).data;
  assert.deepEqual(
    (await first.write(route, input, 200, 'PUT')).data,
    state,
    'Exact duplicate receipt',
  );
  return input;
}
await save({ kind: 'orientation', acknowledged: true, deferred: true });
await save({
  kind: 'exercise',
  itemId: id('d017-practice'),
  completed: false,
  anchor: 'd017-task-01',
  submission: {
    tasks: [{ taskId: 'd017-task-01', status: 'done', reason: '', choice: '' }],
    evidence: 'Synthetic saved evidence for section persistence',
    selectedScope: '',
    attested: false,
    result: null,
  },
});
assert.equal(state.enrollment.resumeAnchor, 'd017-task-01');
const completed = state.completed;
await save({
  kind: 'cursor',
  mode: 'open',
  itemId: id('d028-learn'),
  anchor: 'study',
});
const before = state;
const receipt = await save({
  kind: 'cursor',
  mode: 'anchor',
  itemId: id('d017-practice'),
  anchor: 'd017-task-02',
});
assert.equal(state.completed, completed);
assert.equal(state.total, 364);
assert.deepEqual(state.tasks, before.tasks);
assert.deepEqual(state.lessonProgress, before.lessonProgress);
assert.deepEqual(state.exerciseProgress, before.exerciseProgress);
assert.equal(
  state.enrollment.lastOpenedItemId,
  before.enrollment.lastOpenedItemId,
);
assert.equal(state.enrollment.lastOpenedAt, before.enrollment.lastOpenedAt);
await destination(expectedTarget);
for (const [patch, expected] of [
  [{ mutationId: randomUUID(), expectedRevision: before.revision }, 409],
  [{ anchor: 'ai' }, 409],
  [
    {
      mutationId: randomUUID(),
      expectedRevision: state.revision,
      anchor: 'd018-task-01',
    },
    400,
  ],
  [
    {
      mutationId: randomUUID(),
      expectedRevision: state.revision,
      itemId: id('d028-learn'),
      anchor: 'study',
    },
    409,
  ],
  [
    {
      mutationId: randomUUID(),
      expectedRevision: state.revision,
      expectedStudentId: 'changed-account',
    },
    403,
  ],
]) {
  await first.write(
    '/api/enrollment/cursor',
    { ...receipt, ...patch },
    expected,
    'PUT',
  );
  assert.deepEqual((await first.write('/api/enrollment', {})).data, state);
}
for (const route of [
  '/course/software-engineer/days/d017/exercises/d017-practice',
  '/course/software-engineer/days/d028/lessons/d028-learn',
]) {
  const response = await first.request(route);
  assert.equal(response.status, 200);
  const document = new JSDOM(await response.text()).window.document;
  const keys = route.includes('/exercises/')
    ? ['tasks', 'ai', 'criterion', 'evidence', 'd017-task-01', 'd017-task-02']
    : ['study', 'ai', 'criterion'];
  for (const key of keys) {
    assert.equal(
      document.querySelectorAll(`[id="${key}"]`).length,
      1,
      `${route}#${key}`,
    );
    assert.equal(
      document.getElementById(key).getAttribute('data-study-anchor'),
      key,
    );
  }
}
assert.deepEqual(
  (await first.write('/api/enrollment', {})).data,
  state,
  'GET remains read-only',
);
assert.deepEqual(
  (await second.write('/api/enrollment', {})).data,
  otherBefore,
  'Other account remains unchanged',
);
assert.notEqual(
  otherBefore.enrollment.resumeItemId,
  state.enrollment.resumeItemId,
);
await first.write('/api/auth/logout', {}, 204);
await first.write('/api/auth/login', credentials);
assert.deepEqual((await first.write('/api/enrollment', {})).data, state);
const report = {
  date: new Date().toISOString(),
  server: 'development',
  debounce: 'Verified separately in unit and browser checks',
  ownedAllowlist: 'passed',
  activeVersusReference: 'passed',
  immediateTaskAnchor: 'passed',
  duplicateReceipts: 'passed',
  staleAndReusedReceipt: 'passed',
  accountGuard: 'passed',
  noCreditOrSubmissionChanges: 'passed',
  separateAccounts: 'passed',
  readOnlyGET: 'passed',
  sectionTargets: 9,
  logoutAndLogin: 'passed',
  serverRestartAndFreshLogin: 'pending',
  finalRevision: state.revision,
  completed: state.completed,
  savedTasks: state.tasks.length,
};
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(report);
