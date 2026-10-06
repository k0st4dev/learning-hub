import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { environment, root } from './environment.mjs';

// Restrict all writes to a reusable synthetic fixture in the isolated preview.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const restart = process.argv[2] === '--verify-restart';
assert.ok(process.argv.length <= 3 && (!process.argv[2] || restart));
const reportPath = path.join(root, 'docs/m5-step4-http-audit.json');
const credentials = {
  email: 'm5-activity-http@example.test',
  password: 'Synthetic activity history verification October 2026',
};
function client() {
  const cookies = new Map();
  async function request(route, options = {}) {
    const response = await fetch(config.origin + route, {
      ...options,
      redirect: 'manual',
      headers: {
        cookie: [...cookies]
          .map(([key, value]) => `${key}=${value}`)
          .join('; '),
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
  async function history(route, unavailable = false) {
    const response = await request(route);
    assert.equal(response.status, 200);
    const dom = new JSDOM(await response.text());
    // Assemble literal React stream segments, without running page scripts.
    for (const script of dom.window.document.querySelectorAll('script')) {
      for (const [, sourceId, placeholderId] of script.textContent.matchAll(
        /\$RS\("(S:[\da-f]+)","(P:[\da-f]+)"\)/g,
      )) {
        const segment = dom.window.document.getElementById(sourceId);
        const placeholder = dom.window.document.getElementById(placeholderId);
        assert.ok(segment && placeholder, 'Missing streamed activity segment');
        placeholder.replaceWith(...segment.childNodes);
        segment.remove();
      }
    }
    const region = dom.window.document.querySelector('#activity-history');
    assert.ok(region);
    const events = [...region.querySelectorAll('[data-activity-id]')].map(
      (row) => ({
        id: row.dataset.activityId,
        type: row.dataset.activityType,
        title: row.querySelector('a')?.textContent,
        time: row.querySelector('time')?.dateTime,
      }),
    );
    for (const event of events) {
      assert.ok(event.title, JSON.stringify(event));
      assert.ok(!Number.isNaN(Date.parse(event.time)));
    }
    const older =
      [...region.querySelectorAll('a')]
        .find((link) => link.textContent === 'Older activity')
        ?.getAttribute('href') ?? null;
    if (unavailable) {
      assert.match(
        region.querySelector('[role="alert"]')?.textContent ?? '',
        /history page is unavailable/,
      );
      assert.equal(events.length, 0);
      assert.ok(
        [...region.querySelectorAll('a')].some(
          (link) => link.textContent === 'View newest activity',
        ),
      );
    }
    const text = region.textContent;
    dom.window.close();
    return { events, older, text };
  }
  return { request, write, history };
}
const owner = client();
const csrf = await (await owner.request('/api/auth/csrf')).json();
const login = await owner.request('/api/auth/login', {
  method: 'POST',
  headers: {
    origin: config.origin,
    'content-type': 'application/json',
    'x-csrf-token': csrf.data.token,
  },
  body: JSON.stringify(credentials),
});
if (login.status === 401) {
  assert.ok(!restart, 'Restart fixture must already exist');
  await owner.write(
    '/api/auth/register',
    { ...credentials, confirmation: credentials.password },
    201,
  );
  await owner.write('/api/auth/login', credentials);
} else assert.equal(login.status, 200);
let state = (await owner.write('/api/enrollment', {})).data;
const historyPath = '/course/software-engineer/progress';
if (restart) {
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(state.revision, report.finalRevision);
  assert.equal(state.completed, report.completed);
  assert.deepEqual(
    (await owner.history(historyPath)).events,
    report.newestEvents,
  );
  report.serverRestartAndFreshLogin = 'passed';
  report.restartVerifiedAt = new Date().toISOString();
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log({ restart: 'passed', events: report.newestEvents.length });
  process.exit(0);
}
const other = client();
await other.write('/api/auth/login', {
  email: 'm4-ui-20261005@example.test',
  password: 'Synthetic UI verification only October 2026',
});
const otherBefore = (await other.write('/api/enrollment', {})).data;
const otherHistory = await other.history(historyPath);
const initialHistory = await owner.history(historyPath);
async function save(change) {
  const route =
    change.kind === 'cursor'
      ? '/api/enrollment/cursor'
      : `/api/progress/lessons/${encodeURIComponent(change.itemId)}`;
  const input = {
    mutationId: randomUUID(),
    expectedRevision: state.revision,
    ...change,
  };
  state = (await owner.write(route, input, 200, 'PUT')).data;
  assert.deepEqual(
    (await owner.write(route, input, 200, 'PUT')).data,
    state,
    'Exact receipt retry',
  );
}
for (let index = 0; index < 12; index++) {
  await save({
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
  });
  await save({
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: false,
  });
}
await save({
  kind: 'cursor',
  mode: 'open',
  itemId: 'se-26w-v1:d028-learn',
  anchor: 'study',
});
const newest = await owner.history(historyPath);
assert.equal(newest.events.length, 20);
assert.ok(newest.older);
assert.deepEqual(
  newest.events.map((event) => event.type),
  Array.from({ length: 20 }, (_, index) =>
    index % 2 ? 'lesson_completed' : 'lesson_reopened',
  ),
);
const older = await owner.history(newest.older);
assert.ok(older.events.length >= 4);
const allEvents = [...newest.events, ...older.events];
let nextPage = older.older;
let historyPages = 2;
while (nextPage) {
  assert.ok(historyPages < 10, 'Unexpected audit fixture history size');
  const page = await owner.history(nextPage);
  allEvents.push(...page.events);
  nextPage = page.older;
  historyPages++;
}
assert.equal(
  new Set(allEvents.map((event) => event.id)).size,
  allEvents.length,
);
assert.ok(newest.text.includes(`(${state.timezone})`));
assert.equal(
  new Set([...newest.events, ...older.events].map((event) => event.id)).size,
  newest.events.length + older.events.length,
);
const dashboard = await owner.history('/dashboard');
assert.deepEqual(dashboard.events, newest.events.slice(0, 5));
assert.match(dashboard.text, /View full Progress history/);
assert.ok(newest.events.every((event) => event.title.startsWith('Day 1')));
await owner.history(historyPath + '?activity=invalid', true);
await owner.history(historyPath + '?activity=invalid&activity=again', true);
await owner.history(historyPath + '?activity=' + randomUUID(), true);
if (otherHistory.events[0])
  await owner.history(
    historyPath + '?activity=' + otherHistory.events[0].id,
    true,
  );
assert.deepEqual(
  (await other.history(historyPath)).events,
  otherHistory.events,
);
assert.deepEqual((await other.write('/api/enrollment', {})).data, otherBefore);
assert.deepEqual(
  (await owner.write('/api/enrollment', {})).data,
  state,
  'Reading must not change student progress/cursor',
);
await owner.write('/api/auth/logout', {}, 204);
await owner.write('/api/auth/login', credentials);
assert.deepEqual((await owner.history(historyPath)).events, newest.events);
const report = {
  verifiedAt: new Date().toISOString(),
  environment: '.tmp/m2-preview',
  addedTransitions: 24,
  initialVisibleEvents: initialHistory.events.length,
  dashboardEvents: 5,
  newestPageEvents: 20,
  olderPageEvents: older.events.length,
  historyPages,
  allHistoryEvents: allEvents.length,
  equalTimeOrderingAndPaging: 'covered by integration tests',
  duplicateReceiptNoExtraHistory: 'passed',
  cursorVisitNoExtraHistory: 'passed',
  invalidRepeatedUnknownForeignCursor: 'passed',
  originalTitleAndLocalizedTime: 'passed',
  readOnlyState: 'passed',
  separateStudentRecords: 'passed',
  logoutFreshLogin: 'passed',
  completed: state.completed,
  finalRevision: state.revision,
  newestEvents: newest.events,
  serverRestartAndFreshLogin: 'pending',
};
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log({
  dashboard: 5,
  newest: 20,
  older: older.events.length,
  isolation: 'passed',
  readOnly: 'passed',
});
