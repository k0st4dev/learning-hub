import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';

// Run save, restart the development server with the same database, then run verify.
// Only uniquely named synthetic accounts in the isolated preview may be written.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const mode = process.argv[2];
assert.ok(process.argv.length === 3 && ['save', 'verify'].includes(mode));
const fixturePath = path.join(root, '.tmp/m6-notes-http-state.json');
const itemId = 'se-26w-v1:d001';
const route = '/api/notes/' + encodeURIComponent(itemId);
const fingerprint = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const db = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
const activity = (studentId) =>
  db.native
    .prepare(
      'SELECT count(*) AS n FROM activity_event WHERE enrollment_id IN (SELECT id FROM enrollment WHERE user_id = ?)',
    )
    .get(studentId).n;
function client() {
  const cookies = new Map();
  const cookie = () =>
    [...cookies].map(([key, value]) => key + '=' + value).join('; ');
  const remember = (response) => {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';')[0];
      const at = pair.indexOf('=');
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
  };
  return async (url, method = 'GET', body, status = 200) => {
    let csrf;
    if (method !== 'GET') {
      const result = await fetch(config.origin + '/api/auth/csrf', {
        headers: { cookie: cookie() },
      });
      assert.equal(result.status, 200);
      remember(result);
      csrf = (await result.json()).data.token;
    }
    const result = await fetch(config.origin + url, {
      method,
      redirect: 'manual',
      headers: {
        cookie: cookie(),
        origin: config.origin,
        'content-type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    remember(result);
    assert.equal(result.status, status, method + ' ' + url);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    return status === 204 ? null : result.json();
  };
}
async function signIn(call, fixture) {
  await call('/api/auth/login', 'POST', {
    email: fixture.email,
    password: fixture.password,
  });
}
async function createFixture(call) {
  const email = 'notes-http-' + randomUUID() + '@example.test';
  const password = randomUUID() + randomUUID();
  await call(
    '/api/auth/register',
    'POST',
    { email, password, confirmation: password },
    201,
  );
  const fixture = { email, password };
  await signIn(call, fixture);
  const state = (await call('/api/enrollment', 'POST', {})).data;
  const studentId = db.native
    .prepare('SELECT id FROM app_user WHERE email_canonical = ?')
    .get(email).id;
  return {
    ...fixture,
    studentId,
    learningHash: fingerprint(state),
    activityCount: activity(studentId),
  };
}
try {
  if (mode === 'save') {
    const first = client();
    const second = client();
    const one = await createFixture(first);
    const two = await createFixture(second);
    const payload = {
      mutationId: randomUUID(),
      itemId,
      expectedRevision: 0,
      expectedStudentId: one.studentId,
      body: 'Ж'.repeat(20000),
    };
    assert.equal((await first(route)).data.revision, 0);
    const original = await first(route, 'PUT', payload);
    assert.deepEqual(await first(route, 'PUT', payload), original);
    const update = {
      ...payload,
      mutationId: randomUUID(),
      expectedRevision: 1,
      body: '  Privatna beleška: čćžšđ Ћирилица 😀\n<script>plain text</script>\n ',
    };
    const confirmed = await first(route, 'PUT', update);
    assert.equal(confirmed.revision, 2);
    assert.deepEqual(await first(route), confirmed);
    assert.deepEqual(await first(route, 'PUT', payload), original);
    assert.deepEqual(await first(route), confirmed);
    const conflict = await first(
      route,
      'PUT',
      { ...update, mutationId: randomUUID() },
      409,
    );
    assert.deepEqual(conflict.error.currentState, confirmed.data);
    assert.equal(
      (
        await first(
          route,
          'PUT',
          { ...update, body: 'different key reuse' },
          409,
        )
      ).error.code,
      'MUTATION_REUSED',
    );
    await first(
      route,
      'PUT',
      {
        ...update,
        mutationId: randomUUID(),
        expectedRevision: 2,
        body: 'x'.repeat(20001),
      },
      400,
    );
    await first(route, 'PUT', { ...update, itemId: 'se-26w-v1:d002' }, 400);
    await first(
      '/api/notes/' + encodeURIComponent('se-26w-v1:missing'),
      'GET',
      undefined,
      404,
    );
    assert.equal((await second(route)).data.revision, 0);
    await second(route, 'PUT', update, 403);
    const otherInput = {
      ...payload,
      mutationId: randomUUID(),
      expectedStudentId: two.studentId,
      body: 'Second account only',
    };
    await second(route, 'PUT', otherInput);
    assert.deepEqual(await first(route), confirmed);
    assert.equal((await second(route)).data.body, otherInput.body);
    const clearInput = {
      ...otherInput,
      mutationId: randomUUID(),
      expectedRevision: 1,
      body: '',
    };
    const cleared = await second(route, 'PUT', clearInput);
    assert.equal(cleared.revision, 2);
    assert.equal(cleared.data.body, '');
    for (const [call, fixture] of [
      [first, one],
      [second, two],
    ]) {
      assert.equal(
        fingerprint((await call('/api/enrollment', 'POST', {})).data),
        fixture.learningHash,
      );
      assert.equal(activity(fixture.studentId), fixture.activityCount);
      await call('/api/auth/logout', 'POST', {}, 204);
      await call(route, 'GET', undefined, 401);
    }
    await writeFile(
      fixturePath,
      JSON.stringify(
        {
          savedAt: new Date().toISOString(),
          accounts: [
            { ...one, input: update, confirmed },
            { ...two, input: clearInput, confirmed: cleared },
          ],
        },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    );
    console.log(
      'Note HTTP checks passed. Restart the server with the same preview database, then run verify.',
    );
  } else {
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    assert.equal(fixture.accounts.length, 2);
    for (const account of fixture.accounts) {
      assert.match(account.email, /^notes-http-[a-f0-9-]+@example\.test$/);
      const call = client();
      await signIn(call, account);
      assert.deepEqual(await call(route), account.confirmed);
      assert.deepEqual(
        await call(route, 'PUT', account.input),
        account.confirmed,
      );
      assert.equal(
        fingerprint((await call('/api/enrollment', 'POST', {})).data),
        account.learningHash,
      );
      assert.equal(activity(account.studentId), account.activityCount);
      await call('/api/auth/logout', 'POST', {}, 204);
    }
    const report = {
      date: new Date().toISOString(),
      savedAt: fixture.savedAt,
      server: 'development',
      scope:
        'M6 step 1 owned notes API; verify run after externally stopping/restarting the development server',
      exactUnicodeText: true,
      full20000CharacterNote: true,
      updateAndClear: true,
      independentNoteRevision: true,
      exactRetryIncludingOlderReceipt: true,
      staleSave409WithOwnedCurrentState: true,
      reusedKey409: true,
      oversizedAndRouteMismatch400: true,
      inaccessibleItem404: true,
      loggedOut401: true,
      accountSwitch403: true,
      twoUsersIsolated: true,
      learningAndActivityUnchanged: true,
      freshLoginAfterServerRestart: true,
      committedNotesAndReceiptsPreserved: true,
      noStoreResponses: true,
      notesUI: 'not implemented in this step',
    };
    await writeFile(
      path.join(root, 'docs/m6-step1-http-audit.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(report);
  }
} finally {
  db.native.close();
}
