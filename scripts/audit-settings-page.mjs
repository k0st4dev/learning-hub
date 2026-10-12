import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { servedDocument } from './served-document.mjs';
import { openDatabase } from '../src/server/db/connection.ts';

// Existing synthetic accounts only. This audit reads settings and pages.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const { accounts } = JSON.parse(
  await readFile(path.join(root, '.tmp/m7-settings-http-state.json'), 'utf8'),
);
const db = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
const tables = db.native
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('session','auth_throttle') ORDER BY name",
  )
  .all();
const fingerprint = () =>
  createHash('sha256')
    .update(
      JSON.stringify(
        tables.map(({ name }) =>
          db.native.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all(),
        ),
      ),
    )
    .digest('hex');
const before = fingerprint();
function client() {
  const cookies = new Map();
  return async (route, input = {}) => {
    const response = await fetch(config.origin + route, {
      ...input,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
      headers: {
        cookie: [...cookies].map(([k, v]) => k + '=' + v).join('; '),
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
try {
  const anonymous = await client()('/settings');
  const anonymousText = await anonymous.text();
  assert.ok([200, 307].includes(anonymous.status));
  assert.ok(
    (anonymous.headers.get('location') ?? anonymousText).includes(
      '/login?returnTo=',
    ),
  );
  let pages = 0;
  for (const account of accounts) {
    const call = client();
    const csrf = (await (await call('/api/auth/csrf')).json()).data.token;
    const login = await call('/api/auth/login', {
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
    assert.equal(login.status, 200);
    for (const route of ['/settings', '/dashboard', '/resources']) {
      const response = await call(route);
      assert.equal(response.status, 200);
      const doc = servedDocument(await response.text());
      assert.equal(
        doc.documentElement.getAttribute('data-theme'),
        account.saved.theme,
      );
      assert.equal(doc.querySelectorAll('h1').length, 1);
      assert.equal(doc.querySelectorAll('nav a[href="/settings"]').length, 2);
      if (route === '/settings') {
        assert.equal(doc.querySelector('#settings-email').value, account.email);
        assert.ok(doc.querySelector('#settings-email').readOnly);
        assert.equal(
          doc.querySelector('#settings-name').value,
          account.saved.displayName,
        );
        assert.equal(
          doc.querySelector('#settings-timezone').value,
          account.saved.timezone,
        );
        assert.equal(
          doc.querySelector('#settings-theme').value,
          account.saved.theme,
        );
        assert.equal(
          doc.querySelectorAll('nav a[href="/settings"][aria-current="page"]')
            .length,
          2,
        );
        assert.ok(doc.body.textContent.includes('Saved on this computer'));
        assert.ok(doc.body.textContent.includes('Sign out'));
      }
      pages++;
    }
  }
  assert.equal(fingerprint(), before);
  await writeFile(
    path.join(root, 'docs/m7-step2-http-audit.json'),
    JSON.stringify(
      {
        accounts: accounts.length,
        pages,
        ownedFields: true,
        readOnlyEmail: true,
        navigationBothMenus: true,
        serverRenderedLightAndDark: true,
        anonymousLoginRedirect: true,
        unchangedDurableTables: tables.length,
        nativeBrowser: 'pending: tool initialization failure',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Settings pages, two owned themes, navigation and unchanged durable data verified.',
  );
} finally {
  db.native.close();
}
