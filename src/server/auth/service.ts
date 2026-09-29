import { randomUUID, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Store } from '../db/connection.ts';
import type { appUser } from '../db/schema.ts';
import { AppError } from '../errors.ts';
import { digest } from './crypto.ts';
import { authRepository } from './repository.ts';
import {
  passwordSchema,
  hashPassword,
  verifyPassword,
  dummyPasswordCheck,
  passwordNeedsRehash,
} from './passwords.ts';

const email = z.string().trim().max(254).email();
export const registerSchema = z
  .object({
    email,
    password: passwordSchema,
    confirmation: z.string(),
    displayName: z.string().trim().max(80).default(''),
  })
  .strict()
  .refine((value) => value.password === value.confirmation, {
    message: 'Passwords do not match.',
    path: ['confirmation'],
  });
export const loginSchema = z
  .object({
    email,
    password: z.string().max(512),
    returnTo: z.string().optional(),
  })
  .strict();
export const sessionIdleMs = 7 * 86400000;
export const sessionAbsoluteMs = 30 * 86400000;
export const sessionCookieName = 'learning_session';
export function safeUser(user: typeof appUser.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
    theme: user.theme,
  };
}
export type Student = ReturnType<typeof safeUser>;
export function safeReturnPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return '/dashboard';
  try {
    const url = new URL(value, 'http://127.0.0.1');
    return url.origin === 'http://127.0.0.1'
      ? url.pathname + url.search + url.hash
      : '/dashboard';
  } catch {
    return '/dashboard';
  }
}
export async function register(store: Store, input: unknown, now = Date.now()) {
  const repo = authRepository(store);
  repo.registrationAttempt(now);
  const data = registerSchema.parse(input);
  const canonical = data.email.toLowerCase();
  if (repo.findByEmail(canonical))
    throw new AppError(
      409,
      'DUPLICATE_EMAIL',
      'An account with this email already exists on this installation.',
    );
  const passwordHash = await hashPassword(data.password);
  try {
    repo.insertUser({
      id: randomUUID(),
      email: data.email,
      emailCanonical: canonical,
      passwordHash,
      displayName: data.displayName,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    )
      throw new AppError(
        409,
        'DUPLICATE_EMAIL',
        'An account with this email already exists on this installation.',
      );
    throw error;
  }
  return { email: data.email };
}
export async function login(store: Store, input: unknown, now = Date.now()) {
  const data = loginSchema.parse(input);
  const canonical = data.email.toLowerCase();
  const repo = authRepository(store);
  repo.checkLogin(canonical, now);
  const user = repo.findByEmail(canonical);
  const valid = user
    ? await verifyPassword(user.passwordHash, data.password)
    : (await dummyPasswordCheck(data.password), false);
  if (!user || !valid) {
    repo.failLogin(canonical, now);
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect.',
    );
  }
  repo.checkLogin(canonical, now);
  if (passwordNeedsRehash(user.passwordHash))
    repo.updateHash(user.id, await hashPassword(data.password), now);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = now + sessionAbsoluteMs;
  store.native
    .transaction(() => {
      repo.clearAccountFailures(canonical);
      repo.insertSession({
        id: randomUUID(),
        userId: user.id,
        tokenHash: digest(token),
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
      });
    })
    .immediate();
  return { token, expiresAt, redirect: safeReturnPath(data.returnTo) };
}
export function currentUser(
  store: Store,
  token: string | undefined,
  now = Date.now(),
): Student | null {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const repo = authRepository(store);
  const found = repo.findSession(digest(token));
  if (
    !found ||
    found.session.revokedAt !== null ||
    found.session.expiresAt <= now ||
    now - found.session.lastSeenAt >= sessionIdleMs
  )
    return null;
  if (now - found.session.lastSeenAt >= 300000)
    repo.touchSession(found.session.id, now);
  return safeUser(found.user);
}
export function requireStudent(
  store: Store,
  token: string | undefined,
  now = Date.now(),
) {
  const student = currentUser(store, token, now);
  if (!student)
    throw new AppError(401, 'AUTH_REQUIRED', 'Sign in again to continue.');
  return student;
}
export function logout(
  store: Store,
  token: string | undefined,
  now = Date.now(),
) {
  if (token) authRepository(store).revokeSession(digest(token), now);
}
