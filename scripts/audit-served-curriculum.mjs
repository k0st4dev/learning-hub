import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { environment, root } from './environment.mjs';
import { loadArchivedCurriculum } from '../src/server/content/import.ts';

// Developer audit: run only against a server started with this isolated test directory.
const config = environment();
assert.ok(
  process.argv.length <= 3 &&
    (!process.argv[2] ||
      [
        '--m3-step1',
        '--m3-step2',
        '--m3-step3',
        '--m3-step4',
        '--m3-step5',
        '--m3-final',
        '--m4-step3',
        '--m4-step4',
        '--m5-step1',
        '--m5-step2',
        '--m5-step3',
        '--m6-step2',
      ].includes(process.argv[2])),
);
const checkNavigation = !!process.argv[2];
const fullM3 = process.argv[2] === '--m3-final';
const assessmentUI = process.argv[2] === '--m4-step4';
const notesUI = process.argv[2] === '--m6-step2';
const anchorUI = process.argv[2] === '--m5-step3' || notesUI;
const progressUI = process.argv[2] === '--m5-step2' || anchorUI;
const studyUI = process.argv[2] === '--m5-step1' || progressUI;
const exerciseUI = process.argv[2] === '--m4-step3' || assessmentUI || studyUI;
const checkMobile = process.argv[2] === '--m3-step5' || fullM3 || exerciseUI;
const checkStates = process.argv[2] === '--m3-step4' || checkMobile;
const checkDaily = process.argv[2] === '--m3-step3' || checkStates;
const checkOutline = process.argv[2] === '--m3-step2' || checkDaily;
const focused = checkDaily && !fullM3;
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
let checkedNavigationPages = 0;
let checkedOutlinePages = 0;
let checkedDailyPages = 0;
let checkedAssessments = 0;
let checkedStudyViews = 0;
let checkedNoteViews = 0;
const unitRoutes = plan.source.days.flatMap((day) => [
  `/course/software-engineer/days/${day.id}/lessons/${day.lesson_id}`,
  `/course/software-engineer/days/${day.id}/exercises/${day.exercise_id}`,
]);
const dayRoutes = plan.source.days.map(
  (day) => `/course/software-engineer/days/${day.id}`,
);
const allRoutes = [
  ...plan.report.routes,
  ...plan.resources.map((r) => `/resources/${r.stableKey}`),
];
// Focused daily UI regression; full source coverage remains in integration tests.
const routes = focused
  ? allRoutes.filter(
      (route) =>
        /\/days\/(d001|d007|d028|d125|d182)(\/|$)/.test(route) ||
        route === '/course/software-engineer/weeks/w26' ||
        (progressUI &&
          [
            '/course/software-engineer',
            '/course/software-engineer/modules/f1',
            '/course/software-engineer/weeks/w01',
          ].includes(route)) ||
        (assessmentUI &&
          plan.source.days.some(
            (day) =>
              day.assessment_kind !== 'practice' &&
              route ===
                `/course/software-engineer/days/${day.id}/exercises/${day.exercise_id}`,
          )) ||
        route === `/resources/${plan.resources[0].stableKey}`,
    )
  : allRoutes;
