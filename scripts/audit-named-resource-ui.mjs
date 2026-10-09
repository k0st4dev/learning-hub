import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';
import { readCatalog, catalogPage } from '../src/server/content/read.ts';
import { servedDocument } from './served-document.mjs';

const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
assert.equal(process.argv.length, 2);
const fixture = JSON.parse(
  await readFile(
    path.join(root, '.tmp/m6-scorecard-review-http-state.json'),
    'utf8',
  ),
);
assert.equal(fixture.accounts.length, 2);
const artifact = JSON.parse(
  await readFile(
    path.join(
      root,
      'content/interpretations/se-26w-v1-resource-mentions-v1.json',
    ),
    'utf8',
  ),
);
let store = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
const catalog = readCatalog(store, artifact.releaseId);
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
        signal: AbortSignal.timeout(30000),
      });
      assert.equal(response.status, 200);
      remember(response);
      csrf = (await response.json()).data.token;
    }
    const response = await fetch(config.origin + url, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
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
let detailPages = 0,
  libraryPages = 0,
  originalAssignments = 0,
  originalOrigins = 0,
  namedDetailEdges = 0,
  namedContextEdges = 0,
  sourceMappings = 0,
  searchTargets = 0;
const streams = { segments: 0, boundaries: 0 };
const before = fingerprint();
const accountResults = [];
function checkMention(panel, mention) {
  assert.ok(panel, mention.key);
  assert.ok(panel.textContent.includes(mention.exactInstruction), mention.key);
  assert.equal(
    panel.querySelector('a').getAttribute('href'),
    mention.sourceMappingHref,
  );
  for (const ref of mention.evidenceRefs)
    assert.ok(
      panel.textContent.includes(
        catalog.blocks.find((row) => row.sourceLocator === ref).exactText,
      ),
      ref,
    );
}
try {
  for (const account of fixture.accounts) {
    const call = client();
    await call('/api/auth/login', 'POST', {
      email: account.email,
      password: account.password,
    });
    const owner = store.native
      .prepare('SELECT id FROM app_user WHERE email=?')
      .get(account.email).id;
    const all = [];
    for (const page of [1, 2, 3, 4]) {
      const data = (
        await call('/api/resources?page=' + page, 'GET', undefined, 200, {
          'x-expected-student': owner,
        })
      ).data;
      assert.equal(data.total, 79);
      assert.equal(data.pageSize, 25);
      assert.equal(data.results.length, page === 4 ? 4 : 25);
      assert.deepEqual(data.inventory, {
        originalResources: 69,
        derivedResources: 10,
        originalUses: 290,
        derivedMentions: 13,
      });
      all.push(...data.results);
      const doc = servedDocument(
        await call('/resources?page=' + page),
        streams,
      );
      assert.equal(
        doc.querySelectorAll('.resource-library-card').length,
        data.results.length,
      );
      assert.equal(doc.querySelectorAll('h1').length, 1);
      for (const row of data.results)
        assert.ok(doc.querySelector('h3 a[href="' + row.href + '"]'));
      for (const block of catalogPage(catalog, '/resources').blocks) {
        const original = doc.querySelector(
          '[data-source-id="' + block.sourceLocator + '"]',
        );
        assert.equal(
          original.querySelector('[data-source-text]').textContent,
          block.exactText,
        );
        for (const link of JSON.parse(block.linksJson))
          assert.ok(original.querySelector('a[href="' + link.url + '"]'));
        sourceMappings++;
      }
      libraryPages++;
    }
    assert.equal(new Set(all.map((row) => row.id)).size, 79);
    assert.equal(
      all.filter((row) => row.recordOrigin === 'imported-resource').length,
      69,
    );
    assert.equal(all.flatMap((row) => row.uses).length, 290);
    assert.equal(all.flatMap((row) => row.originalUses).length, 290);
    assert.equal(all.flatMap((row) => row.derivedMentions).length, 13);
    for (const original of catalog.resources) {
      const row = all.find((row) => row.id === original.id);
      assert.deepEqual(
        Object.fromEntries(Object.keys(original).map((key) => [key, row[key]])),
        original,
      );
    }
    const effectiveUses = all.flatMap((row) => row.uses);
    for (const original of catalog.uses) {
      const row = effectiveUses.find((row) => row.id === original.id);
      assert.deepEqual(
        Object.fromEntries(Object.keys(original).map((key) => [key, row[key]])),
        original,
      );
    }
    for (const row of all) {
      const doc = servedDocument(await call(row.href), streams);
      assert.equal(doc.querySelectorAll('h1').length, 1);
      assert.equal(doc.querySelector('h1').textContent, row.title);
      const labels = doc.querySelector(
        '[aria-labelledby=resource-detail-labels]',
      );
      assert.ok(labels);
      assert.equal(
        labels.querySelectorAll('[data-resource-use]').length,
        row.uses.length,
      );
      for (const use of row.uses) {
        assert.equal(
          labels.querySelector('[data-resource-use="' + use.id + '"] p.source')
            .textContent,
          use.assignedText,
        );
        originalAssignments++;
      }
      if (row.recordOrigin === 'imported-resource') {
        assert.equal(
          doc.querySelector('.page-shell > p.source').textContent,
          row.descriptionMarkdown,
        );
        assert.ok(
          labels.textContent.includes('Imported type label: ' + row.type),
        );
        const heading = [...doc.querySelectorAll('h2')].find(
          (node) => node.textContent === 'Original imported learning contexts',
        );
        assert.ok(heading);
        assert.equal(
          heading.nextElementSibling.children.length,
          row.originalUses.length,
        );
        for (const use of row.originalUses) {
          assert.ok(
            [...heading.nextElementSibling.children].some(
              (node) =>
                node.querySelector('p.source').textContent === use.assignedText,
            ),
          );
          originalOrigins++;
        }
      } else {
        assert.equal(row.originalUrl, null);
        assert.equal(row.resolvedUrl, null);
        assert.ok(
          labels.textContent.includes('Added resource entry and title'),
        );
        assert.ok(
          labels.textContent.includes('No direct link supplied in the manual'),
        );
        assert.ok(!labels.textContent.includes('Imported type label'));
      }
      for (const mention of artifact.mentions.filter(
        (mention) => mention.resourceId === row.id,
      )) {
        checkMention(
          labels.querySelector('[data-resource-mention="' + mention.key + '"]'),
          mention,
        );
        namedDetailEdges++;
      }
      for (const link of doc.querySelectorAll('a[target="_blank"]')) {
        assert.ok(
          catalog.resources.some(
            (resource) => resource.originalUrl === link.getAttribute('href'),
          ),
        );
        assert.equal(link.rel, 'noopener noreferrer');
      }
      detailPages++;
    }
    for (const id of new Set(
      artifact.mentions.map((row) => row.contentItemId),
    )) {
      const item = catalog.items.find((row) => row.id === id);
      const doc = servedDocument(await call(item.route), streams);
      for (const mention of artifact.mentions.filter(
        (row) => row.contentItemId === id,
      )) {
        const article = doc.querySelector(
          '[data-learning-resource-mention="' + mention.key + '"]',
        );
        assert.equal(
          article.querySelector('h3 a').getAttribute('href'),
          '/resources/' +
            artifact.resources.find((row) => row.id === mention.resourceId)
              .stableKey,
        );
        checkMention(article.querySelector('[data-resource-mention]'), mention);
        namedContextEdges++;
      }
      for (const mapping of catalog.mappings.filter(
        (row) => row.websiteLocation.split('#')[0] === item.route,
      )) {
        const block = catalog.blocks.find(
          (row) => row.id === mapping.sourceBlockId,
        );
        assert.ok(
          doc.querySelector('[data-source-id="' + block.sourceLocator + '"]'),
        );
        sourceMappings++;
      }
    }
    for (const definition of artifact.resources) {
      const mention = artifact.mentions.find(
        (row) => row.resourceId === definition.id,
      );
      const params = new URLSearchParams({
        q: definition.title,
        kind: 'resource',
        week: mention.scope.week,
      });
      if (mention.scope.day) params.set('day', mention.scope.day);
      const result = (await call('/api/search?' + params)).data.results.find(
        (row) => row.id === definition.id,
      );
      assert.ok(result, definition.id);
      assert.equal(result.href, '/resources/' + definition.stableKey);
      if (definition.action === 'derived-resource')
        assert.equal(result.resourceOrigin, 'added-product-interpretation');
      const doc = servedDocument(await call('/search?' + params), streams);
      // Search results hydrate from the protected API; the initial served page
      // guarantees the exact query/form, not result anchors before hydration.
      assert.equal(doc.querySelector('#course-query')?.value, definition.title);
      assert.ok(doc.querySelector('[aria-label="Search results"]'));
      searchTargets++;
    }
    for (const [query, keys] of [
      [
        'day=d025&requirement=conditional',
        ['named-jest-getting-started', 'res-01'],
      ],
      ['day=d025&requirement=required', []],
      ['day=d127&requirement=reference', ['named-sqlite-docs', 'res-12']],
      [
        'q=Express&type=documentation&week=w23',
        ['named-express-docs', 'res-10'],
      ],
      ['q=Express&type=documentation&day=d155', []],
      [
        'q=CS50+Practice&week=w13&type=practice',
        ['named-cs50-practice', 'res-04'],
      ],
      ['q=CS50+Practice&week=w13&type=practice&day=d085', []],
    ])
      assert.deepEqual(
        (await call('/api/resources?' + query)).data.results
          .map((row) => row.stableKey)
          .sort(),
        keys,
      );
    for (const key of [
      'named-invented',
      'named-git/extra',
      'named-pg-library-docs',
    ])
      await call('/resources/' + key, 'GET', undefined, 404);
    await call(
      '/api/resources?projection=reviewed-mentions',
      'GET',
      undefined,
      400,
    );
    await call('/api/resources', 'GET', undefined, 403, {
      'x-expected-student': 'foreign',
    });
    accountResults.push(
      createHash('sha256').update(JSON.stringify(all)).digest('hex'),
    );
    await call('/api/auth/logout', 'POST', {}, 204);
    await call('/api/resources', 'GET', undefined, 401);
  }
  assert.equal(accountResults[0], accountResults[1]);
  assert.equal(fingerprint(), before);
  store.native.close();
  store = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
  assert.equal(fingerprint(), before);
  const report = {
    date: new Date().toISOString(),
    server: 'development',
    accounts: 2,
    resourcesPerAccount: 79,
    originalResources: 69,
    originalUses: 290,
    derivedResources: 10,
    derivedMentions: 13,
    detailPages,
    libraryPages,
    originalAssignments,
    originalOrigins,
    namedDetailEdges,
    namedContextEdges,
    sourceMappings,
    searchTargets,
    streams,
    allDurableLearnerPrivateAndContentRecordsUnchanged: true,
    ownershipFiltersErrorsAndSameFileReopen: 'passed',
    scope:
      'Real HTTP and served source/derived views only. No browser interaction, external availability, production performance or final acceptance claim.',
  };
  await writeFile(
    path.join(root, 'docs/m6-step19b-http-audit.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
} finally {
  store.native.close();
}
