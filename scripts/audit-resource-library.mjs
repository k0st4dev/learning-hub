import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';
import { readCatalog } from '../src/server/content/read.ts';
import { resourceProviderKey } from '../src/domain/resource-library.ts';
import { JSDOM } from 'jsdom';
import { catalogPage } from '../src/server/content/read.ts';

const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const detailUi = process.argv[2] === '--details';
const ui = process.argv[2] === '--ui' || detailUi;
assert.ok(process.argv.length === 2 || (ui && process.argv.length === 3));
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
    // Next development HTML uses its own revalidation header; API responses must remain no-store.
    if (url.startsWith('/api/'))
      assert.equal(response.headers.get('cache-control'), 'no-store');
    return method === 'HEAD' || status === 204 || status === 405
      ? null
      : url.startsWith('/api/')
        ? response.json()
        : response.text();
  };
}
const before = fingerprint();
let resourceReads = 0;
let servedLibraryPages = 0;
let sourceBlocksChecked = 0;
let sourceLinksChecked = 0;
let servedDetailPages = 0;
let detailAssignmentsChecked = 0;
let deferredDetailSegments = 0;
let deferredDetailBoundaries = 0;
function detailDocument(html) {
  const document = new JSDOM(html).window.document;
  // React streams large lists into S:/P: segments. Reproduce only its literal
  // $RS insertion operation; never execute scripts or load external assets.
  // Operation verified against the installed React server renderer.
  for (const script of document.querySelectorAll('script')) {
    for (const [, segmentId, placeholderId] of script.textContent.matchAll(
      /\$RS\("(S:[0-9a-f]+)","(P:[0-9a-f]+)"\)/g,
    )) {
      const segment = document.getElementById(segmentId);
      const placeholder = document.getElementById(placeholderId);
      assert.ok(
        segment?.hidden && placeholder?.parentNode,
        'Missing deferred detail segment',
      );
      segment.remove();
      while (segment.firstChild)
        placeholder.parentNode.insertBefore(segment.firstChild, placeholder);
      placeholder.remove();
      deferredDetailSegments++;
    }
  }
  // Complete literal $RC suspense boundaries after synchronous $RS insertions,
  // matching the installed renderer's queued $RV operation without evaluating JS.
  for (const script of document.querySelectorAll('script')) {
    for (const [, placeholderId, segmentId] of script.textContent.matchAll(
      /\$RC\("(B:[0-9a-f]+)","(S:[0-9a-f]+)"\)/g,
    )) {
      const segment = document.getElementById(segmentId);
      const placeholder = document.getElementById(placeholderId);
      assert.ok(segment?.hidden, 'Missing deferred boundary content');
      if (!placeholder) {
        segment.remove();
        continue;
      }
      const parent = placeholder.parentNode;
      const start = placeholder.previousSibling;
      assert.equal(start?.nodeType, 8);
      let current = placeholder;
      let depth = 0;
      while (current) {
        if (current.nodeType === 8) {
          if (['/$', '/&'].includes(current.data)) {
            if (!depth) break;
            depth--;
          } else if (['$', '$?', '$~', '$!', '&'].includes(current.data))
            depth++;
        }
        const next = current.nextSibling;
        current.remove();
        current = next;
      }
      assert.ok(current, 'Missing deferred boundary end');
      segment.remove();
      while (segment.firstChild)
        parent.insertBefore(segment.firstChild, current);
      start.data = '$';
      deferredDetailBoundaries++;
    }
  }
  return document;
}
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
    if (ui) {
      const pageSource = catalogPage(catalog, '/resources');
      const visibleResources = new Set();
      const visibleUses = new Set();
      for (const page of [1, 2, 3]) {
        const document = new JSDOM(await call('/resources?page=' + page)).window
          .document;
        assert.ok(document.querySelector('#resource-library-title'));
        const cards = [...document.querySelectorAll('.resource-library-card')];
        assert.equal(cards.length, page === 3 ? 19 : 25);
        for (const card of cards)
          visibleResources.add(card.querySelector('h3 a').getAttribute('href'));
        for (const entry of document.querySelectorAll('[data-resource-use]')) {
          const id = entry.getAttribute('data-resource-use');
          const original = catalog.uses.find((use) => use.id === id);
          assert.equal(
            entry.querySelector('p.source').textContent,
            original.assignedText,
          );
          visibleUses.add(id);
        }
        for (const block of pageSource.blocks) {
          const source = document.querySelector(
            '[data-source-id="' + block.sourceLocator + '"]',
          );
          assert.equal(
            source.querySelector('[data-source-text]').textContent,
            block.exactText,
          );
          sourceBlocksChecked++;
          for (const link of JSON.parse(block.linksJson)) {
            const anchor = [
              ...source.querySelectorAll('[data-source-link]'),
            ].find((a) => a.getAttribute('href') === link.url);
            assert.ok(anchor);
            assert.equal(anchor.target, '_blank');
            assert.equal(anchor.rel, 'noopener noreferrer');
            sourceLinksChecked++;
          }
        }
        for (const [key, count] of [
          ['source', 12],
          ['module', 6],
          ['week', 26],
          ['day', 182],
        ])
          assert.equal(
            document.querySelectorAll('select[name=' + key + '] option').length,
            count,
          );
        assert.equal(document.querySelectorAll('input[name=type]').length, 8);
        assert.equal(
          document.querySelectorAll('input[name=requirement]').length,
          4,
        );
        servedLibraryPages++;
      }
      assert.equal(visibleResources.size, 69);
      assert.equal(visibleUses.size, 290);
      const filtered = new JSDOM(
        await call('/resources?day=d113&requirement=optional'),
      ).window.document;
      assert.equal(
        filtered
          .querySelector('.resource-library-card h3 a')
          .getAttribute('href'),
        '/resources/res-02',
      );
      assert.ok(
        filtered.querySelector('input[name=requirement][value=optional]')
          .checked,
      );
      assert.equal(filtered.querySelector('select[name=day]').value, 'd113');
      const empty = new JSDOM(await call('/resources?day=d001&week=w26')).window
        .document;
      assert.equal(empty.querySelectorAll('.resource-library-card').length, 0);
      assert.match(
        empty.querySelector('.resource-library').textContent,
        /No matching resources/,
      );
      const invalid = new JSDOM(await call('/resources?q=a&q=b')).window
        .document;
      assert.ok(invalid.querySelector('#resource-error'));
      assert.ok(invalid.querySelector('[data-source-id="p0078"]'));
      servedLibraryPages += 3;
    }
    if (detailUi) {
      const typeLabels = {
        documentation: 'Documentation',
        article: 'Article / tutorial',
        video: 'Video',
        course: 'Course',
        tool: 'Tool',
        reference: 'Reference',
        practice: 'Practice website',
        guide: 'Internal guide',
      };
      const modeLabels = {
        required: 'Required section',
        optional: 'Optional supplement',
        reference: 'Reference',
        conditional: 'Conditional',
      };
      for (const resource of all) {
        const document = detailDocument(await call(resource.href));
        assert.equal(document.querySelectorAll('h1').length, 1);
        assert.equal(document.querySelector('h1').textContent, resource.title);
        assert.equal(
          document.querySelector('.page-shell > p.source').textContent,
          resource.descriptionMarkdown,
        );
        const labels = document.querySelector(
          '[aria-labelledby=resource-detail-labels]',
        );
        assert.ok(labels.querySelector('article.resource-library-card'));
        assert.equal(
          labels.querySelector('strong').textContent,
          typeLabels[resource.effective.type],
        );
        assert.ok(
          labels.textContent.includes(
            resource.effective.provider ?? 'Provider not specified in manual',
          ),
        );
        assert.ok(
          labels.textContent.includes('Imported type label: ' + resource.type),
        );
        if (resource.originalUrl) {
          const anchor = [...labels.querySelectorAll('a')].find(
            (a) => a.getAttribute('href') === resource.originalUrl,
          );
          assert.ok(anchor);
          assert.equal(anchor.target, '_blank');
          assert.equal(anchor.rel, 'noopener noreferrer');
        } else
          assert.ok(
            labels.textContent.includes(
              'No direct link supplied in the manual.',
            ),
          );
        assert.equal(
          labels.querySelectorAll('[data-resource-use]').length,
          resource.uses.length,
          resource.href +
            ' (global assignment count: ' +
            document.querySelectorAll('[data-resource-use]').length +
            ')',
        );
        for (const use of resource.uses) {
          const entry = labels.querySelector(
            '[data-resource-use="' + use.id + '"]',
          );
          assert.equal(
            entry.querySelector('p.source').textContent,
            use.assignedText,
          );
          assert.equal(entry.querySelector('a').getAttribute('href'), use.href);
          assert.equal(
            entry.querySelector('strong').textContent,
            modeLabels[use.effective.requirementMode],
          );
          for (const evidence of use.interpretation.evidence)
            assert.ok(entry.textContent.includes(evidence.exactText));
          detailAssignmentsChecked++;
        }
        for (const evidence of resource.interpretation.evidence)
          assert.ok(labels.textContent.includes(evidence.exactText));
        const originalContexts = [...document.querySelectorAll('h2')].find(
          (heading) => heading.textContent === 'Related learning contexts',
        ).nextElementSibling;
        assert.equal(originalContexts.children.length, resource.uses.length);
        for (const use of resource.uses) {
          const item = catalog.items.find(
            (row) => row.id === use.contentItemId,
          );
          assert.ok(
            [...originalContexts.children].some(
              (entry) =>
                entry.querySelector('a').getAttribute('href') === item.route &&
                entry.querySelector('p.source').textContent ===
                  use.assignedText,
            ),
          );
        }
        servedDetailPages++;
      }
      assert.equal(
        (
          await call('/resources/not-a-resource', 'GET', undefined, 404)
        ).includes('Resource labels and source evidence'),
        false,
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
    ...(ui
      ? {
          servedLibraryPages,
          sourceBlocksChecked,
          sourceLinksChecked,
          all69ResourcesAnd290AssignmentsInServedHtml: 'passed',
          originalManualMappingAndLinks: 'passed',
          initialFilteredEmptyInvalidStates: 'passed',
        }
      : {}),
    ...(detailUi
      ? {
          servedDetailPages,
          detailAssignmentsChecked,
          deferredDetailSegments,
          deferredDetailBoundaries,
          all69OriginalDetailsAndContextualLabels: 'passed',
          detailSourceEvidenceAndMissingPage: 'passed',
        }
      : {}),
    scope:
      'Real local HTTP API' +
      (ui ? ' and server-rendered library' : '') +
      (detailUi ? '/details' : '') +
      ' with existing synthetic preview accounts. No browser UI, link availability, production performance or final MVP acceptance claimed.',
  };
  await writeFile(
    path.join(
      root,
      detailUi
        ? 'docs/m6-step13-http-audit.json'
        : ui
          ? 'docs/m6-step12-http-audit.json'
          : 'docs/m6-step11-http-audit.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
} finally {
  store.native.close();
}
