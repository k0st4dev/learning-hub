import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { environment, root } from './environment.mjs';
import { loadArchivedCurriculum } from '../src/server/content/import.ts';

// Developer audit: run only against a server started with this isolated test directory.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const plan = await loadArchivedCurriculum(root);
const cookies = new Map();
async function request(route, options = {}) {
  const response = await fetch(config.origin + route, {
    ...options,
    redirect: 'manual',
    headers: {
      cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
      ...options.headers,
    },
  });
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';')[0];
    const position = pair.indexOf('=');
    cookies.set(pair.slice(0, position), pair.slice(position + 1));
  }
  return response;
}
async function post(route, input) {
  const csrf = await (await request('/api/auth/csrf')).json();
  const response = await request(route, {
    method: 'POST',
    headers: {
      origin: config.origin,
      'content-type': 'application/json',
      'x-csrf-token': csrf.data.token,
    },
    body: JSON.stringify(input),
  });
  assert.ok(response.ok, `${route}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const protectedResponse = await request('/course/software-engineer');
const protectedHtml = await protectedResponse.text();
const protectedDom = new JSDOM(protectedHtml);
const redirect =
  protectedResponse.headers.get('location') ??
  protectedDom.window.document
    .querySelector('meta[http-equiv="refresh"]')
    ?.getAttribute('content');
assert.ok(
  redirect?.includes('/login'),
  'Anonymous reader must be redirected to login',
);
assert.equal(
  protectedDom.window.document.querySelectorAll('[data-source-id]').length,
  0,
);
protectedDom.window.close();
const email = `audit-${randomUUID()}@example.test`;
const password = randomUUID() + randomUUID();
await post('/api/auth/register', { email, password, confirmation: password });
await post('/api/auth/login', { email, password });
const started = await post('/api/enrollment', {});
assert.equal(started.data.enrollment.releaseId, plan.releaseId);
let checkedMappings = 0;
let checkedLinks = 0;
const routes = [
  ...plan.report.routes,
  ...plan.resources.map((r) => `/resources/${r.stableKey}`),
];
for (const [index, route] of routes.entries()) {
  const response = await request(route);
  assert.equal(response.status, 200, route);
  const document = new JSDOM(await response.text()).window.document;
  // Next streams suspended page content in a sibling container before placing it in main.
  assert.equal(document.querySelectorAll('h1').length, 1, route);
  for (const mapping of plan.mappings.filter(
    (m) => m.websiteLocation.split('#')[0] === route,
  )) {
    const block = plan.blocks.find((b) => b.id === mapping.sourceBlockId);
    const element = [...document.querySelectorAll('[data-source-id]')].find(
      (e) => e.getAttribute('data-source-id') === block.sourceLocator,
    );
    assert.equal(
      element?.querySelector('[data-source-text]')?.textContent,
      block.exactText,
      mapping.websiteLocation,
    );
    const anchor = mapping.websiteLocation.split('#')[1];
    if (anchor)
      assert.ok(document.getElementById(anchor), mapping.websiteLocation);
    if (block.tableNumber != null) {
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
    const links = JSON.parse(block.linksJson);
    assert.deepEqual(
      [...element.querySelectorAll('[data-source-link]')].map((a) =>
        a.getAttribute('href'),
      ),
      links.map((l) => l.url),
    );
    checkedLinks += links.length;
    checkedMappings++;
  }
  document.defaultView.close();
  if ((index + 1) % 100 === 0)
    console.log(`Checked ${index + 1}/${routes.length} served pages`);
}
assert.equal(checkedMappings, 2329);
assert.equal(checkedLinks, 19);
for (const route of [
  '/course/software-engineer/days/missing',
  '/resources/missing',
]) {
  const response = await request(route);
  const text = await response.text();
  // Next may stream a not-found boundary with status 200; require its noindex marker.
  assert.ok(
    response.status === 404 || /name="robots" content="noindex"/.test(text),
    route,
  );
}
const repeated = await post('/api/enrollment', {});
assert.deepEqual(
  repeated.data,
  started.data,
  'Reading must not mutate learner progress or cursor',
);
await post('/api/auth/logout', {});
const report = {
  date: new Date().toISOString(),
  server: 'development',
  manifestSha256: plan.manifestSha256,
  servedPages: routes.length,
  curriculumRoutes: plan.report.routes.length,
  mappedParagraphs: checkedMappings,
  originalHyperlinks: checkedLinks,
  authenticatedAccess: 'passed',
  missingRoutes: 'passed',
  readingDoesNotMutateProgress: 'passed',
};
await writeFile(
  path.join(root, 'docs/m2-served-audit.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(report);
