import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';
import { servedDocument } from './served-document.mjs';

// Developer preview only; writes uniquely named synthetic accounts.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const mode = process.argv[2];
assert.ok(['save', 'verify'].includes(mode));
const fixturePath = path.join(root, '.tmp/m7-password-http-state.json');
const db = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
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
  const call = async (route, method = 'GET', body, status = 200) => {
    let csrf;
    if (method !== 'GET') {
      const response = await fetch(config.origin + '/api/auth/csrf', {
        headers: { cookie: cookie() },
        signal: AbortSignal.timeout(60000),
      });
      assert.equal(response.status, 200);
      remember(response);
      csrf = (await response.json()).data.token;
    }
    const response = await fetch(config.origin + route, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
      headers: {
        cookie: cookie(),
        origin: config.origin,
        'content-type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    remember(response);
    assert.equal(response.status, status, method + ' ' + route);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    if (status === 204) {
      assert.equal(await response.text(), '');
      assert.ok(
        response.headers
          .getSetCookie()
          .every((value) => value.includes('Max-Age=0')),
      );
      return null;
    }
    return response.json();
  };
  return {
    call,
    token: () => cookies.get('learning_session'),
    resume: async () => {
      const response = await fetch(config.origin + '/continue', {
        headers: { cookie: cookie() },
        redirect: 'manual',
        signal: AbortSignal.timeout(60000),
      });
      if (response.status === 307) return response.headers.get('location');
      assert.equal(response.status, 200);
      const doc = servedDocument(await response.text());
      const content = doc
        .querySelector('meta[http-equiv="refresh"]')
        ?.getAttribute('content');
      assert.ok(content?.startsWith('1;url='));
      return content.slice(6);
    },
  };
}
async function auth(
  client,
  account,
  password = account.password,
  status = 200,
) {
  return client.call(
    '/api/auth/login',
    'POST',
    { email: account.email, password },
    status,
  );
}
const stableTables = [
  'enrollment',
  'user_progress',
  'exercise_progress',
  'task_progress',
  'preparation_progress',
  'note',
  'scorecard',
  'activity_event',
  'mutation_receipt',
  'settings_receipt',
  'course_release',
  'content_item',
  'source_block',
  'source_mapping',
  'resource',
  'resource_use',
  'exercise_task',
];
const durable = () =>
  hash(
    stableTables.map((table) =>
      db.native.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
    ),
  );
try {
  if (mode === 'save') {
    const accounts = [];
    for (let i = 0; i < 2; i++) {
      const account = {
        email: 'password-http-' + randomUUID() + '@example.test',
        password: randomUUID() + randomUUID(),
      };
      const own = client();
      await own.call(
        '/api/auth/register',
        'POST',
        { ...account, confirmation: account.password },
        201,
      );
      await auth(own, account);
      const state = (await own.call('/api/enrollment', 'POST', {})).data;
      const settings = (await own.call('/api/settings')).data;
      const body = {
        itemId: 'se-26w-v1:d001',
        body: 'Synthetic durable password-change note ' + i,
        expectedStudentId: settings.id,
        expectedRevision: 0,
        mutationId: randomUUID(),
      };
      const note = (
        await own.call(
          '/api/notes/' + encodeURIComponent(body.itemId),
          'PUT',
          body,
        )
      ).data;
      accounts.push({
        ...account,
        studentId: settings.id,
        oldToken: own.token(),
        settings,
        note,
        learningHash: hash(state),
        resume: await own.resume(),
      });
    }
    const owner = accounts[0],
      other = accounts[1];
    const second = client();
    await auth(second, owner);
    owner.secondOldToken = second.token();
    const before = durable();
    owner.newPassword =
      ' ' + randomUUID() + ' changed 😀 ' + randomUUID() + ' ';
    const changing = client({ learning_session: owner.oldToken });
    await changing.call(
      '/api/auth/password',
      'POST',
      {
        currentPassword: owner.password,
        newPassword: owner.newPassword,
        expectedStudentId: owner.studentId,
      },
      204,
    );
    for (const token of [owner.oldToken, owner.secondOldToken])
      await client({ learning_session: token }).call(
        '/api/settings',
        'GET',
        undefined,
        401,
      );
    await client({ learning_session: other.oldToken }).call('/api/settings');
    assert.equal(durable(), before);
    await writeFile(
      fixturePath,
      JSON.stringify({ accounts, durableHash: before }, null, 2) + '\n',
    );
    console.log(
      'Password changed and both owner sessions revoked; restart the same application, then verify.',
    );
  } else {
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    const [owner, other] = fixture.accounts;
    const fresh = client();
    await auth(fresh, owner, owner.password, 401);
    await auth(fresh, owner, owner.newPassword);
    const currentSettings = (await fresh.call('/api/settings')).data;
    assert.deepEqual(currentSettings, {
      ...owner.settings,
      updatedAt: currentSettings.updatedAt,
    });
    assert.equal(
      hash((await fresh.call('/api/enrollment', 'POST', {})).data),
      owner.learningHash,
    );
    assert.equal(await fresh.resume(), owner.resume);
    assert.deepEqual(
      (await fresh.call('/api/notes/' + encodeURIComponent(owner.note.itemId)))
        .data,
      owner.note,
    );
    for (const token of [owner.oldToken, owner.secondOldToken])
      await client({ learning_session: token }).call(
        '/api/settings',
        'GET',
        undefined,
        401,
      );
    const peer = client();
    await auth(peer, other);
    assert.deepEqual((await peer.call('/api/settings')).data, other.settings);
    assert.equal(
      hash((await peer.call('/api/enrollment', 'POST', {})).data),
      other.learningHash,
    );
    assert.equal(durable(), fixture.durableHash);
    await writeFile(
      path.join(root, 'docs/m7-step3-http-audit.json'),
      JSON.stringify(
        {
          accounts: 2,
          oldOwnerSessionsRejected: 2,
          empty204AndCookiesCleared: true,
          restartFreshLogin: true,
          oldPasswordRejected: true,
          newPasswordAccepted: true,
          otherAccountPreserved: true,
          settingsNotesProgressContinuePreserved: true,
          unchangedDurableTables: stableTables.length,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      'Password-change restart, revoked sessions and private learning records verified.',
    );
  }
} finally {
  db.native.close();
}
