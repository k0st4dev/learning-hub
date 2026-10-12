import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  register,
  login,
  logout,
  currentUser,
  changePassword,
  requireStudent,
} from '../../src/server/auth/service';
import * as passwords from '../../src/server/auth/passwords';
import { createCsrf } from '../../src/server/auth/csrf';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import { startCourse, mutateLearning } from '../../src/server/learning/mutate';
import { readNote, saveNote } from '../../src/server/learning/notes';
import { snapshot, continuePath } from '../../src/server/learning/read';
import { POST } from '../../src/app/api/auth/password/route';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

vi.mock('../../src/server/db/current', () => ({ getStore: () => store }));
const root = process.cwd();
const blockedPassword = gunzipSync(
  readFileSync(path.join(root, 'src/server/auth/common-passwords.txt.gz')),
)
  .toString('utf8')
  .split('\n')
  .find((value) => [...value].length >= 15)!;
const origin = 'http://127.0.0.1:3000';
const password = 'A quiet river under bright stars';
const newPassword = ' A new river flowing over stones 😀 ';
let directory: string,
  store: Store,
  token: string,
  studentId: string,
  secret: string;
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/password-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  token = await account('owner');
  studentId = requireStudent(store, token).id;
  secret = await readFile(path.join(directory, 'csrf-secret'), 'utf8');
  vi.stubEnv('APP_DATA_DIR', directory);
  vi.stubEnv('APP_ORIGIN', origin);
  vi.stubEnv('PORT', '3000');
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('password-test-')
  )
    throw new Error('Unsafe test directory');
  await rm(directory, { recursive: true, force: true });
});
async function account(name: string) {
  const email = name + '@example.test';
  await register(store, { email, password, confirmation: password });
  return (await login(store, { email, password })).token;
}
const input = () => ({
  currentPassword: password,
  newPassword,
  expectedStudentId: studentId,
});
const user = () =>
  store.native
    .prepare('SELECT * FROM app_user WHERE id=?')
    .get(studentId) as Record<string, unknown>;
const sessions = () =>
  store.native.prepare('SELECT * FROM session ORDER BY rowid').all();
