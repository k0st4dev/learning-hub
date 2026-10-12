import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { environment, root } from './environment.mjs';
import { openDatabase } from '../src/server/db/connection.ts';
import { migrate } from '../src/server/db/migrate.ts';

// Developer-only preview audit. Existing accounts are never edited.
const config = environment();
assert.equal(config.dataDir, path.join(root, '.tmp/m2-preview'));
const mode = process.argv[2];
assert.ok(['migrate', 'save', 'verify'].includes(mode));
const fixturePath = path.join(root, '.tmp/m7-settings-http-state.json');
const reportPath = path.join(root, 'docs/m7-step1-http-audit.json');
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function snapshot(db) {
  const tables = db.native
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  return Object.fromEntries(
    tables
      .filter(
        ({ name }) => !['_app_migration', 'settings_receipt'].includes(name),
      )
      .map(({ name }) => [
        name,
        hash(
          db.native
            .prepare(
              name === 'app_user'
                ? 'SELECT id,email,email_canonical,password_hash,display_name,timezone,ui_locale,theme,created_at,updated_at FROM app_user ORDER BY rowid'
                : `SELECT * FROM "${name}" ORDER BY rowid`,
            )
            .all(),
        ),
      ]),
  );
}
function client() {
  const cookies = new Map();
  const remember = (response) => {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';')[0];
      const at = pair.indexOf('=');
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
  };
  const cookie = () => [...cookies].map(([k, v]) => k + '=' + v).join('; ');
  return async (route, method = 'GET', body, status = 200) => {
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
    return response.json();
  };
}
if (mode === 'migrate') {
  let db = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
  const before = snapshot(db);
  const secret = await readFile(
    path.join(config.dataDir, 'csrf-secret'),
    'utf8',
  );
  db.native.close();
  const result = await migrate(config.dataDir, root);
  db = openDatabase(result.filename);
  try {
    assert.deepEqual(snapshot(db), before);
    assert.equal(db.native.pragma('integrity_check', { simple: true }), 'ok');
    assert.equal(
      await readFile(path.join(config.dataDir, 'csrf-secret'), 'utf8'),
      secret,
    );
  } finally {
    db.native.close();
  }
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        migration: {
          applied: result.appliedIds,
          backupCreated: !!result.backup,
          existingTablesPreserved: Object.keys(before).length,
          integrity: 'ok',
          secretPreserved: true,
        },
        http: 'pending',
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Migration and existing-data preservation verified.');
} else if (mode === 'save') {
  const accounts = [];
  for (let index = 0; index < 2; index++) {
    const call = client();
    const email = 'settings-http-' + randomUUID() + '@example.test',
      password = randomUUID() + randomUUID();
    await call(
      '/api/auth/register',
      'POST',
      { email, password, confirmation: password },
      201,
    );
    await call('/api/auth/login', 'POST', { email, password });
    const initial = (await call('/api/settings')).data;
    const payload = {
      displayName: 'Settings student ' + index,
      timezone: index ? 'UTC' : 'Europe/Ljubljana',
      theme: index ? 'light' : 'dark',
      expectedRevision: initial.revision,
      expectedStudentId: initial.id,
      mutationId: randomUUID(),
    };
    const saved = (await call('/api/settings', 'PUT', payload)).data;
    assert.equal(saved.revision, 1);
    assert.deepEqual((await call('/api/settings', 'PUT', payload)).data, saved);
    await call(
      '/api/settings',
      'PUT',
      { ...payload, mutationId: randomUUID() },
      409,
    );
    await call(
      '/api/settings',
      'PUT',
      { ...payload, email: 'changed@example.test' },
      400,
    );
    accounts.push({ email, password, payload, saved });
  }
  await writeFile(fixturePath, JSON.stringify({ accounts }, null, 2) + '\n');
  console.log(
    'Two isolated profiles saved; restart the same application, then run verify.',
  );
} else {
  const { accounts } = JSON.parse(await readFile(fixturePath, 'utf8'));
  for (const [index, account] of accounts.entries()) {
    const call = client();
    await call('/api/auth/login', 'POST', {
      email: account.email,
      password: account.password,
    });
    assert.deepEqual((await call('/api/settings')).data, account.saved);
    assert.deepEqual(
      (await call('/api/settings', 'PUT', account.payload)).data,
      account.saved,
    );
    await call(
      '/api/settings?expectedStudentId=' + accounts[1 - index].saved.id,
      'GET',
      undefined,
      403,
    );
  }
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  report.http = {
    accounts: 2,
    freshLoginAfterServerRestart: true,
    settingsAndConfirmationsPersisted: true,
    foreignAccountsRejected: true,
    staleWritesRejected: true,
    readOnlyEmail: true,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(
    'Restart, profile persistence, retries and account isolation verified.',
  );
}
