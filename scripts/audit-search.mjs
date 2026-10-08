import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';

const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const ui = process.argv[2] === '--ui';
assert.ok(process.argv.length === 2 || (ui && process.argv.length === 3));
// Reuse only existing synthetic preview credentials; never print or copy them to reports.
const fixture = JSON.parse(
  await readFile(
    path.join(root, '.tmp/m6-scorecard-review-http-state.json'),
    'utf8',
  ),
);
assert.equal(fixture.accounts.length, 2);
const store = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
const tables = [
  'enrollment',
  'user_progress',
  'exercise_progress',
  'task_progress',
  'preparation_progress',
  'note',
  'scorecard',
  'activity_event',
  'mutation_receipt',
];
function fingerprint() {
  const state = tables.map((table) =>
    store.native.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
  );
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}
function client() {
  const cookies = new Map();
  const cookie = () =>
    [...cookies].map(([key, value]) => key + '=' + value).join('; ');
  function remember(response) {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';')[0];
      const at = pair.indexOf('=');
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
  }
  return async (url, method = 'GET', body, status = 200, headers = {}) => {
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
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    remember(response);
    assert.equal(response.status, status, method + ' ' + url);
    if (url.startsWith('/api/'))
      assert.equal(response.headers.get('cache-control'), 'no-store');
    return status === 204
      ? null
      : url.startsWith('/api/')
        ? response.json()
        : response.text();
  };
}
const before = fingerprint();
const elapsed = [];
let servedTargets = 0;
try {
  for (const account of fixture.accounts) {
    const call = client();
    await call('/api/auth/login', 'POST', {
      email: account.email,
      password: account.password,
    });
    if (ui) {
      const id = store.native
        .prepare('SELECT id FROM app_user WHERE email = ?')
        .get(account.email).id;
      await call('/api/search?q=Git', 'GET', undefined, 200, {
        'x-expected-student': id,
      });
      await call('/api/search?q=Git', 'GET', undefined, 403, {
        'x-expected-student': 'foreign-student',
      });
      const page = new JSDOM(await call('/search?q=Git&page=2')).window
        .document;
      assert.equal(page.querySelector('h1').textContent, 'Search the course');
      assert.equal(page.querySelector('input[name=q]').value, 'Git');
      for (const [name, count] of [
        ['module', 6],
        ['week', 26],
        ['day', 182],
      ])
        assert.equal(
          page.querySelectorAll('select[name=' + name + '] option').length,
          count,
        );
      assert.equal(page.querySelectorAll('input[name=kind]').length, 9);
      assert.ok(page.querySelector('header a[href="/search"]'));
      const resources = new JSDOM(await call('/resources')).window.document;
      assert.ok(
        resources.querySelector('form[action="/search"] input[name=q]'),
      );
      assert.equal(
        resources.querySelector('form[action="/search"] input[name=kind]')
          .value,
        'resource',
      );
    }
    const first = (await call('/api/search?q=Git')).data;
    assert.equal(first.releaseId, 'se-26w-v1');
    assert.equal(first.pageSize, 20);
    assert.equal(first.results.length, 20);
    const second = (await call('/api/search?q=Git&page=2')).data;
    assert.equal(second.total, first.total);
    assert.equal(second.results.length, Math.min(20, first.total - 20));
    assert.equal(
      new Set([...first.results, ...second.results].map((row) => row.id)).size,
      first.results.length + second.results.length,
    );
    for (const query of [
      'JavaScript',
      'Git',
      'vezbe',
      'vežbe',
      'MDN',
      'HTTP',
      'C',
      'Git repo',
    ]) {
      const start = performance.now();
      const result = await call(
        '/api/search?' + new URLSearchParams({ q: query }),
      );
      elapsed.push(performance.now() - start);
      assert.equal(result.data.releaseId, 'se-26w-v1');
    }
    const original = (
      await call('/api/search?' + new URLSearchParams({ q: 'vežbe' }))
    ).data;
    const folded = (await call('/api/search?q=vezbe')).data;
    assert.equal(original.total, folded.total);
    assert.deepEqual(original.results, folded.results);
    assert.equal((await call('/api/search')).data.total, 0);
    assert.equal(
      (await call('/api/search?q=nonexistentSearchSentinel')).data.total,
      0,
    );
    const targetCases = [
      ['lesson', 'Pročitaj'],
      ['exercise', 'repo'],
      ['task', 'repo'],
      ['guide', 'Git'],
      ['resource', 'MDN'],
    ];
    for (const [kind, q] of targetCases) {
      const result = (
        await call('/api/search?' + new URLSearchParams({ q, kind }))
      ).data;
      assert.ok(result.total > 0);
      const target = result.results[0];
      assert.equal(target.kind, kind);
      assert.ok(target.breadcrumbs.length);
      assert.ok(target.href.startsWith('/'));
      await call(target.href.split('#')[0]);
      servedTargets++;
    }
    await call('/api/search?q=a&q=b', 'GET', undefined, 400);
    await call('/api/search?releaseId=foreign', 'GET', undefined, 400);
    await call('/api/search?page=0', 'GET', undefined, 400);
    assert.equal(
      (await call('/api/search?q=Git&day=d001&week=w26')).data.total,
      0,
    );
    await call('/api/auth/logout', 'POST', {}, 204);
    await call('/api/search?q=Git', 'GET', undefined, 401);
  }
  assert.equal(
    fingerprint(),
    before,
    'All persisted learning/private records must remain unchanged',
  );
  elapsed.sort((a, b) => a - b);
  const report = {
    date: new Date().toISOString(),
    server: 'development',
    accounts: 2,
    servedTargets,
    unicodeAndPagination: 'passed',
    emptyAndInvalidQueries: 'passed',
    originalTargetsAndBreadcrumbs: 'passed',
    filtersAndAuth: 'passed',
    allLearningAndPrivateRecordsUnchanged: 'passed',
    measurements: {
      samples: elapsed.length,
      warmHttpMedianMs: Number(
        elapsed[Math.floor(elapsed.length / 2)].toFixed(2),
      ),
      warmHttpMaxMs: Number(elapsed.at(-1).toFixed(2)),
      platform: os.platform(),
      architecture: os.arch(),
      cpu: os.cpus()[0]?.model ?? 'unavailable',
    },
    ...(ui
      ? {
          servedSearchAndResourceForms: 'passed',
          accountSwitchHeaderGuard: 'passed',
        }
      : {}),
    scope:
      'Existing synthetic preview accounts; backend and served content' +
      (ui ? '/search forms' : '') +
      ' only. Development timings are observations, not production A19/performance or browser UI acceptance.',
  };
  await writeFile(
    path.join(
      root,
      ui ? 'docs/m6-step7-http-audit.json' : 'docs/m6-step6-http-audit.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
} finally {
  store.native.close();
}
