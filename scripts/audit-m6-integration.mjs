import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { writeAuditReport } from './audit-report.mjs';
import { servedDocument } from './served-document.mjs';
import { loadArchivedCurriculum } from '../src/server/content/import.ts';
import { readCatalog } from '../src/server/content/read.ts';
import { openDatabase } from '../src/server/db/connection.ts';

// Developer integration audit: existing synthetic accounts, GETs and auth only.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
assert.equal(process.argv.length, 2);
const plan = await loadArchivedCurriculum(root);
let store = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
const catalog = readCatalog(store, plan.releaseId);
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
const fingerprint = () =>
  createHash('sha256')
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
const before = fingerprint();
const streams = { segments: 0, boundaries: 0 };
const originalUrls = new Set();
let servedPages = 0,
  mappingsChecked = 0,
  originalLinksChecked = 0,
  privateReads = 0,
  foreignReadsRejected = 0,
  durableNotes = 0,
  durableScorecards = 0;

function client() {
  const cookies = new Map();
  return async (route, input = {}) => {
    const response = await fetch(config.origin + route, {
      ...input,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
      headers: {
        cookie: [...cookies]
          .map(([key, value]) => key + '=' + value)
          .join('; '),
        ...input.headers,
      },
    });
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';')[0],
        at = pair.indexOf('=');
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return response;
  };
}
async function fixture(name) {
  const data = JSON.parse(
    await readFile(path.join(root, '.tmp', name), 'utf8'),
  );
  assert.equal(data.accounts.length, 2);
  return data.accounts;
}
async function auth(call, account) {
  const csrfResponse = await call('/api/auth/csrf');
  assert.equal(csrfResponse.status, 200);
  const csrf = (await csrfResponse.json()).data.token;
  const response = await call('/api/auth/login', {
    method: 'POST',
    headers: {
      origin: config.origin,
      'content-type': 'application/json',
      'x-csrf-token': csrf,
    },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.equal(response.status, 200);
}
async function api(call, route, status = 200) {
  const response = await call(route);
  assert.equal(response.status, status, route);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  privateReads++;
  if (status === 403) foreignReadsRejected++;
  return response.json();
}
async function page(call, route) {
  const response = await call(route);
  assert.equal(response.status, 200, route);
  servedPages++;
  const doc = servedDocument(await response.text(), streams);
  assert.equal(doc.querySelectorAll('h1').length, 1, route);
  return doc;
}
async function continueTarget(call) {
  const response = await call('/continue');
  if (response.status === 307) return response.headers.get('location');
  assert.equal(response.status, 200);
  const doc = servedDocument(await response.text(), streams);
  const metas = [...doc.querySelectorAll('meta[http-equiv="refresh"]')];
  assert.equal(metas.length, 1);
  const content = metas[0].getAttribute('content');
  assert.ok(content.startsWith('1;url='));
  return content.slice(6);
}
try {
  const readerAccounts = await fixture('m6-scorecard-review-http-state.json');
  const call = client();
  const anonymous = await call('/api/search?q=Git');
  assert.equal(anonymous.status, 401);
  await auth(call, readerAccounts[0]);
  const targetBefore = await continueTarget(call);
  const blocksById = new Map(catalog.blocks.map((block) => [block.id, block]));
  const mappingsByRoute = new Map();
  for (const mapping of catalog.mappings) {
    const route = mapping.websiteLocation.split('#')[0];
    if (!mappingsByRoute.has(route)) mappingsByRoute.set(route, []);
    mappingsByRoute.get(route).push(mapping);
  }
  for (const [index, route] of plan.report.routes.entries()) {
    const doc = await page(call, route);
    for (const mapping of mappingsByRoute.get(route) ?? []) {
      const block = blocksById.get(mapping.sourceBlockId);
      assert.ok(block);
      const element = doc.querySelector(
        '[data-source-id="' + block.sourceLocator + '"]',
      );
      assert.equal(
        element?.querySelector('[data-source-text]')?.textContent,
        block.exactText,
        mapping.id,
      );
      const anchor = mapping.websiteLocation.split('#')[1];
      if (anchor)
        assert.ok(doc.getElementById(anchor), mapping.websiteLocation);
      if (block.tableNumber !== null) {
        assert.equal(
          element.closest('table')?.getAttribute('data-source-table'),
          String(block.tableNumber),
        );
        assert.equal(
          element.closest('tr')?.getAttribute('data-source-row'),
          String(block.rowNumber),
        );
        assert.equal(
          element.closest('td')?.getAttribute('data-source-cell'),
          String(block.cellNumber),
        );
      }
      const expected = JSON.parse(block.linksJson);
      for (const link of expected) originalUrls.add(link.url);
      const actual = [...element.querySelectorAll('[data-source-link]')];
      assert.deepEqual(
        actual.map((link) => ({
          url: link.getAttribute('href'),
          label: link.querySelector('[lang="sr-Latn"]')?.textContent,
        })),
        expected.map(({ url, label }) => ({ url, label })),
      );
      mappingsChecked++;
      originalLinksChecked += expected.length;
    }
    if ((index + 1) % 50 === 0)
      console.log(
        'Verified curriculum routes: ' +
          (index + 1) +
          '/' +
          plan.report.routes.length,
      );
  }
  assert.equal(mappingsChecked, 2329);
  assert.equal(originalLinksChecked, 19);
  assert.equal(originalUrls.size, 12);
  assert.equal(await continueTarget(call), targetBefore);
  const continueTargets = [targetBefore];
  await auth(call, readerAccounts[1]);
  const secondTarget = await continueTarget(call);
  for (const route of [
    '/dashboard',
    '/course/software-engineer/progress',
    '/progress/scorecard',
    '/resources',
    '/search?q=ve%C5%BEbe',
  ])
    await page(call, route);
  assert.equal(await continueTarget(call), secondTarget);
  continueTargets.push(secondTarget);

  for (const [kind, name] of [
    ['notes', 'm6-notes-http-state.json'],
    ['scorecards', 'm6-scorecards-http-state.json'],
  ]) {
    const accounts = await fixture(name);
    const students = accounts.map((account) =>
      store.native
        .prepare('SELECT id FROM app_user WHERE email=?')
        .get(account.email),
    );
    assert.ok(students.every(Boolean));
    const privateDigests = [];
    for (const [index, account] of accounts.entries()) {
      const privateCall = client();
      await auth(privateCall, account);
      const studentId = students[index].id,
        peerId = students[1 - index].id;
      const enrollment = store.native
        .prepare('SELECT id FROM enrollment WHERE user_id=? AND release_id=?')
        .get(studentId, plan.releaseId);
      assert.ok(enrollment);
      if (kind === 'notes') {
        for (const key of ['d001', 'd001-learn', 'd001-practice']) {
          const itemId = plan.releaseId + ':' + key;
          const route = '/api/notes/' + encodeURIComponent(itemId);
          const data = (
            await api(privateCall, route + '?expectedStudentId=' + studentId)
          ).data;
          const saved = store.native
            .prepare(
              'SELECT body_text,revision FROM note WHERE enrollment_id=? AND content_item_id=?',
            )
            .get(enrollment.id, itemId);
          assert.equal(data.body, saved?.body_text ?? '');
          assert.equal(data.revision, saved?.revision ?? 0);
          await api(privateCall, route + '?expectedStudentId=' + peerId, 403);
          if (saved) durableNotes++;
          if (key === 'd001')
            privateDigests.push(
              createHash('sha256').update(data.body).digest('hex'),
            );
        }
        await page(privateCall, '/course/software-engineer/days/d001');
      } else {
        const route = '/api/scorecards/2026-10';
        const data = (
          await api(privateCall, route + '?expectedStudentId=' + studentId)
        ).data;
        const saved = store.native
          .prepare(
            'SELECT ratings_json,evidence_json,revision FROM scorecard WHERE enrollment_id=? AND period_key=?',
          )
          .get(enrollment.id, '2026-10');
        assert.equal(data.dimensions.length, 14);
        assert.deepEqual(data.ratings, JSON.parse(saved?.ratings_json ?? '{}'));
        assert.deepEqual(
          data.evidence,
          JSON.parse(saved?.evidence_json ?? '{}'),
        );
        assert.equal(data.revision, saved?.revision ?? 0);
        await api(privateCall, route + '?expectedStudentId=' + peerId, 403);
        if (saved) durableScorecards++;
        privateDigests.push(
          createHash('sha256')
            .update(JSON.stringify(data.ratings))
            .digest('hex'),
        );
        await page(privateCall, '/progress/scorecard');
      }
    }
    assert.notEqual(
      privateDigests[0],
      privateDigests[1],
      kind + ' fixtures must retain distinct records',
    );
  }
  assert.ok(durableNotes > 0 && durableScorecards > 0);
  assert.equal(fingerprint(), before);
  store.native.close();
  store = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
  assert.equal(fingerprint(), before);
  const report = {
    date: new Date().toISOString(),
    server: 'development',
    curriculumRoutes: plan.report.routes.length,
    servedPages,
    mappedParagraphs: mappingsChecked,
    originalHyperlinks: originalLinksChecked,
    originalDistinctUrls: originalUrls.size,
    privateFixtureAccounts: 4,
    privateReads,
    foreignReadsRejected,
    durableNotes,
    durableScorecards,
    distinctPrivateRecords: 'passed',
    freshLoginAndSameFileReopen: 'passed',
    continueTargets,
    allDurableLearnerPrivateAndContentRecordsUnchanged: true,
    streams,
    scope:
      'Read-only full served curriculum and existing synthetic notes/scorecards after an operator server restart. API equality and ownership; no browser hydration, OS reboot, production runtime or final MVP claim.',
  };
  await writeAuditReport(
    path.join(root, 'docs/m6-integration/full-source-and-private-http.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
} finally {
  store.native.close();
}
