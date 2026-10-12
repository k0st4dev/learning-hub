import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';
import { servedDocument } from './served-document.mjs';

// Existing preview only. Prepare distinct synthetic records, run the real CLI
// with the app stopped, restart, then verify without another password reset.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const mode = process.argv[2];
assert.ok(['prepare', 'verify'].includes(mode));
const fixturePath = path.join(root, '.tmp/m7-recovery-http-state.json');
const db = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const tables = [
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
    tables.map((table) =>
      db.native.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
    ),
  );
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
  return {
    token: () => cookies.get('learning_session'),
    async call(route, method = 'GET', body, status = 200) {
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
      return response.json();
    },
    async resume() {
      const response = await fetch(config.origin + '/continue', {
        headers: { cookie: cookie() },
        redirect: 'manual',
        signal: AbortSignal.timeout(60000),
      });
      if (response.status === 307) return response.headers.get('location');
      assert.equal(response.status, 200);
      const content = servedDocument(await response.text())
        .querySelector('meta[http-equiv="refresh"]')
        ?.getAttribute('content');
      assert.ok(content?.startsWith('1;url='));
      return content.slice(6);
    },
  };
}
async function login(own, account, password = account.password, status = 200) {
  return own.call(
    '/api/auth/login',
    'POST',
    { email: account.email, password },
    status,
  );
}
try {
  if (mode === 'prepare') {
    const accounts = [];
    for (let n = 0; n < 2; n++) {
      const account = {
          email: 'recovery-http-' + randomUUID() + '@example.test',
          password: randomUUID() + randomUUID(),
        },
        own = client();
      await own.call(
        '/api/auth/register',
        'POST',
        { ...account, confirmation: account.password },
        201,
      );
      await login(own, account);
      let learning = (await own.call('/api/enrollment', 'POST', {})).data;
      learning = (
        await own.call('/api/enrollment/orientation', 'PUT', {
          kind: 'orientation',
          acknowledged: true,
          deferred: true,
          expectedRevision: learning.revision,
          mutationId: randomUUID(),
        })
      ).data;
      if (n === 0)
        learning = (
          await own.call(
            '/api/progress/lessons/' +
              encodeURIComponent('se-26w-v1:d001-learn'),
            'PUT',
            {
              kind: 'lesson',
              itemId: 'se-26w-v1:d001-learn',
              completed: true,
              expectedRevision: learning.revision,
              mutationId: randomUUID(),
            },
          )
        ).data;
      const settings = (await own.call('/api/settings')).data;
      const itemId = 'se-26w-v1:d001';
      const note = (
        await own.call('/api/notes/' + encodeURIComponent(itemId), 'PUT', {
          itemId,
          body: 'Private recovery fixture note ' + n,
          expectedStudentId: settings.id,
          expectedRevision: 0,
          mutationId: randomUUID(),
        })
      ).data;
      accounts.push({
        ...account,
        oldToken: own.token(),
        settings,
        note,
        learningHash: hash(learning),
        resume: await own.resume(),
      });
    }
    const extra = client();
    await login(extra, accounts[0]);
    accounts[0].secondOldToken = extra.token();
    accounts[0].recoveredPassword =
      ' ' + randomUUID() + ' recovered čć 😀 ' + randomUUID() + ' ';
    await writeFile(
      fixturePath,
      JSON.stringify({ accounts, durableHash: durable() }, null, 2) + '\n',
      { mode: 0o600 },
    );
    console.log(
      'Two private recovery fixtures prepared. Stop the app and use the real interactive recovery command.',
    );
  } else {
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8')),
      [owner, peer] = fixture.accounts;
    const own = client();
    await login(own, owner, owner.password, 401);
    await login(own, owner, owner.recoveredPassword);
    const settings = (await own.call('/api/settings')).data;
    assert.deepEqual(settings, {
      ...owner.settings,
      updatedAt: settings.updatedAt,
    });
    assert.equal(
      hash((await own.call('/api/enrollment', 'POST', {})).data),
      owner.learningHash,
    );
    assert.equal(await own.resume(), owner.resume);
    assert.ok(owner.resume.includes('/exercises/d001-practice'));
    assert.deepEqual(
      (await own.call('/api/notes/' + encodeURIComponent(owner.note.itemId)))
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
    const other = client();
    await login(other, peer);
    assert.deepEqual((await other.call('/api/settings')).data, peer.settings);
    assert.equal(
      hash((await other.call('/api/enrollment', 'POST', {})).data),
      peer.learningHash,
    );
    assert.equal(durable(), fixture.durableHash);
    assert.equal(db.native.pragma('integrity_check', { simple: true }), 'ok');
    assert.deepEqual(db.native.pragma('foreign_key_check'), []);
    await writeFile(
      path.join(root, 'docs/m7-step5-http-audit.json'),
      JSON.stringify(
        {
          accounts: 2,
          revokedOwnerSessions: 2,
          oldPasswordRejected: true,
          recoveredPasswordAcceptedAfterRestart: true,
          peerAccountPreserved: true,
          confirmedDay1LessonNoteAndContinuePreserved: true,
          unchangedDurableTables: tables.length,
          integrity: 'ok',
          foreignKeys: 'ok',
          nativeTerminalEvidence: 'recorded separately',
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      'Recovered login, revoked sessions, confirmed Day 1 progress/private notes/Continue and peer isolation verified.',
    );
  }
} finally {
  db.native.close();
}
