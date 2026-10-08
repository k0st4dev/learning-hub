import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';
import { readCatalog } from '../src/server/content/read.ts';
import { resourceProviderKey } from '../src/domain/resource-library.ts';

const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
assert.equal(process.argv.length, 2);
// Only existing synthetic preview accounts. Never print credentials or write them into reports.
const fixture = JSON.parse(
  await readFile(
    path.join(root, '.tmp/m6-scorecard-review-http-state.json'),
    'utf8',
  ),
);
assert.equal(fixture.accounts.length, 2);
const store = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
const catalog = readCatalog(store, 'se-26w-v1');
assert.ok(catalog);
const tables = [
  'app_user',
  'enrollment',
  'user_progress',
  'exercise_progress',
  'task_progress',
  'preparation_progress',
  'note',
  'scorecard',
  'activity_event',
  'mutation_receipt',
  'course_release',
  'content_item',
  'source_block',
  'source_mapping',
  'resource',
  'resource_use',
  'exercise_task',
];
function fingerprint() {
  return createHash('sha256')
    .update(
      JSON.stringify(
        tables.map((table) =>
          store.native
            .prepare('SELECT * FROM ' + table + ' ORDER BY rowid')
            .all(),
        ),
      ),
    )
    .digest('hex');
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
    if (method === 'POST' && url.startsWith('/api/auth/')) {
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
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return method === 'HEAD' || status === 204 || status === 405
      ? null
      : response.json();
  };
}
const before = fingerprint();
let resourceReads = 0;
try {
  const expected = [];
  for (const account of fixture.accounts) {
    const call = client();
    await call('/api/auth/login', 'POST', {
      email: account.email,
      password: account.password,
    });
    const owner = store.native
      .prepare('SELECT id FROM app_user WHERE email=?')
      .get(account.email).id;
    const read = async (query = '') => {
      resourceReads++;
      return (
        await call('/api/resources?' + query, 'GET', undefined, 200, {
          'x-expected-student': owner,
        })
      ).data;
    };
    const all = [];
    for (const page of [1, 2, 3]) {
      const result = await read('page=' + page);
      assert.equal(result.releaseId, 'se-26w-v1');
      assert.equal(result.total, 69);
      assert.equal(result.pageSize, 25);
      assert.equal(result.results.length, page === 3 ? 19 : 25);
      assert.equal(
        result.metadataInterpretation.version,
        'se-26w-v1-resource-labels-v1',
      );
      all.push(...result.results);
    }
    assert.equal(new Set(all.map((row) => row.id)).size, 69);
    for (const original of catalog.resources) {
      const row = all.find((row) => row.id === original.id);
      assert.deepEqual(
        Object.fromEntries(Object.keys(original).map((key) => [key, row[key]])),
        original,
      );
    }
    const uses = all.flatMap((row) => row.uses);
    assert.equal(uses.length, 290);
    assert.equal(
      uses.filter((row) => row.id.includes(':hyperlink:')).length,
      19,
    );
    for (const original of catalog.uses) {
      const row = uses.find((row) => row.id === original.id);
      assert.deepEqual(
        Object.fromEntries(Object.keys(original).map((key) => [key, row[key]])),
        original,
      );
    }
    expected.push(
      createHash('sha256').update(JSON.stringify(all)).digest('hex'),
    );
    for (const [query, keys] of [
      ['day=d113&requirement=optional', ['res-02']],
      ['day=d113&requirement=required', ['res-03']],
      [
        'day=d113&requirement=optional&requirement=required',
        ['res-02', 'res-03'],
      ],
      ['day=d025&requirement=conditional', ['res-02']],
      ['day=d025&requirement=required', []],
      ['day=d127&requirement=reference', ['res-12']],
      ['day=d001&week=w26', []],
      ['source=provider-unspecified&day=d132', ['unresolved-p1679']],
      [
        new URLSearchParams({
          source: resourceProviderKey('MDN'),
          type: 'documentation',
        }).toString(),
        ['res-07'],
      ],
    ])
      assert.deepEqual(
        (await read(query)).results.map((row) => row.stableKey).sort(),
        keys,
      );
    const plain = await read('q=vezbe');
    const accented = await read('q=ve%C5%BEbe');
    assert.deepEqual(plain.results, accented.results);
    assert.equal(plain.total, accented.total);
    const empty = await read('q=nonexistentResourceAuditSentinel');
    assert.equal(empty.total, 0);
    assert.equal(empty.options.module.length, 6);
    assert.equal(empty.options.week.length, 26);
    assert.equal(empty.options.day.length, 182);
    for (const q of [
      'q=a&q=b',
      'page=0',
      'type=password',
      'releaseId=foreign',
      'userId=foreign',
      'q=' + 'x'.repeat(101),
    ]) {
      const result = await call('/api/resources?' + q, 'GET', undefined, 400);
      assert.equal(result.error.code, 'VALIDATION_FAILED');
      assert.equal(result.data, undefined);
    }
    const stale = await call('/api/resources', 'GET', undefined, 403, {
      'x-expected-student': 'foreign-student',
    });
    assert.equal(stale.error.code, 'ACCOUNT_CHANGED');
    assert.equal(stale.data, undefined);
    await call('/api/resources', 'HEAD');
    await call('/api/resources', 'POST', {}, 405);
    await call('/api/auth/logout', 'POST', {}, 204);
    const loggedOut = await call('/api/resources', 'GET', undefined, 401);
    assert.equal(loggedOut.error.code, 'AUTH_REQUIRED');
  }
  assert.equal(expected[0], expected[1]);
  assert.equal(
    fingerprint(),
    before,
    'All learner, private and published content records must remain unchanged',
  );
  const report = {
    date: new Date().toISOString(),
    server: 'development',
    accounts: 2,
    resourceReads,
    resourcesPerAccount: 69,
    usesPerAccount: 290,
    originalHyperlinkUsesPerAccount: 19,
    unchangedRawMetadata: 'passed',
    effectiveLabelsAndSameUseFilters: 'passed',
    unicodeAndPagination: 'passed',
    validationAndAccountGuard: 'passed',
    headAndRejectedPost: 'passed',
    loginLogout: 'passed',
    publicCurriculumEqualAcrossAccounts: 'passed',
    allLearnerPrivateAndContentRecordsUnchanged: 'passed',
    scope:
      'Real local HTTP API with existing synthetic preview accounts. No browser UI, link availability, production performance or final MVP acceptance claimed.',
  };
  await writeFile(
    path.join(root, 'docs/m6-step11-http-audit.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
} finally {
  store.native.close();
}