for (const [index, route] of routes.entries()) {
  const response = await request(route);
  assert.equal(response.status, 200, route);
  const document = new JSDOM(await response.text()).window.document;
  // React can stream large synchronous trees into $RS segments. Place only
  // these literal segment references; never evaluate page scripts in the audit.
  for (const script of document.querySelectorAll('script')) {
    for (const [, sourceId, placeholderId] of script.textContent.matchAll(
      /\$RS\("(S:[\da-f]+)","(P:[\da-f]+)"\)/g,
    )) {
      const segment = document.getElementById(sourceId);
      const placeholder = document.getElementById(placeholderId);
      assert.ok(segment && placeholder, `Missing stream segment: ${route}`);
      placeholder.replaceWith(...segment.childNodes);
      segment.remove();
    }
  }
  // Next streams suspended page content in a sibling container before placing it in main.
  assert.equal(document.querySelectorAll('h1').length, 1, route);
  if (notesUI && /\/days\/d\d{3}(\/|$)/.test(route)) {
    assert.equal(document.querySelectorAll('#notes').length, 1, route);
    assert.equal(document.querySelectorAll('#note-body').length, 1, route);
    assert.equal(
      document.getElementById('note-body').getAttribute('maxlength'),
      '20000',
    );
    assert.equal(
      document.querySelector('label[for="note-body"]').textContent,
      'My note',
    );
    assert.equal(
      document.getElementById('note-status').getAttribute('role'),
      'status',
    );
    assert.equal(
      document.querySelectorAll('button dialog').length,
      0,
      'No invalid nested dialog',
    );
    checkedNoteViews++;
  }
  if (anchorUI && /\/(lessons|exercises)\//.test(route)) {
    const original = plan.source.days.find((day) =>
      route.includes(`/days/${day.id}/`),
    );
    const keys = route.includes('/lessons/')
      ? ['study', 'ai', 'criterion']
      : [
          'tasks',
          'ai',
          'criterion',
          'evidence',
          ...original.tasks.map((task) => task.id),
        ];
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
    assert.ok(
      document.querySelector('nav[aria-label="Lesson sections"]'),
      route,
    );
  }
  if (studyUI && /\/days\/d\d{3}(\/|$)/.test(route)) {
    const controls = document.querySelector(
      'section[aria-label="Learning context"]',
    );
    assert.ok(controls, route);
    assert.ok(controls.textContent.includes('Study this day'), route);
    assert.ok(controls.textContent.includes('Open reference'), route);
    if (!route.includes('/exercises/'))
      assert.ok(document.getElementById('study-progress-title'), route);
    checkedStudyViews++;
  }
  if (assessmentUI) {
    const assessment = plan.source.days.find(
      (day) =>
        day.assessment_kind !== 'practice' &&
        route ===
          `/course/software-engineer/days/${day.id}/exercises/${day.exercise_id}`,
    );
    if (assessment) {
      const guidance = document
        .getElementById('assessment-guidance-title')
        ?.closest('section');
      assert.ok(guidance, route);
      assert.ok(
        guidance.textContent.includes(assessment.completion_criterion),
        route,
      );
      assert.ok(guidance.textContent.includes(assessment.ai_policy), route);
      assert.ok(document.getElementById('work-score'), route);
      assert.ok(document.getElementById('work-remediation'), route);
      assert.equal(document.querySelector('[role="timer"]'), null);
      if (assessment.assessment_kind === 'final_exam') {
        assert.ok(guidance.textContent.includes(assessment.study_instruction));
        for (const task of assessment.tasks.slice(0, 3))
          assert.ok(guidance.textContent.includes(task.text));
      }
      checkedAssessments++;
    }
  }
  if (fullM3 && route === '/progress/scorecard') {
    assert.equal(
      document.querySelector('h1')?.textContent,
      'Monthly scorecard',
    );
    assert.equal(
      document.querySelector('nav[aria-label="Location"] [aria-current="page"]')
        ?.textContent,
      'Monthly scorecard',
    );
  }
  if (fullM3 && route === '/course/software-engineer') {
    assert.equal(
      document.querySelector(
        'nav[aria-label="Contents"] a[href="/progress/scorecard"]',
      )?.textContent,
      'Monthly scorecard',
    );
  }
  if (checkMobile) {
    const drawer = document.querySelector('dialog.mobile-drawer');
    assert.ok(drawer, route);
    assert.equal(drawer.hasAttribute('open'), false);
    assert.equal(
      document.getElementById(drawer.getAttribute('aria-labelledby'))
        ?.textContent,
      'Student navigation',
    );
    assert.equal(
      document
        .querySelector('.student-mobile-header button')
        ?.getAttribute('aria-controls'),
      drawer.id,
    );
    assert.deepEqual(
      [...drawer.querySelectorAll('nav a')].map((a) => a.getAttribute('href')),
      [...document.querySelectorAll('.student-desktop-nav a')].map((a) =>
        a.getAttribute('href'),
      ),
    );
    assert.ok(
      drawer.querySelector(
        'a[href="/course/software-engineer#course-outline"]',
      ),
    );
    assert.ok(document.querySelectorAll('#course-outline').length <= 1);
  }
  if (checkDaily) {
    const original = plan.source.days.find(
      (day) =>
        route === `/course/software-engineer/days/${day.id}` ||
        route.startsWith(`/course/software-engineer/days/${day.id}/`),
    );
    if (original) {
      assert.equal(
        document.querySelector('[data-week-objective]')?.textContent,
        plan.source.weeks.find((week) => week.id === original.week_id)
          .objective,
        route,
      );
      assert.ok(
        document
          .querySelector('.daily-context')
          ?.textContent.includes(`${original.estimated_minutes} minutes`),
        route,
      );
      if (route === `/course/software-engineer/days/${original.id}`) {
        assert.equal(
          document.querySelector('[data-daily-study]')?.textContent,
          original.study_instruction,
          route,
        );
        assert.deepEqual(
          [...document.querySelectorAll('[data-daily-task]')].map(
            (task) => task.textContent,
          ),
          original.tasks.map((task) => task.text),
          route,
        );
        for (const anchor of ['ai-policy', 'completion']) {
          assert.equal(
            document.querySelectorAll(`[id="${anchor}"]`).length,
            1,
            route,
          );
          assert.equal(
            document.getElementById(anchor).closest('details'),
            null,
            route,
          );
        }
      }
      checkedDailyPages++;
    }
  }
  if (checkOutline && plan.report.routes.includes(route)) {
    const outline = document.querySelector('nav[aria-label="Course outline"]');
    assert.ok(outline, route);
    assert.equal(
      outline.querySelectorAll('details[data-outline-item]').length,
      214,
      route,
    );
    const currentItem = plan.items.find(
      (item) => JSON.parse(item.metadataJson).route === route,
    );
    const current = outline.querySelectorAll('[aria-current="page"]');
    const inOutline = ['module', 'week', 'day', 'lesson', 'exercise'].includes(
      currentItem.kind,
    );
    assert.equal(
      current.length,
      inOutline || currentItem.stableKey === 'overview' ? 1 : 0,
      route,
    );
    const currentDay = plan.source.days.find((day) =>
      [day.id, day.lesson_id, day.exercise_id].includes(currentItem.stableKey),
    );
    const currentWeek = plan.source.weeks.find(
      (week) => week.id === currentItem.stableKey,
    );
    const expectedOpen = currentDay
      ? [currentDay.module_id, currentDay.week_id, currentDay.id]
      : currentWeek
        ? [currentWeek.module_id, currentWeek.id]
        : currentItem.kind === 'module'
          ? [currentItem.stableKey]
          : [];
    assert.deepEqual(
      [...outline.querySelectorAll('details[data-outline-item][open]')].map(
        (detail) => detail.getAttribute('data-outline-item'),
      ),
      expectedOpen.map((key) => `${plan.releaseId}:${key}`),
      route,
    );
    const hrefs = new Set(
      [...outline.querySelectorAll('a')].map((a) => a.getAttribute('href')),
    );
    for (const destination of [...dayRoutes, ...unitRoutes].filter(
      (destination) => destination !== route,
    ))
      assert.ok(hrefs.has(destination), `${route} → ${destination}`);
    checkedOutlinePages++;
  }
  if (checkNavigation) {
    const unitIndex = unitRoutes.indexOf(route);
    const dayIndex = dayRoutes.indexOf(route);
    if (unitIndex >= 0 || dayIndex >= 0) {
      const isUnit = unitIndex >= 0;
      const sequence = document.querySelector(
        isUnit
          ? 'nav[aria-label="Study sequence"]'
          : 'nav[aria-label="Previous day / Next day"]',
      );
      assert.ok(sequence, route);
      const ordered = isUnit ? unitRoutes : dayRoutes;
      const position = isUnit ? unitIndex : dayIndex;
      assert.equal(
        sequence.querySelector('a[rel="prev"]')?.getAttribute('href') ?? null,
        ordered[position - 1] ??
          (isUnit ? '/course/software-engineer/preparation' : null),
      );
      assert.equal(
        sequence.querySelector('a[rel="next"]')?.getAttribute('href') ?? null,
        ordered[position + 1] ??
          (isUnit ? '/course/software-engineer/progress' : null),
      );
      assert.equal(
        document
          .querySelector('nav[aria-label="Location"]')
          .querySelectorAll('[aria-current="page"]').length,
        1,
        route,
      );
      checkedNavigationPages++;
    }
  }
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
assert.equal(
  checkedMappings,
  focused
    ? plan.mappings.filter((mapping) =>
        routes.includes(mapping.websiteLocation.split('#')[0]),
      ).length
    : 2329,
);
if (!focused) assert.equal(checkedLinks, 19);
if (checkNavigation)
  assert.equal(checkedNavigationPages, assessmentUI ? 38 : focused ? 15 : 546);
if (checkOutline)
  assert.equal(
    checkedOutlinePages,
    assessmentUI ? 39 : progressUI ? 19 : focused ? 16 : 594,
  );
if (checkDaily)
  assert.equal(checkedDailyPages, assessmentUI ? 38 : focused ? 15 : 546);
if (assessmentUI) assert.equal(checkedAssessments, 26);
if (studyUI) assert.equal(checkedStudyViews, 15);
for (const route of [
  '/course/software-engineer/days/missing',
  '/resources/missing',
]) {
  const response = await request(route);
  const text = await response.text();
  if (checkStates) {
    assert.equal(response.status, 404, route);
    const missing = new JSDOM(text);
    assert.equal(
      missing.window.document.querySelector('h1')?.textContent,
      'Page not found',
    );
    assert.ok(missing.window.document.querySelector('a[href="/dashboard"]'));
    assert.ok(
      missing.window.document.querySelector(
        'a[href="/course/software-engineer"]',
      ),
    );
    missing.window.close();
  }
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
  curriculumRoutes: routes.filter((route) => plan.report.routes.includes(route))
    .length,
  mappedParagraphs: checkedMappings,
  originalHyperlinks: checkedLinks,
  authenticatedAccess: 'passed',
  missingRoutes: 'passed',
  readingDoesNotMutateProgress: 'passed',
  ...(checkNavigation ? { checkedNavigationPages } : {}),
  ...(assessmentUI ? { checkedAssessments } : {}),
  ...(studyUI ? { checkedStudyViews } : {}),
  ...(notesUI ? { checkedNoteViews } : {}),
  ...(checkOutline ? { checkedOutlinePages } : {}),
  ...(checkMobile ? { checkedMobileShells: routes.length } : {}),
  ...(checkDaily
    ? {
        checkedDailyPages,
        scope: notesUI
          ? 'Focused M6 private note views/source/navigation/read-only regression; full source coverage in integration suite'
          : anchorUI
            ? 'Focused M5 section targets/source/navigation regression; all 364 unit targets and full source coverage in integration suite'
            : progressUI
              ? 'Focused M5 rollup presentation/source/navigation regression; full source coverage in integration suite'
              : studyUI
                ? 'Focused M5 study/reference UI source/navigation regression; full source coverage in integration suite'
                : exerciseUI
                  ? 'Focused M4 exercise UI source/navigation regression; full source coverage in integration suite'
                  : fullM3
                    ? 'Complete M3 integration gate: all published routes, mappings, links, daily views, outlines, navigation shells and strict missing-route status'
                    : checkMobile
                      ? 'Focused M3 step 5 navigation-shell and strict route-state regression; full source coverage in integration suite'
                      : checkStates
                        ? 'Focused M3 step 4 HTTP regression with strict missing-route status checks'
                        : 'Focused M3 step 3 HTTP regression; full source coverage in integration suite',
      }
    : {}),
};
await writeFile(
  path.join(
    root,
    notesUI
      ? 'docs/m6-step2-served-audit.json'
      : anchorUI
        ? 'docs/m5-step3-served-audit.json'
        : progressUI
          ? 'docs/m5-step2-served-audit.json'
          : studyUI
            ? 'docs/m5-step1-served-audit.json'
            : assessmentUI
              ? 'docs/m4-step4-served-audit.json'
              : exerciseUI
                ? 'docs/m4-step3-served-audit.json'
                : fullM3
                  ? 'docs/m3-final-served-audit.json'
                  : checkMobile
                    ? 'docs/m3-step5-served-audit.json'
                    : checkStates
                      ? 'docs/m3-step4-served-audit.json'
                      : checkDaily
                        ? 'docs/m3-step3-served-audit.json'
                        : checkOutline
                          ? 'docs/m3-step2-served-audit.json'
                          : checkNavigation
                            ? 'docs/m3-step1-served-audit.json'
                            : 'docs/m2-served-audit.json',
  ),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(report);
