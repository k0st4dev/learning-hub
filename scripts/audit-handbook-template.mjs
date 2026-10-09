import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';
import { readCatalog, catalogPage } from '../src/server/content/read.ts';
import { servedDocument } from './served-document.mjs';
import { handbookNavigation } from '../src/server/content/handbook-navigation.ts';
import { dailyHandbookLinks } from '../src/server/content/daily-handbook.ts';
import { dayWorkspace } from '../src/server/content/day-workspace.ts';

const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 &&
      [
        '--prompts',
        '--navigation',
        '--git-review',
        '--concept-review',
        '--stuck-workflow',
        '--daily-help',
      ].includes(process.argv[2])),
);
const checkDailyHelp = process.argv[2] === '--daily-help';
const checkStuck = checkDailyHelp || process.argv[2] === '--stuck-workflow';
const checkConcept = checkStuck || process.argv[2] === '--concept-review';
const checkGit = checkConcept || process.argv[2] === '--git-review';
const checkNavigation = checkGit || process.argv[2] === '--navigation';
const checkPrompts = checkNavigation || process.argv[2] === '--prompts';
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
const route = '/course/software-engineer/guide/appendix-a';
const source = catalog.blocks.find((block) => block.sourceLocator === 'p2228');
assert.ok(source);
let pages = 0;
let promptsChecked = 0;
let guideSectionsChecked = 0;
let guideBlocksChecked = 0;
let gitChecksChecked = 0;
let conceptChecksChecked = 0;
let stuckChecksChecked = 0;
let dailyHelpViewsChecked = 0;
let dailyHelpLinksChecked = 0;
const continueTargets = [];
const redirects = { http307: 0, streamedRefresh: 0 };
const streams = { segments: 0, boundaries: 0 };
try {
  for (const account of fixture.accounts) {
    const cookies = new Map();
    const request = async (url, input) => {
      const response = await fetch(config.origin + url, {
        ...input,
        redirect: 'manual',
        signal: AbortSignal.timeout(60000),
        headers: {
          cookie: [...cookies]
            .map(([key, value]) => key + '=' + value)
            .join('; '),
          ...input?.headers,
        },
      });
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(';')[0],
          at = pair.indexOf('=');
        cookies.set(pair.slice(0, at), pair.slice(at + 1));
      }
      return response;
    };
    const csrfResponse = await request('/api/auth/csrf');
    assert.equal(csrfResponse.status, 200);
    const csrf = (await csrfResponse.json()).data.token;
    const auth = await request('/api/auth/login', {
      method: 'POST',
      headers: {
        origin: config.origin,
        'content-type': 'application/json',
        'x-csrf-token': csrf,
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
      }),
    });
    assert.equal(auth.status, 200);
    const readContinueTarget = async () => {
      const response = await request('/continue');
      let target;
      if (response.status === 307) {
        target = response.headers.get('location');
        redirects.http307++;
      } else {
        assert.equal(response.status, 200);
        const doc = servedDocument(await response.text(), streams);
        const metas = [...doc.querySelectorAll('meta[http-equiv="refresh"]')];
        assert.equal(metas.length, 1);
        const content = metas[0].getAttribute('content');
        assert.ok(content?.startsWith('1;url='));
        target = content.slice('1;url='.length);
        redirects.streamedRefresh++;
      }
      assert.ok(
        target === '/course/software-engineer' ||
          target?.startsWith('/course/software-engineer/'),
      );
      return target;
    };
    let expectedContinue = null;
    if (checkNavigation) {
      expectedContinue = await readContinueTarget();
    }
    for (const url of checkNavigation
      ? catalog.items
          .filter(
            (item) =>
              item.kind === 'guide' && item.stableKey.startsWith('guide-'),
          )
          .map((item) => item.route)
      : [
          route,
          route.replace('appendix-a', 'appendix-b'),
          ...(checkPrompts ? [route.replace('appendix-a', 'ai-protocol')] : []),
        ]) {
      const response = await request(url);
      assert.equal(response.status, 200);
      const document = servedDocument(await response.text(), streams);
      if (checkDailyHelp)
        assert.equal(
          document.querySelector('[data-daily-handbook-help]'),
          null,
        );
      const original = catalogPage(catalog, url);
      for (const block of original.blocks)
        assert.equal(
          document.querySelector(
            '[data-source-id="' + block.sourceLocator + '"] [data-source-text]',
          )?.textContent,
          block.exactText,
        );
      assert.equal(document.querySelectorAll('h1').length, 1);
      if (checkNavigation) {
        const nav = document.querySelector(
          'nav[aria-label="Handbook navigation"]',
        );
        assert.ok(nav);
        assert.equal(
          nav.querySelector('a[href="/continue"]')?.textContent,
          'Return to learning',
        );
        const headings = original.blocks.filter(
          (block) =>
            block.tableNumber === null &&
            /^Heading[1-6]$/.test(block.sourceStyle) &&
            block.exactText.trim(),
        );
        const sections = headings.length
          ? headings
          : original.blocks.slice(0, 1);
        const links = [...nav.querySelectorAll('a[href^="#"]')];
        assert.equal(links.length, sections.length);
        for (const [index, block] of sections.entries()) {
          const link = links[index];
          const target = document.getElementById(
            decodeURIComponent(link.getAttribute('href').slice(1)),
          );
          assert.ok(target);
          assert.equal(
            target.getAttribute('data-source-id'),
            block.sourceLocator,
          );
          assert.equal(target.getAttribute('tabindex'), '-1');
          assert.equal(
            link.textContent,
            headings.length ? block.exactText : 'Original content',
          );
          assert.equal(
            target.querySelector('[data-source-text]')?.textContent,
            block.exactText,
          );
          guideSectionsChecked++;
        }
        const ids = [...document.querySelectorAll('[id]')].map(
          (node) => node.id,
        );
        assert.equal(new Set(ids).size, ids.length);
        assert.equal(
          document.querySelector('[data-learning-unit], [data-study-anchor]'),
          null,
        );
        guideBlocksChecked += original.blocks.length;
      }
      if (checkGit) {
        const tool = document.querySelector('.temporary-review');
        if (url.endsWith('/appendix-b')) {
          assert.ok(tool);
          assert.equal(
            document.querySelectorAll('.temporary-review').length,
            1,
          );
          assert.equal(original.blocks.length, 6);
          assert.equal(tool.querySelectorAll('input').length, 4);
          assert.equal(
            tool.querySelector(
              'form, [data-learning-unit], [data-study-anchor]',
            ),
            null,
          );
          assert.ok(
            tool.textContent.includes(
              'Temporary review. Marks reset when you leave or reload. This does not save course progress.',
            ),
          );
          assert.ok(
            tool.textContent.includes(
              'The README check applies to larger projects; Git log review is weekly.',
            ),
          );
          assert.equal(
            tool.querySelector('[role="status"]')?.textContent,
            'Marks for this review: 0 / 4',
          );
          assert.equal(
            tool.querySelector('button')?.textContent,
            'Clear this review',
          );
          assert.equal(tool.querySelector('button')?.type, 'button');
          for (let number = 2231; number <= 2234; number++) {
            const ref = 'p' + number;
            const check = tool.querySelector(
              '[data-review-source="' + ref + '"]',
            );
            assert.ok(check);
            assert.equal(check.type, 'checkbox');
            assert.equal(check.checked, false);
            assert.equal(check.required, false);
            assert.equal(check.labels.length, 1);
            assert.equal(
              check.labels[0].querySelector('span')?.textContent,
              original.blocks.find((block) => block.sourceLocator === ref)
                ?.exactText,
            );
            gitChecksChecked++;
          }
          assert.equal(
            tool.querySelector('[data-review-source="p2230"]'),
            null,
          );
          const sourceLink = tool.querySelector('a');
          const target = document.getElementById(
            decodeURIComponent(sourceLink.getAttribute('href').slice(1)),
          );
          assert.equal(target?.getAttribute('data-source-id'), 'p2229');
        } else if (!url.endsWith('/appendix-c') && !url.endsWith('/appendix-e'))
          assert.equal(tool, null);
      }
      if (checkConcept && url.endsWith('/appendix-c')) {
        const tool = document.querySelector('.temporary-review');
        assert.ok(tool);
        assert.equal(document.querySelectorAll('.temporary-review').length, 1);
        assert.equal(
          tool.querySelector('h2')?.textContent,
          'Temporary concept review',
        );
        assert.equal(original.blocks.length, 8);
        assert.equal(tool.querySelectorAll('input[type="checkbox"]').length, 7);
        assert.equal(
          tool.querySelector('form, [data-learning-unit], [data-study-anchor]'),
          null,
        );
        assert.ok(
          tool.textContent.includes(
            'Temporary review. Marks reset when you leave or reload. This does not save course progress.',
          ),
        );
        assert.ok(
          tool.textContent.includes(
            'These self-checks do not certify mastery or grant AI permission. Daily AI restrictions take priority.',
          ),
        );
        assert.equal(
          tool.querySelector('[role="status"]')?.textContent,
          'Marks for this review: 0 / 7',
        );
        const field = tool.querySelector('input[type="text"]');
        assert.ok(field);
        assert.equal(field.value, '');
        assert.equal(field.required, false);
        assert.equal(field.maxLength, 120);
        assert.equal(field.autocomplete, 'off');
        assert.equal(
          field.labels[0]?.textContent,
          'Current concept (optional)',
        );
        for (const id of field.getAttribute('aria-describedby').split(' '))
          assert.ok(document.getElementById(id));
        assert.ok(tool.textContent.includes('Every edit clears the marks.'));
        assert.equal(
          tool.querySelector('button')?.textContent,
          'Clear this review',
        );
        assert.equal(tool.querySelector('button')?.type, 'button');
        for (let number = 2236; number <= 2242; number++) {
          const ref = 'p' + number;
          const box = tool.querySelector('[data-review-source="' + ref + '"]');
          assert.ok(box);
          assert.equal(box.type, 'checkbox');
          assert.equal(box.checked, false);
          assert.equal(box.required, false);
          assert.equal(box.labels.length, 1);
          assert.equal(
            box.labels[0].querySelector('span')?.textContent,
            original.blocks.find((block) => block.sourceLocator === ref)
              ?.exactText,
          );
          conceptChecksChecked++;
        }
        const sourceLink = tool.querySelector('a');
        const target = document.getElementById(
          decodeURIComponent(sourceLink.getAttribute('href').slice(1)),
        );
        assert.equal(target?.getAttribute('data-source-id'), 'p2235');
      }
      if (checkStuck && url.endsWith('/appendix-e')) {
        const tool = document.querySelector('.temporary-review');
        assert.ok(tool);
        assert.equal(document.querySelectorAll('.temporary-review').length, 1);
        assert.equal(
          tool.querySelector('h2')?.textContent,
          'Temporary troubleshooting review',
        );
        assert.equal(original.blocks.length, 8);
        assert.equal(tool.querySelectorAll('input').length, 7);
        assert.equal(
          tool.querySelector(
            'form, input[type="text"], [data-learning-unit], [data-study-anchor]',
          ),
          null,
        );
        assert.ok(
          tool.textContent.includes(
            'Temporary review. Marks reset when you leave or reload. This does not save course progress.',
          ),
        );
        assert.ok(tool.textContent.includes('Step 5 requires steps 1–4 first'));
        assert.ok(
          tool.textContent.includes(
            'at least 20 minutes for a small problem or 30 minutes for a serious algorithm/project bug',
          ),
        );
        assert.ok(
          tool.textContent.includes(
            "permission under the day's and external assignment's AI rules",
          ),
        );
        assert.ok(
          tool.textContent.includes(
            'Marks do not grant AI permission or course credit.',
          ),
        );
        assert.equal(
          tool.querySelector('[role="status"]')?.textContent,
          'Marks for this review: 0 / 7',
        );
        assert.equal(
          tool.querySelector('button')?.textContent,
          'Clear this review',
        );
        assert.equal(tool.querySelector('button')?.type, 'button');
        for (let number = 2335; number <= 2341; number++) {
          const ref = 'p' + number;
          const box = tool.querySelectorAll('input')[number - 2335];
          assert.equal(box.getAttribute('data-review-source'), ref);
          assert.equal(box.type, 'checkbox');
          assert.equal(box.checked || box.required || box.disabled, false);
          assert.equal(box.labels.length, 1);
          const text = original.blocks.find(
            (block) => block.sourceLocator === ref,
          )?.exactText;
          assert.equal(box.labels[0].querySelector('span')?.textContent, text);
          assert.ok(text.startsWith(String(number - 2334) + '. '));
          stuckChecksChecked++;
        }
        const protocol = catalogPage(
          catalog,
          '/course/software-engineer/guide/ai-protocol',
        );
        assert.ok(protocol);
        const hints = handbookNavigation(protocol).sections.find(
          (section) => section.sourceId === 'p0062',
        );
        assert.ok(hints);
        const nav = tool.querySelector(
          'nav[aria-label="Related troubleshooting guidance"]',
        );
        assert.deepEqual(
          [...nav.querySelectorAll('a')].map((link) => [
            link.textContent,
            link.getAttribute('href'),
          ]),
          [
            ['AI protocol and attempt rule', protocol.item.route],
            [
              'Original hint ladder',
              protocol.item.route + '#' + encodeURIComponent(hints.anchor),
            ],
          ],
        );
        const sourceLink = [...tool.querySelectorAll('a')].find(
          (link) => link.textContent === 'Read the original guidance',
        );
        const target = document.getElementById(
          decodeURIComponent(sourceLink.getAttribute('href').slice(1)),
        );
        assert.equal(target?.getAttribute('data-source-id'), 'p2334');
      }
      if (url === route) {
        const field = document.querySelector('#problem-file-template');
        assert.ok(field?.readOnly);
        assert.equal(field.value, source.exactText);
        assert.equal(field.wrap, 'off');
        assert.ok(document.querySelector('a[href="#source-p2228"]'));
        assert.equal(
          document.querySelector('#source-p2228 [data-source-text]')
            ?.textContent,
          source.exactText,
        );
        assert.equal(
          document.querySelector('.copyable-text [role="status"]')?.textContent,
          'Ready to copy.',
        );
        assert.deepEqual(
          [...document.querySelectorAll('.copyable-text button')].map(
            (button) => button.textContent,
          ),
          ['Copy template', 'Select template'],
        );
      } else if (url.endsWith('/ai-protocol')) {
        assert.equal(original.blocks.length, 24);
        assert.equal(document.querySelectorAll('[data-copy-prompt]').length, 8);
        const ids = [...document.querySelectorAll('[id]')].map((row) => row.id);
        assert.equal(new Set(ids).size, ids.length);
        for (let number = 70; number <= 77; number++) {
          const ref = 'p' + String(number).padStart(4, '0');
          const block = original.blocks.find(
            (row) => row.sourceLocator === ref,
          );
          const panel = document.querySelector(
            '[data-copy-prompt="' + ref + '"]',
          );
          assert.ok(panel && block);
          const field = panel.querySelector('textarea');
          assert.ok(field?.readOnly);
          assert.equal(field.value, block.exactText);
          assert.equal(field.wrap, 'soft');
          assert.equal(field.rows, 4);
          assert.equal(panel.open, false);
          assert.ok(panel.querySelector('a[href="#source-' + ref + '"]'));
          assert.equal(
            document.querySelector('#source-' + ref + ' > [data-source-text]')
              ?.textContent,
            block.exactText,
          );
          assert.equal(
            panel.querySelector('[role="status"]')?.textContent,
            'Ready to copy.',
          );
          assert.ok(
            panel.textContent.includes('Daily AI restrictions take priority.'),
          );
          promptsChecked++;
        }
      } else assert.equal(document.querySelector('.copyable-text'), null);
      pages++;
    }
    if (checkDailyHelp) {
      const expectedLinks = dailyHandbookLinks(catalog);
      assert.equal(expectedLinks.unavailable, false);
      assert.equal(expectedLinks.links.length, 5);
      for (const dayKey of ['d001', 'd007', 'd028', 'd125', 'd182']) {
        const day = catalog.items.find((item) => item.stableKey === dayKey);
        assert.ok(day);
        const workspace = dayWorkspace(catalog, day.id);
        assert.ok(workspace);
        const views = [day, workspace.lesson, workspace.exercise];
        assert.equal(views.length, 3);
        for (const item of views) {
          const response = await request(item.route);
          assert.equal(response.status, 200);
          const doc = servedDocument(await response.text(), streams);
          assert.equal(
            doc.querySelectorAll('[data-daily-handbook-help]').length,
            1,
          );
          const panel = doc.querySelector('details[data-daily-handbook-help]');
          assert.ok(panel);
          assert.equal(panel.open, false);
          assert.equal(
            panel.querySelector('summary')?.textContent,
            'Handbook help (optional)',
          );
          assert.ok(
            panel.textContent.includes(
              'Added navigation to original handbook guidance.',
            ),
          );
          assert.ok(
            panel.textContent.includes(
              'Daily AI restrictions and completion criteria still apply.',
            ),
          );
          assert.equal(
            panel.querySelector('form, input, button, [data-study-anchor]'),
            null,
          );
          const links = [
            ...panel.querySelectorAll(
              'nav[aria-label="Daily handbook shortcuts"] a',
            ),
          ];
          assert.equal(links.length, 5);
          for (const [index, link] of links.entries()) {
            const expected = expectedLinks.links[index];
            assert.equal(link.getAttribute('href'), expected.href);
            assert.equal(link.textContent, expected.title);
            assert.equal(link.lang, 'sr-Latn');
            assert.equal(link.getAttribute('target'), null);
            assert.ok(catalogPage(catalog, expected.href));
            dailyHelpLinksChecked++;
          }
          for (const anchor of item.kind === 'day'
            ? ['ai-policy', 'completion']
            : ['ai', 'criterion']) {
            const original = doc.getElementById(anchor);
            assert.ok(original);
            assert.equal(original.closest('details'), null);
          }
          const originalPage = catalogPage(catalog, item.route);
          for (const block of originalPage.blocks)
            assert.equal(
              doc.querySelector(
                '[data-source-id="' +
                  block.sourceLocator +
                  '"] [data-source-text]',
              )?.textContent,
              block.exactText,
            );
          dailyHelpViewsChecked++;
          pages++;
        }
      }
    }
    if (checkNavigation) {
      assert.equal(await readContinueTarget(), expectedContinue);
      continueTargets.push(expectedContinue);
    }
    const unknown = await request(
      route.replace('appendix-a', 'unknown-template'),
    );
    assert.equal(unknown.status, 404);
    if (checkPrompts) {
      const response = await request('/course/software-engineer/days/d001');
      assert.equal(response.status, 200);
      const doc = servedDocument(await response.text(), streams);
      if (checkGit) assert.equal(doc.querySelector('.temporary-review'), null);
      assert.equal(doc.querySelector('[data-copy-prompt]'), null);
      if (checkNavigation)
        assert.equal(
          doc.querySelector('nav[aria-label="Handbook navigation"]'),
          null,
        );
      const restriction = catalog.blocks.find(
        (block) => block.sourceLocator === 'p0280',
      );
      assert.ok(doc.body.textContent.includes(restriction.exactText));
      pages++;
    }
  }
  assert.equal(fingerprint(), before);
  const report = {
    date: new Date().toISOString(),
    server: 'development',
    accounts: 2,
    ...(checkDailyHelp
      ? {
          dailyHelpViews: dailyHelpViewsChecked,
          exactDailyHelpLinks: dailyHelpLinksChecked,
          defaultClosedNativeDisclosure: 'passed',
          dailyAiCriteriaAndSourceRemainExpanded: 'passed',
          handbookGuidesHaveNoDailyHelp: 'passed',
        }
      : {}),
    ...(checkStuck
      ? {
          stuckChecksPerAccount: 7,
          exactStuckChecks: stuckChecksChecked,
          stuckOriginalBlocksPerAccount: 8,
          numberedOrderAndAiConditions: 'passed',
          sourceBackedProtocolAndHintLinks: 'passed',
          noTimerGateOrNewCourseTask: true,
        }
      : {}),
    ...(checkConcept
      ? {
          conceptChecksPerAccount: 7,
          exactConceptChecks: conceptChecksChecked,
          conceptOriginalBlocksPerAccount: 8,
          optionalTemporaryConceptLabel: 'passed',
          noMasteryOrAiPermissionClaim: true,
        }
      : {}),
    ...(checkGit
      ? {
          gitChecksPerAccount: 4,
          exactGitChecks: gitChecksChecked,
          gitOriginalBlocksPerAccount: 6,
          temporaryUnsavedNoticeAndSourceLink: 'passed',
        }
      : {}),
    servedPages: pages,
    ...(checkNavigation
      ? {
          guidesPerAccount: 11,
          exactGuideSections: guideSectionsChecked,
          exactOriginalGuideBlocks: guideBlocksChecked,
          continueTargets,
          redirects,
          centralResumeRedirects: 'passed',
        }
      : {}),
    ...(checkPrompts
      ? {
          promptTemplatesPerAccount: 8,
          exactPromptControls: promptsChecked,
          originalProtocolBlocksPerAccount: 24,
          dailyRestrictionsPreserved: true,
        }
      : {}),
    sourceId: source.sourceLocator,
    exactCharacters: source.exactText.length,
    textSha256: createHash('sha256').update(source.exactText).digest('hex'),
    originalTextAndSelectableFallback: 'passed',
    sourceAnchorAndUnknownRoute: 'passed',
    allDurableLearnerPrivateAndContentRecordsUnchanged: true,
    streams,
    scope:
      'Focused served HTML, two-account and original source regression. Clipboard interaction is verified separately in unit tests and browser; no final acceptance claim.',
  };
  await writeFile(
    path.join(
      root,
      checkDailyHelp
        ? 'docs/m6-step27a-http-audit.json'
        : checkStuck
          ? 'docs/m6-step26-http-audit.json'
          : checkConcept
            ? 'docs/m6-step25-http-audit.json'
            : checkGit
              ? 'docs/m6-step24-http-audit.json'
              : checkNavigation
                ? 'docs/m6-step22-http-audit.json'
                : checkPrompts
                  ? 'docs/m6-step21-http-audit.json'
                  : 'docs/m6-step20-http-audit.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
} finally {
  store.native.close();
}
