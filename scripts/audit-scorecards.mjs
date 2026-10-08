import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { alternativeRoutes } from '../src/domain/exercise-requirements.ts';

const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const mode = process.argv[2];
assert.ok(
  process.argv.length === 3 && ['save', 'verify', 'review'].includes(mode),
);
const fixturePath = path.join(root, '.tmp/m6-scorecards-http-state.json');
const route = '/api/scorecards/2026-10';
const fingerprint = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function client() {
  const cookies = new Map();
  const cookie = () =>
    [...cookies].map(([key, value]) => key + '=' + value).join('; ');
  const remember = (response) => {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';')[0];
      const at = pair.indexOf('=');
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
  };
  const call = async (url, method = 'GET', body, status = 200) => {
    let csrf;
    if (method !== 'GET') {
      const response = await fetch(config.origin + '/api/auth/csrf', {
        headers: { cookie: cookie() },
      });
      assert.equal(response.status, 200);
      remember(response);
      csrf = (await response.json()).data.token;
    }
    const response = await fetch(config.origin + url, {
      method,
      redirect: 'manual',
      headers: {
        cookie: cookie(),
        origin: config.origin,
        'content-type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    remember(response);
    assert.equal(response.status, status, method + ' ' + url);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return status === 204 ? null : response.json();
  };
  call.page = async (url) => {
    const response = await fetch(config.origin + url, {
      redirect: 'manual',
      headers: { cookie: cookie() },
    });
    assert.equal(response.status, 200, url);
    return response.text();
  };
  return call;
}
async function signIn(call, account) {
  await call('/api/auth/login', 'POST', {
    email: account.email,
    password: account.password,
  });
}
async function newAccount() {
  const call = client();
  const email = 'scorecards-http-' + randomUUID() + '@example.test';
  const password = randomUUID() + randomUUID();
  await call(
    '/api/auth/register',
    'POST',
    { email, password, confirmation: password },
    201,
  );
  const account = { email, password };
  await signIn(call, account);
  const learning = (await call('/api/enrollment', 'POST', {})).data;
  // The login endpoint deliberately exposes no student identifier; the synthetic
  // account identifier comes from its own local database, never from submitted ownership.
  const { openDatabase } = await import('../src/server/db/connection.ts');
  const db = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
  let studentId;
  try {
    studentId = db.native
      .prepare('SELECT id FROM app_user WHERE email_canonical=?')
      .get(email).id;
  } finally {
    db.native.close();
  }
  return {
    call,
    account: { ...account, studentId, learningHash: fingerprint(learning) },
  };
}
if (mode === 'review') {
  const { loadArchivedCurriculum } =
    await import('../src/server/content/import.ts');
  const { JSDOM } = await import('jsdom');
  const plan = await loadArchivedCurriculum(root);
  const one = await newAccount();
  const two = await newAccount();
  const current = (await one.call('/api/scorecards')).data;
  const currentRoute = '/api/scorecards/' + current.periodKey;
  const saved = (
    await one.call(currentRoute, 'PUT', {
      periodKey: current.periodKey,
      expectedStudentId: one.account.studentId,
      expectedRevision: 0,
      mutationId: randomUUID(),
      ratings: { Git: 0 },
      evidence: {
        Git: 'Existing review must remain unchanged when reminders open.',
      },
    })
  ).data;
  let learning = (await one.call('/api/enrollment', 'POST', {})).data;
  const save = async (kind, itemId, submission) => {
    learning = (
      await one.call(
        '/api/progress/' +
          (kind === 'lesson' ? 'lessons' : 'exercises') +
          '/' +
          encodeURIComponent(itemId),
        'PUT',
        {
          kind,
          itemId,
          completed: true,
          expectedRevision: learning.revision,
          mutationId: randomUUID(),
          ...(submission ? { submission } : {}),
        },
      )
    ).data;
  };
  const submission = (day) => ({
    tasks: day.tasks.map((task) => ({
      taskId: task.id,
      status: 'done',
      reason: '',
      choice:
        task.requirement_mode === 'alternative'
          ? alternativeRoutes[task.id][0]
          : '',
    })),
    evidence: 'Synthetic review reminder criterion evidence',
    selectedScope:
      'Original assignments; prepared bug for the final exam alternative',
    attested: true,
    result: 'passed',
  });
  const reminders = async (call, route) => {
    const dom = new JSDOM(await call.page(route));
    try {
      const region = dom.window.document.querySelector(
        '[aria-label="Scorecard review reminder"]',
      );
      if (!region) return [];
      assert.equal(
        region.querySelector('a').getAttribute('href'),
        '/progress/scorecard',
      );
      assert.match(region.textContent, /deliberate revision/);
      return [...region.querySelectorAll('li')].map((item) => item.textContent);
    } finally {
      dom.window.close();
    }
  };
  assert.deepEqual(await reminders(one.call, '/dashboard'), []);
  for (const day of plan.source.days.filter(
    (day) => day.number >= 22 && day.number <= 28,
  )) {
    await save('lesson', plan.releaseId + ':' + day.lesson_id);
    await save(
      'exercise',
      plan.releaseId + ':' + day.exercise_id,
      submission(day),
    );
  }
  assert.equal(learning.completed, 14);
  const final = plan.source.days.find(
    (day) => day.assessment_kind === 'final_exam',
  );
  await save(
    'exercise',
    plan.releaseId + ':' + final.exercise_id,
    submission(final),
  );
  assert.equal(learning.completed, 15);
  const before = fingerprint(learning);
  const routes = {
    '/dashboard': ['Week 4', 'Final exam'],
    '/course/software-engineer': ['Week 4', 'Final exam'],
    '/course/software-engineer/progress': ['Week 4', 'Final exam'],
    '/course/software-engineer/weeks/w04': ['Week 4'],
    '/course/software-engineer/days/d028': ['Week 4'],
    '/course/software-engineer/days/d028/exercises/d028-practice': ['Week 4'],
    '/course/software-engineer/days/d182/exercises/d182-practice': [
      'Final exam',
    ],
  };
  for (const [route, labels] of Object.entries(routes))
    assert.deepEqual(await reminders(one.call, route), labels, route);
  assert.deepEqual(
    await reminders(one.call, '/dashboard'),
    routes['/dashboard'],
  );
  await one.call.page('/progress/scorecard');
  assert.deepEqual((await one.call('/api/scorecards')).data, saved);
  assert.equal(
    fingerprint((await one.call('/api/enrollment', 'POST', {})).data),
    before,
  );
  assert.deepEqual(await reminders(two.call, '/dashboard'), []);
  assert.equal((await two.call('/api/scorecards')).data.revision, 0);
  assert.equal(
    fingerprint((await two.call('/api/enrollment', 'POST', {})).data),
    two.account.learningHash,
  );
  await writeFile(
    path.join(root, '.tmp/m6-scorecard-review-http-state.json'),
    JSON.stringify({ accounts: [one.account, two.account], saved }, null, 2) +
      '\n',
    { mode: 0o600 },
  );
  for (const { call } of [one, two])
    await call('/api/auth/logout', 'POST', {}, 204);
  const report = {
    date: new Date().toISOString(),
    server: 'development',
    accounts: 2,
    servedReviewPages: 7,
    completedUnits: 15,
    requiredUnits: 364,
    percent: learning.percent,
    newStudentAbsent: 'passed',
    weekAndFinalPrompts: 'passed',
    repeatedReadsAndExistingMonthPreserved: 'passed',
    learningAndSecondAccountUnchanged: 'passed',
    scope:
      'Synthetic preview accounts; week 4 and final exam completed through protected APIs, with earlier gaps; all six week triggers covered by unit tests',
  };
  await writeFile(
    path.join(root, 'docs/m6-step5-http-audit.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
} else if (mode === 'save') {
  const one = await newAccount();
  const two = await newAccount();
  const initial = (await one.call(route)).data;
  assert.equal(initial.dimensions.length, 14);
  assert.equal(initial.scale.length, 4);
  assert.deepEqual(initial.ratings, {});
  const input = {
    periodKey: '2026-10',
    mutationId: randomUUID(),
    expectedStudentId: one.account.studentId,
    expectedRevision: 0,
    ratings: Object.fromEntries(
      initial.dimensions.map((key, i) => [key, i % 4]),
    ),
    evidence: Object.fromEntries(
      initial.dimensions.map((key) => [
        key,
        'Čćžšđ Ћирилица 😀 — <script>plain text</script>',
      ]),
    ),
  };
  const confirmed = await one.call(route, 'PUT', input);
  assert.equal(confirmed.data.revision, 1);
  assert.deepEqual(await one.call(route), confirmed);
  assert.deepEqual(await one.call(route, 'PUT', input), confirmed);
  const conflict = await one.call(
    route,
    'PUT',
    { ...input, mutationId: randomUUID() },
    409,
  );
  assert.deepEqual(conflict.error.currentState, confirmed.data);
  assert.deepEqual((await two.call(route)).data.ratings, {});
  await two.call(route, 'PUT', input, 403);
  await two.call(
    route + '?expectedStudentId=' + one.account.studentId,
    'GET',
    undefined,
    403,
  );
  assert.equal((await one.call('/api/scorecards')).data.periodKey.length, 7);
  assert.equal((await one.call('/api/scorecards/2026-09')).data.revision, 0);
  await one.call(
    route,
    'PUT',
    {
      ...input,
      mutationId: randomUUID(),
      expectedRevision: 1,
      ratings: { Git: 4 },
    },
    400,
  );
  await one.call(route, 'PUT', { ...input, periodKey: '2026-09' }, 400);
  for (const { call, account } of [one, two]) {
    assert.equal(
      fingerprint((await call('/api/enrollment', 'POST', {})).data),
      account.learningHash,
    );
    await call('/api/auth/logout', 'POST', {}, 204);
    await call(route, 'GET', undefined, 401);
  }
  await writeFile(
    fixturePath,
    JSON.stringify(
      { accounts: [one.account, two.account], input, confirmed },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
  console.log(
    'Scorecard HTTP save/isolation/conflict checks pass. Restart the same preview server, then run verify.',
  );
} else {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.equal(fixture.accounts.length, 2);
  for (const [index, account] of fixture.accounts.entries()) {
    assert.match(account.email, /^scorecards-http-[a-f0-9-]+@example\.test$/);
    const call = client();
    await signIn(call, account);
    const current = await call(route);
    if (index === 0) {
      assert.deepEqual(current, fixture.confirmed);
      assert.deepEqual(
        await call(route, 'PUT', fixture.input),
        fixture.confirmed,
      );
    } else assert.equal(current.data.revision, 0);
    assert.equal(
      fingerprint((await call('/api/enrollment', 'POST', {})).data),
      account.learningHash,
    );
    await call('/api/auth/logout', 'POST', {}, 204);
  }
  const report = {
    date: new Date().toISOString(),
    server: 'development',
    accounts: 2,
    dimensions: 14,
    exactTextAndRatings: 'passed',
    restartFreshLoginAndExactReceipt: 'passed',
    accountIsolationAndStaleForm: 'passed',
    revisionConflict: 'passed',
    validationAndPeriodIsolation: 'passed',
    unchangedLearningState: 'passed',
    scope:
      'Synthetic preview accounts; operator server restart, not OS reboot or scorecard UI',
  };
  await writeFile(
    path.join(root, 'docs/m6-step3-http-audit.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
}