function request(
  body: unknown = input(),
  headers: Record<string, string> = {},
) {
  const csrf = createCsrf(secret, token);
  return new NextRequest(origin + '/api/auth/password', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      origin,
      cookie: `learning_session=${token}; learning_csrf=${csrf}`,
      'x-csrf-token': csrf,
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
it('changes the Argon2id hash, revokes all owner sessions, preserves another account and survives reopen', async () => {
  const second = (await login(store, { email: 'owner@example.test', password }))
    .token;
  const other = await account('other');
  const peer = currentUser(store, other);
  const before = user();
  await changePassword(store, token, input());
  const after = user();
  expect(String(after.password_hash).split('$').slice(1, 3)).toEqual([
    'argon2id',
    'v=19',
  ]);
  expect(String(after.password_hash).split('$')[3]?.split(',').sort()).toEqual([
    'm=65536',
    'p=1',
    't=3',
  ]);
  expect(after.password_hash).not.toBe(before.password_hash);
  const stableBefore = Object.fromEntries(
    Object.entries(before).filter(
      ([key]) => !['password_hash', 'updated_at'].includes(key),
    ),
  );
  const stableAfter = Object.fromEntries(
    Object.entries(after).filter(
      ([key]) => !['password_hash', 'updated_at'].includes(key),
    ),
  );
  expect(stableAfter).toEqual(stableBefore);
  expect(currentUser(store, token)).toBeNull();
  expect(currentUser(store, second)).toBeNull();
  expect(currentUser(store, other)).toEqual(peer);
  store.native.close();
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  expect(currentUser(store, token)).toBeNull();
  await expect(
    login(store, { email: 'owner@example.test', password }),
  ).rejects.toMatchObject({ status: 401 });
  const fresh = await login(store, {
    email: 'owner@example.test',
    password: newPassword,
  });
  expect(currentUser(store, fresh.token)?.id).toBe(studentId);
  await expect(
    login(store, { email: 'owner@example.test', password: newPassword.trim() }),
  ).rejects.toMatchObject({ status: 401 });
});
it('preserves complete curriculum, confirmed private notes, progress and Continue', async () => {
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);
  startCourse(store, token);
  mutateLearning(store, token, {
    kind: 'orientation',
    acknowledged: true,
    deferred: true,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });
  const itemId = 'se-26w-v1:d001';
  saveNote(store, token, {
    itemId,
    body: 'Preserved private learning note',
    expectedStudentId: studentId,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });
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
  const rows = () =>
    tables.map((table) =>
      store.native.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
    );
  const before = rows();
  const learning = snapshot(store, token);
  const resume = continuePath(learning);
  await changePassword(store, token, input());
  expect(rows()).toEqual(before);
  const fresh = (
    await login(store, { email: 'owner@example.test', password: newPassword })
  ).token;
  expect(snapshot(store, fresh)).toEqual(learning);
  expect(continuePath(snapshot(store, fresh))).toEqual(resume);
  expect(readNote(store, fresh, itemId).body).toBe(
    'Preserved private learning note',
  );
});
it.each([
  { newPassword: 'short' },
  { newPassword: blockedPassword },
  { newPassword: '😀'.repeat(129) },
  { newPassword: '\u0800'.repeat(200) },
  { email: 'foreign@example.test' },
  { currentPassword: 'a'.repeat(513) },
])(
  'rejects invalid or extra fields without credential/session changes %j',
  async (changes) => {
    const before = user(),
      prior = sessions();
    await expect(
      changePassword(store, token, { ...input(), ...changes }),
    ).rejects.toThrow();
    expect(user()).toEqual(before);
    expect(sessions()).toEqual(prior);
  },
);
it('rejects wrong current password, foreign guards, missing and revoked sessions', async () => {
  const before = user();
  await expect(
    changePassword(store, token, { ...input(), currentPassword: 'wrong' }),
  ).rejects.toMatchObject({ status: 400, code: 'CURRENT_PASSWORD_INCORRECT' });
  await expect(
    changePassword(store, token, {
      ...input(),
      expectedStudentId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(changePassword(store, undefined, input())).rejects.toMatchObject(
    { status: 401 },
  );
  logout(store, token);
  await expect(changePassword(store, token, input())).rejects.toMatchObject({
    status: 401,
  });
  expect(user()).toEqual(before);
});
it('persists password-change throttling across reconnect without blocking login or another account', async () => {
  const now = Date.now();
  for (let i = 0; i < 5; i++)
    await expect(
      changePassword(
        store,
        token,
        { ...input(), currentPassword: 'wrong' },
        now,
      ),
    ).rejects.toMatchObject({ status: 400 });
  store.native.close();
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  await expect(
    changePassword(store, token, input(), now),
  ).rejects.toMatchObject({ status: 429, details: { retryAfter: 900 } });
  expect(
    (await login(store, { email: 'owner@example.test', password }, now)).token,
  ).toBeTruthy();
  const other = await account('other');
  await changePassword(
    store,
    other,
    { ...input(), expectedStudentId: requireStudent(store, other).id },
    now,
  );
  await changePassword(store, token, input(), now + 900001);
});
it('rolls back hash and session revocation together if the session update fails', async () => {
  const before = user(),
    prior = sessions();
  store.native.exec(
    "CREATE TRIGGER fail_revoke BEFORE UPDATE OF revoked_at ON session BEGIN SELECT RAISE(ABORT,'test revoke failure'); END",
  );
  await expect(changePassword(store, token, input())).rejects.toThrow(
    'test revoke failure',
  );
  expect(user()).toEqual(before);
  expect(sessions()).toEqual(prior);
  expect(currentUser(store, token)).not.toBeNull();
});
it('does not issue a session from a login verified before a concurrent password change', async () => {
  const actual = passwords.verifyPassword;
  let release!: () => void;
  let reached!: () => void;
  const ready = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.spyOn(passwords, 'verifyPassword').mockImplementationOnce(
    async (hash, value) => {
      const valid = await actual(hash, value);
      reached();
      await barrier;
      return valid;
    },
  );
  const pending = login(store, { email: 'owner@example.test', password });
  const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
  await ready;
  try {
    await changePassword(store, token, input());
  } finally {
    release();
  }
  await rejected;
  expect(
    store.native
      .prepare(
        'SELECT count(*) n FROM session WHERE user_id=? AND revoked_at IS NULL',
      )
      .get(studentId),
  ).toEqual({ n: 0 });
});
it('rechecks revoked session after asynchronous password hashing', async () => {
  const actual = passwords.hashPassword;
  let release!: () => void, reached!: () => void;
  const ready = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.spyOn(passwords, 'hashPassword').mockImplementationOnce(async (value) => {
    const hash = await actual(value);
    reached();
    await barrier;
    return hash;
  });
  const before = user();
  const pending = changePassword(store, token, input());
  const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
  await ready;
  logout(store, token);
  release();
  await rejected;
  expect(user()).toEqual(before);
});
it('protects the HTTP route and returns an empty 204 with both cookies cleared', async () => {
  expect(
    (await POST(request(input(), { origin: 'https://foreign.test' }))).status,
  ).toBe(403);
  expect(
    (await POST(request(input(), { 'x-csrf-token': 'wrong' }))).status,
  ).toBe(403);
  const invalid = await POST(request({ ...input(), currentPassword: 'wrong' }));
  expect(invalid.status).toBe(400);
  const text = await invalid.text();
  expect(text).not.toContain(password);
  expect(text).not.toContain(newPassword);
  const response = await POST(request());
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(response.headers.get('cache-control')).toBe('no-store');
  const cookies = response.headers.getSetCookie();
  expect(cookies).toHaveLength(2);
  for (const name of ['learning_session', 'learning_csrf'])
    expect(
      cookies.some(
        (value) =>
          value.startsWith(name + '=;') &&
          value.includes('Max-Age=0') &&
          value.includes('HttpOnly'),
      ),
    ).toBe(true);
  expect((await POST(request())).status).toBe(401);
});
