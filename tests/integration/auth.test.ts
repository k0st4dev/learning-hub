import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from '../../src/server/db/migrate.ts';
import { openDatabase, type Store } from '../../src/server/db/connection.ts';
import { appUser, session } from '../../src/server/db/schema.ts';
import {
  register,
  login,
  logout,
  currentUser,
  sessionAbsoluteMs,
  sessionIdleMs,
} from '../../src/server/auth/service.ts';
const root = process.cwd();
const password = 'A quiet river under bright stars';
const registration = (email = 'Student@Example.test') => ({
  email,
  password,
  confirmation: password,
  displayName: 'Student',
});
let directory: string;
let store: Store;
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/auth-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
});
afterEach(async () => {
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('auth-test-')
  )
    throw new Error('Unexpected temporary directory');
  await rm(directory, { recursive: true, force: true });
});
describe('local accounts and opaque sessions', () => {
  it('hashes unique salts and returns only safe account information', async () => {
    await register(store, registration());
    await register(store, registration('second@example.test'));
    const users = store.orm.select().from(appUser).all();
    const encoded = users[0]?.passwordHash.split('$');
    expect(encoded?.slice(1, 3)).toEqual(['argon2id', 'v=19']);
    expect(encoded?.[3]?.split(',').sort()).toEqual(['m=65536', 'p=1', 't=3']);
    expect(users[0]?.passwordHash).not.toBe(users[1]?.passwordHash);
    expect(store.orm.select().from(session).all()).toHaveLength(0);
    const signedIn = await login(store, {
      email: ' student@example.test ',
      password,
    });
    const user = currentUser(store, signedIn.token)!;
    expect(user.displayName).toBe('Student');
    expect(user).not.toHaveProperty('passwordHash');
    expect(
      JSON.stringify(store.orm.select().from(session).all()),
    ).not.toContain(signedIn.token);
    expect(signedIn.token).toHaveLength(43);
  });
  it('rejects concurrent canonical-email duplicates through the database constraint', async () => {
    const result = await Promise.allSettled([
      register(store, registration()),
      register(store, registration('student@example.test')),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = result.find((r) => r.status === 'rejected');
    expect(failed?.status === 'rejected' ? failed.reason : null).toMatchObject({
      status: 409,
      code: 'DUPLICATE_EMAIL',
    });
    expect(store.orm.select().from(appUser).all()).toHaveLength(1);
  });
  it('persists an account/session across file close and reopen; logout revokes only that session', async () => {
    await register(store, registration());
    const first = await login(store, {
      email: 'student@example.test',
      password,
    });
    const second = await login(store, {
      email: 'student@example.test',
      password,
    });
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(currentUser(store, first.token)?.email).toBe('Student@Example.test');
    logout(store, first.token);
    expect(currentUser(store, first.token)).toBeNull();
    expect(currentUser(store, second.token)).not.toBeNull();
  });
  it('enforces idle and absolute expiration on every lookup', async () => {
    const now = Date.now();
    await register(store, registration(), now);
    const signedIn = await login(
      store,
      { email: 'student@example.test', password },
      now,
    );
    expect(currentUser(store, signedIn.token, now + sessionIdleMs)).toBeNull();
    store.orm
      .update(session)
      .set({ lastSeenAt: now + sessionAbsoluteMs - 1000 })
      .run();
    expect(
      currentUser(store, signedIn.token, now + sessionAbsoluteMs),
    ).toBeNull();
  });
  it('blocks a sixth failed login and preserves throttle state across reconnect', async () => {
    await register(store, registration());
    for (let i = 0; i < 5; i++)
      await expect(
        login(store, { email: 'student@example.test', password: 'wrong' }),
      ).rejects.toMatchObject({ status: 401 });
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    await expect(
      login(store, { email: 'student@example.test', password }),
    ).rejects.toMatchObject({ status: 429 });
    expect(
      await login(
        store,
        { email: 'student@example.test', password },
        Date.now() + 900001,
      ),
    ).toHaveProperty('token');
  });
  it('keeps unknown-user errors generic and enforces registration throttling', async () => {
    await expect(
      login(store, { email: 'missing@example.test', password: 'wrong' }),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Email or password is incorrect.',
    });
    for (let i = 0; i < 10; i++)
      await expect(
        register(store, {
          ...registration(`u${i}@example.test`),
          password: 'bad',
        }),
      ).rejects.toBeDefined();
    await expect(register(store, registration())).rejects.toMatchObject({
      status: 429,
    });
    expect(
      store.orm
        .select()
        .from(appUser)
        .where(eq(appUser.emailCanonical, 'student@example.test'))
        .get(),
    ).toBeUndefined();
  });
});
