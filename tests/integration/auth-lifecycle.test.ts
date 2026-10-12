import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { argon2id, hash } from 'argon2';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  register,
  login,
  currentUser,
  changePassword,
  sessionIdleMs,
  sessionAbsoluteMs,
} from '../../src/server/auth/service';
import * as passwords from '../../src/server/auth/passwords';
import { AppError } from '../../src/server/errors';
import LoginPage from '../../src/app/login/page';
import RegisterPage from '../../src/app/register/page';
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookie ? { value: cookie } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error('REDIRECT:' + url);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../../src/server/db/current', () => ({
  getStore: () => {
    if (!available) throw new AppError(503, 'SETUP_REQUIRED', 'Setup needed');
    return store;
  },
}));
const root = process.cwd(),
  password = 'A quiet river under bright stars';
let directory: string,
  store: Store,
  token: string,
  cookie: string | undefined,
  available: boolean,
  now: number;
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/auth-lifecycle-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  now = Date.now();
  await register(
    store,
    { email: 'owner@example.test', password, confirmation: password },
    now,
  );
  token = (await login(store, { email: 'owner@example.test', password }, now))
    .token;
  cookie = token;
  available = true;
});
afterEach(async () => {
  vi.restoreAllMocks();
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('auth-lifecycle-')
  )
    throw new Error('Unsafe test directory');
  await rm(directory, { recursive: true, force: true });
});
const page = (route: string) =>
  route === 'login'
    ? LoginPage({
        searchParams: Promise.resolve({ returnTo: 'https://foreign.test' }),
      })
    : RegisterPage();
it.each(['login', 'register'])(
  'redirects a valid signed-in visitor from %s to Dashboard',
  async (route) => {
    await expect(page(route)).rejects.toThrow('REDIRECT:/dashboard');
  },
);
it.each(['absent', 'malformed', 'expired', 'revoked', 'unavailable'])(
  'keeps public login usable for %s session/setup state',
  async (state) => {
    if (state === 'absent') cookie = undefined;
    if (state === 'malformed') cookie = 'invalid';
    if (state === 'expired')
      store.native
        .prepare('UPDATE session SET created_at=?,last_seen_at=?,expires_at=?')
        .run(now - 8 * 86400000, now - sessionIdleMs - 1, now + 22 * 86400000);
    if (state === 'revoked')
      store.native.prepare('UPDATE session SET revoked_at=?').run(now);
    if (state === 'unavailable') available = false;
    await expect(page('login')).resolves.toBeTruthy();
    await expect(page('register')).resolves.toBeTruthy();
  },
);
it('refreshes idle activity only every five minutes and never extends absolute expiry', () => {
  const session = () =>
    store.native
      .prepare('SELECT last_seen_at,expires_at FROM session')
      .get() as { last_seen_at: number; expires_at: number };
  currentUser(store, token, now + 299999);
  expect(session().last_seen_at).toBe(now);
  currentUser(store, token, now + 300000);
  expect(session()).toEqual({
    last_seen_at: now + 300000,
    expires_at: now + sessionAbsoluteMs,
  });
  currentUser(store, token, now + 599999);
  expect(session().last_seen_at).toBe(now + 300000);
  expect(currentUser(store, token, now + 300000 + sessionIdleMs)).toBeNull();
});
async function legacyHash() {
  const encoded = await hash(password, {
    type: argon2id,
    memoryCost: 32768,
    timeCost: 2,
    parallelism: 1,
  });
  store.native.prepare('UPDATE app_user SET password_hash=?').run(encoded);
  return encoded;
}
it('upgrades an existing encoded hash on login without changing identity/settings or existing sessions', async () => {
  const before = currentUser(store, token),
    prior = await legacyHash();
  await login(store, { email: 'owner@example.test', password });
  const encoded = (
    store.native.prepare('SELECT password_hash FROM app_user').get() as {
      password_hash: string;
    }
  ).password_hash;
  expect(encoded).not.toBe(prior);
  expect(passwords.passwordNeedsRehash(encoded)).toBe(false);
  expect(currentUser(store, token)).toEqual(before);
  store.native.close();
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  expect(currentUser(store, token)).toEqual(before);
});
it('rolls back hash upgrade and session creation when session persistence fails', async () => {
  const prior = await legacyHash();
  store.native.exec(
    "CREATE TRIGGER fail_login_session BEFORE INSERT ON session BEGIN SELECT RAISE(ABORT,'login session failure'); END",
  );
  await expect(
    login(store, { email: 'owner@example.test', password }),
  ).rejects.toThrow('login session failure');
  expect(
    store.native.prepare('SELECT password_hash FROM app_user').get(),
  ).toEqual({ password_hash: prior });
  expect(store.native.prepare('SELECT count(*) n FROM session').get()).toEqual({
    n: 1,
  });
});
it('does not let a delayed login rehash replace a concurrently changed password', async () => {
  await legacyHash();
  const original = passwords.hashPassword;
  let release!: () => void, reached!: () => void;
  const ready = new Promise<void>((resolve) => {
      reached = resolve;
    }),
    barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
  vi.spyOn(passwords, 'hashPassword').mockImplementationOnce(async (value) => {
    const encoded = await original(value);
    reached();
    await barrier;
    return encoded;
  });
  const pending = login(store, { email: 'owner@example.test', password });
  const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
  await ready;
  const next = 'A changed password before rehash';
  await changePassword(store, token, {
    currentPassword: password,
    newPassword: next,
    expectedStudentId: currentUser(store, token)!.id,
  });
  release();
  await rejected;
  expect(currentUser(store, token)).toBeNull();
  expect(
    (await login(store, { email: 'owner@example.test', password: next })).token,
  ).toBeTruthy();
});
