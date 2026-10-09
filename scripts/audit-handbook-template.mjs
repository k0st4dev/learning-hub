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
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 && process.argv[2] === '--prompts'),
);
const checkPrompts = process.argv[2] === '--prompts';
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
    for (const url of [
      route,
      route.replace('appendix-a', 'appendix-b'),
      ...(checkPrompts ? [route.replace('appendix-a', 'ai-protocol')] : []),
    ]) {
      const response = await request(url);
      assert.equal(response.status, 200);
      const document = servedDocument(await response.text(), streams);
      const original = catalogPage(catalog, url);
      for (const block of original.blocks)
        assert.equal(
          document.querySelector(
            '[data-source-id="' + block.sourceLocator + '"] [data-source-text]',
          )?.textContent,
          block.exactText,
        );
      assert.equal(document.querySelectorAll('h1').length, 1);
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
    const unknown = await request(
      route.replace('appendix-a', 'unknown-template'),
    );
    assert.equal(unknown.status, 404);
    if (checkPrompts) {
      const response = await request('/course/software-engineer/days/d001');
      assert.equal(response.status, 200);
      const doc = servedDocument(await response.text(), streams);
      assert.equal(doc.querySelector('[data-copy-prompt]'), null);
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
    servedPages: pages,
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
      checkPrompts
        ? 'docs/m6-step21-http-audit.json'
        : 'docs/m6-step20-http-audit.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report);
} finally {
  store.native.close();
}
