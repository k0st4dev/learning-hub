import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';
import { servedDocument } from './served-document.mjs';

// Existing synthetic accounts only. Temporary expiry sessions are removed.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const mode = process.argv[2];
assert.ok(['prepare', 'verify'].includes(mode));
const fixturePath = path.join(root, '.tmp/m7-auth-integration-state.json');
const db = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const tables = db.native
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('session','auth_throttle') ORDER BY name",
  )
  .all();
const durable = () =>
  hash(
    tables.map(({ name }) =>
      db.native.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all(),
    ),
  );
const temporary = [];
let pages = 0,
  privateReads = 0,
  foreignReads = 0,
  expiredReads = 0;
function client(initial = {}) {
  const cookies = new Map(Object.entries(initial));
  const cookie = () => [...cookies].map(([k, v]) => k + '=' + v).join('; ');
  const remember = (response) => {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';')[0],
        at = pair.indexOf('=');
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
  };
  async function raw(route, input = {}) {
    const response = await fetch(config.origin + route, {
      ...input,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
      headers: { cookie: cookie(), ...input.headers },
    });
    remember(response);
    return response;
  }
  return {
    raw,
    token: () => cookies.get('learning_session'),
    async call(route, method = 'GET', body, status = 200) {
      let csrf;
      if (method !== 'GET') {
        const response = await raw('/api/auth/csrf');
        assert.equal(response.status, 200);
        csrf = (await response.json()).data.token;
      }
      const response = await raw(route, {
        method,
        headers: {
          origin: config.origin,
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      assert.equal(response.status, status, method + ' ' + route);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      if (status === 204) {
        assert.equal(await response.text(), '');
        return null;
      }
      const text = await response.text();
      assert.ok(!text.includes('$argon2'));
      const data = JSON.parse(text);
      if (route === '/api/auth/login' && status === 200) {
        const sessionCookie = response.headers
          .getSetCookie()
          .find((value) => value.startsWith('learning_session='));
        for (const flag of ['HttpOnly', 'Path=/', 'SameSite=lax', 'Expires='])
          assert.ok(sessionCookie.toLowerCase().includes(flag.toLowerCase()));
        assert.ok(!text.includes(cookies.get('learning_session')));
      }
      return data;
    },
  };
}
async function accounts() {
  const result = [];
  for (const [file, family] of [
    ['m7-settings-http-state.json', 'settings'],
    ['m7-password-http-state.json', 'password'],
    ['m7-recovery-http-state.json', 'recovery'],
  ]) {
    const fixture = JSON.parse(
      await readFile(path.join(root, '.tmp', file), 'utf8'),
    );
    for (const account of fixture.accounts) {
      assert.match(
        account.email,
        new RegExp('^' + family + '-http-[a-f0-9-]+@example\\.test$'),
      );
      result.push({
        ...account,
        password:
          account.recoveredPassword ?? account.newPassword ?? account.password,
        family,
      });
    }
  }
  assert.equal(result.length, 6);
  return result;
}
async function signIn(own, account) {
  const result = await own.call('/api/auth/login', 'POST', {
    email: account.email,
    password: account.password,
    returnTo: '/settings',
  });
  assert.equal(result.data.redirect, '/settings');
}
async function page(own, route) {
  const response = await own.raw(route);
  assert.equal(response.status, 200);
  pages++;
  return servedDocument(await response.text());
}
async function redirect(own, route) {
  const response = await own.raw(route);
  pages++;
  if (response.status === 307) return response.headers.get('location');
  assert.equal(response.status, 200);
  const content = servedDocument(await response.text())
    .querySelector('meta[http-equiv="refresh"]')
    ?.getAttribute('content');
  assert.ok(content?.startsWith('1;url='));
  return content.slice(6);
}
async function ownedRead(own, route, status = 200) {
  privateReads++;
  if (status === 403) foreignReads++;
  if (status === 401) expiredReads++;
  return own.call(route, 'GET', undefined, status);
}
try {
  if (mode === 'prepare') {
    const before = durable(),
      fixtures = [];
    for (const account of await accounts()) {
      const own = client();
      await signIn(own, account);
      const settings = (await ownedRead(own, '/api/settings')).data;
      assert.equal(settings.email, account.email);
      fixtures.push({
        ...account,
        id: settings.id,
        token: own.token(),
        settings,
      });
      for (const route of ['/login', '/register'])
        assert.equal(await redirect(own, route), '/dashboard');
      const doc = await page(own, '/settings');
      assert.equal(doc.querySelector('#settings-email').value, account.email);
      assert.equal(doc.querySelector('#change-newPassword').value, '');
      const cookieRow = db.native
        .prepare(
          'SELECT token_hash,expires_at,created_at FROM session WHERE token_hash=?',
        )
        .get(createHash('sha256').update(own.token()).digest('hex'));
      assert.ok(cookieRow);
      assert.equal(cookieRow.expires_at - cookieRow.created_at, 30 * 86400000);
      assert.ok(!JSON.stringify(cookieRow).includes(own.token()));
    }
    for (const [index, account] of fixtures.entries()) {
      const own = client({ learning_session: account.token }),
        peer = fixtures[(index + 1) % fixtures.length];
      await ownedRead(own, '/api/settings?expectedStudentId=' + peer.id, 403);
      if (account.note) {
        const route = '/api/notes/' + encodeURIComponent(account.note.itemId);
        assert.deepEqual((await ownedRead(own, route)).data, account.note);
        await ownedRead(own, route + '?expectedStudentId=' + peer.id, 403);
      }
    }
    const target = fixtures.find((account) => account.note),
      now = Date.now();
    for (const kind of ['idle', 'absolute', 'revoked']) {
      const token = randomBytes(32).toString('base64url'),
        id = randomUUID();
      temporary.push(id);
      db.native
        .prepare(
          'INSERT INTO session(id,user_id,token_hash,created_at,last_seen_at,expires_at,revoked_at) VALUES (?,?,?,?,?,?,?)',
        )
        .run(
          id,
          target.id,
          createHash('sha256').update(token).digest('hex'),
          kind === 'idle'
            ? now - 8 * 86400000
            : kind === 'absolute'
              ? now - 31 * 86400000
              : now,
          kind === 'idle'
            ? now - 7 * 86400000 - 1
            : kind === 'absolute'
              ? now - 2 * 86400000
              : now,
          kind === 'idle'
            ? now + 22 * 86400000
            : kind === 'absolute'
              ? now - 86400000
              : now + 30 * 86400000,
          kind === 'revoked' ? now : null,
        );
      const expired = client({ learning_session: token });
      await ownedRead(expired, '/api/settings', 401);
      await ownedRead(
        expired,
        '/api/notes/' + encodeURIComponent(target.note.itemId),
        401,
      );
      assert.ok(
        (await redirect(expired, '/settings')).startsWith('/login?returnTo='),
      );
    }
    const rotated = client({ learning_session: fixtures[0].token });
    await signIn(rotated, fixtures[0]);
    await ownedRead(
      client({ learning_session: fixtures[0].token }),
      '/api/settings',
      401,
    );
    fixtures[0].token = rotated.token();
    const signedOut = client();
    await signIn(signedOut, fixtures[1]);
    await signedOut.call('/api/auth/logout', 'POST', undefined, 204);
    await ownedRead(signedOut, '/api/settings', 401);
    const beforeCsrf = client();
    const stale = (await beforeCsrf.call('/api/auth/csrf')).data.token;
    await signIn(beforeCsrf, fixtures[0]);
    const response = await beforeCsrf.raw('/api/settings', {
      method: 'PUT',
      headers: {
        origin: config.origin,
        'content-type': 'application/json',
        'x-csrf-token': stale,
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403);
    assert.equal(durable(), before);
    await writeFile(
      fixturePath,
      JSON.stringify(
        {
          fixtures,
          durableHash: before,
          prepare: {
            pages,
            privateReads,
            foreignReads,
            expiredReads,
            signedInRedirects: 12,
            sessionRotation: true,
            logoutRevocation: true,
            sessionBoundCsrf: true,
          },
        },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    );
    console.log(
      'Six-account auth integration prepared. Restart the same app, then verify persistent cookies without login.',
    );
  } else {
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    for (const account of fixture.fixtures) {
      const own = client({ learning_session: account.token });
      assert.deepEqual(
        (await ownedRead(own, '/api/settings')).data,
        account.settings,
      );
      if (account.note)
        assert.deepEqual(
          (
            await ownedRead(
              own,
              '/api/notes/' + encodeURIComponent(account.note.itemId),
            )
          ).data,
          account.note,
        );
      if (account.learningHash) {
        assert.equal(
          hash((await own.call('/api/enrollment', 'POST', {})).data),
          account.learningHash,
        );
        assert.equal(await redirect(own, '/continue'), account.resume);
      }
      for (const route of ['/login', '/register'])
        assert.equal(await redirect(own, route), '/dashboard');
      const doc = await page(own, '/dashboard');
      assert.equal(doc.querySelectorAll('h1').length, 1);
    }
    assert.equal(durable(), fixture.durableHash);
    assert.equal(db.native.pragma('integrity_check', { simple: true }), 'ok');
    assert.deepEqual(db.native.pragma('foreign_key_check'), []);
    await writeFile(
      path.join(root, 'docs/m7-step6-http-audit.json'),
      JSON.stringify(
        {
          accounts: fixture.fixtures.length,
          prepare: fixture.prepare,
          afterRestart: {
            pages,
            privateReads,
            persistentCookiesWorkWithoutLogin: true,
            privateNotesLearningAndContinuePreserved: true,
          },
          unchangedDurableTables: tables.length,
          integrity: 'ok',
          foreignKeys: 'ok',
          nativeBrowser: 'pending: tool initialization failure',
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      'Persistent cookie restart, six-account ownership, private records and auth redirects verified.',
    );
  }
} finally {
  for (const id of temporary)
    db.native.prepare('DELETE FROM session WHERE id=?').run(id);
  db.native.close();
}
