import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import { register, login, logout } from '../../src/server/auth/service';
import { readSettings, saveSettings } from '../../src/server/account/settings';
import { createCsrf } from '../../src/server/auth/csrf';
import { GET, PUT } from '../../src/app/api/settings/route';

vi.mock('../../src/server/db/current', () => ({ getStore: () => store }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const root = process.cwd();
const origin = 'http://127.0.0.1:3000';
const password = 'Local settings integration password';
let directory: string;
let store: Store;
let token: string;
let secret: string;
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/settings-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  token = await account('first');
  secret = await readFile(path.join(directory, 'csrf-secret'), 'utf8');
  vi.stubEnv('APP_DATA_DIR', directory);
  vi.stubEnv('APP_ORIGIN', origin);
  vi.stubEnv('PORT', '3000');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('settings-test-')
  )
    throw new Error('Unsafe test directory');
  await rm(directory, { recursive: true, force: true });
});
async function account(name: string) {
  const email = name + '@example.test';
  await register(store, { email, password, confirmation: password });
  return (await login(store, { email, password })).token;
}
function input() {
  const current = readSettings(store, token);
  return {
    displayName: ' Student čć ',
    timezone: 'Europe/Ljubljana',
    theme: 'dark',
    expectedRevision: current.revision,
    expectedStudentId: current.id,
    mutationId: randomUUID(),
  };
}
function request(
  method: 'GET' | 'PUT',
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const csrf = createCsrf(secret, token);
  return new NextRequest(origin + '/api/settings', {
    method,
    headers: {
      host: '127.0.0.1:3000',
      origin,
      cookie: `learning_session=${token}; learning_csrf=${csrf}`,
      'x-csrf-token': csrf,
      'content-type': 'application/json',
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
it('saves before enrollment, preserves credentials and survives reopening and fresh login', async () => {
  const before = store.native
    .prepare('SELECT email,password_hash,ui_locale FROM app_user')
    .all();
  const saved = saveSettings(store, token, input());
  expect(saved).toMatchObject({
    displayName: 'Student čć',
    theme: 'dark',
    timezone: 'Europe/Ljubljana',
    revision: 1,
  });
  expect(
    store.native
      .prepare('SELECT email,password_hash,ui_locale FROM app_user')
      .all(),
  ).toEqual(before);
  expect(
    store.native.prepare('SELECT count(*) n FROM enrollment').get(),
  ).toEqual({ n: 0 });
  store.native.close();
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  token = (await login(store, { email: saved.email, password })).token;
  expect(readSettings(store, token)).toEqual(saved);
  expect(Object.keys(saved).sort()).toEqual(
    [
      'id',
      'email',
      'displayName',
      'timezone',
      'theme',
      'revision',
      'updatedAt',
    ].sort(),
  );
});
it('isolates accounts and rejects a stale account guard', async () => {
  const other = await account('second');
  const prior = readSettings(store, other);
  saveSettings(store, token, input());
  expect(readSettings(store, other)).toEqual(prior);
  expect(() => readSettings(store, token, prior.id)).toThrow('account changed');
  expect(() => saveSettings(store, other, input())).toThrow('account changed');
});
it('replays original confirmations without overwriting later saves; rejects conflicts and reused keys', () => {
  const first = input();
  const saved = saveSettings(store, token, first);
  const later = saveSettings(store, token, {
    ...input(),
    displayName: 'Later',
  });
  expect(saveSettings(store, token, first)).toEqual(saved);
  expect(readSettings(store, token)).toEqual(later);
  expect(() =>
    saveSettings(store, token, { ...first, displayName: 'Different' }),
  ).toThrow('identifier');
  expect(() =>
    saveSettings(store, token, { ...first, mutationId: randomUUID() }),
  ).toThrow('another tab');
  expect(readSettings(store, token)).toEqual(later);
});
it('does not increment a no-op revision or timestamp', () => {
  const first = saveSettings(store, token, input());
  expect(saveSettings(store, token, input())).toEqual(first);
});
it('rolls back the profile when confirmation persistence fails', () => {
  const before = readSettings(store, token);
  store.native.exec(
    "CREATE TRIGGER fail_receipt BEFORE INSERT ON settings_receipt BEGIN SELECT RAISE(ABORT,'test failure'); END",
  );
  expect(() => saveSettings(store, token, input())).toThrow('test failure');
  expect(readSettings(store, token)).toEqual(before);
});
it.each([
  { email: 'replacement@example.test' },
  { password: 'anything' },
  { uiLocale: 'sr' },
  { timezone: '+01:00' },
  { timezone: 'Invented/Zone' },
  { theme: 'invalid' },
  { displayName: 'a'.repeat(81) },
])('rejects invalid or non-writable fields %j', (change) => {
  const before = readSettings(store, token);
  expect(() => saveSettings(store, token, { ...input(), ...change })).toThrow();
  expect(readSettings(store, token)).toEqual(before);
});
it('requires a current session even for replay', () => {
  const data = input();
  saveSettings(store, token, data);
  logout(store, token);
  expect(() => saveSettings(store, token, data)).toThrow();
  expect(() => saveSettings(store, undefined, {})).toThrow();
});
it('protects the API with host, origin, CSRF, no-store and strict input checks', async () => {
  const read = await GET(request('GET'));
  expect(read.status).toBe(200);
  expect(read.headers.get('cache-control')).toContain('no-store');
  const data = input();
  expect(
    (await PUT(request('PUT', data, { origin: 'https://foreign.test' })))
      .status,
  ).toBe(403);
  expect(
    (await PUT(request('PUT', data, { 'x-csrf-token': 'bad' }))).status,
  ).toBe(403);
  expect(
    (await GET(request('GET', undefined, { host: 'foreign.test' }))).status,
  ).toBe(403);
  expect(
    (await PUT(request('PUT', { ...data, email: 'bad@example.test' }))).status,
  ).toBe(400);
  const response = await PUT(request('PUT', data));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect((await response.json()).data).toEqual(readSettings(store, token));
  expect(
    (await PUT(request('PUT', { ...data, mutationId: randomUUID() }))).status,
  ).toBe(409);
});
