import { and, eq } from 'drizzle-orm';
import type { Store } from '../db/connection.ts';
import { appUser, session, authThrottle } from '../db/schema.ts';
import { AppError } from '../errors.ts';
import { digest } from './crypto.ts';

export function authRepository(store: Store) {
  const db = store.orm;
  const throttleRow = (key: string) =>
    db
      .select()
      .from(authThrottle)
      .where(eq(authThrottle.keyHash, digest(key)))
      .get();
  const assertAllowed = (key: string, now: number) => {
    const row = throttleRow(key);
    if (row?.blockedUntil && row.blockedUntil > now)
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Too many attempts. Please try again later.',
        { retryAfter: Math.ceil((row.blockedUntil - now) / 1000) },
      );
  };
  const increment = (
    key: string,
    limit: number,
    window: number,
    now: number,
  ) => {
    assertAllowed(key, now);
    const previous = throttleRow(key);
    const inWindow = previous && now - previous.windowStartedAt < window;
    const failureCount = inWindow ? previous.failureCount + 1 : 1;
    db.insert(authThrottle)
      .values({
        keyHash: digest(key),
        failureCount,
        windowStartedAt: inWindow ? previous.windowStartedAt : now,
        blockedUntil: failureCount >= limit ? now + window : null,
      })
      .onConflictDoUpdate({
        target: authThrottle.keyHash,
        set: {
          failureCount,
          windowStartedAt: inWindow ? previous.windowStartedAt : now,
          blockedUntil: failureCount >= limit ? now + window : null,
        },
      })
      .run();
  };
  return {
    findByEmail: (email: string) =>
      db.select().from(appUser).where(eq(appUser.emailCanonical, email)).get(),
    insertUser: (values: typeof appUser.$inferInsert) =>
      db.insert(appUser).values(values).run(),
    insertSession: (values: typeof session.$inferInsert) =>
      db.insert(session).values(values).run(),
    updateHash: (id: string, passwordHash: string, now: number) =>
      db
        .update(appUser)
        .set({ passwordHash, updatedAt: now })
        .where(eq(appUser.id, id))
        .run(),
    clearAccountFailures: (email: string) =>
      db
        .delete(authThrottle)
        .where(eq(authThrottle.keyHash, digest(`login:email:${email}`)))
        .run(),
    checkLogin: (email: string, now: number) => {
      assertAllowed(`login:email:${email}`, now);
      assertAllowed('login:ip:127.0.0.1', now);
    },
    failLogin: (email: string, now: number) =>
      store.native
        .transaction(() => {
          increment(`login:email:${email}`, 5, 900000, now);
          increment('login:ip:127.0.0.1', 10, 900000, now);
        })
        .immediate(),
    registrationAttempt: (now: number) =>
      store.native
        .transaction(() =>
          increment('register:installation:127.0.0.1', 10, 3600000, now),
        )
        .immediate(),
    findSession: (tokenHash: string) =>
      db
        .select({ session, user: appUser })
        .from(session)
        .innerJoin(appUser, eq(session.userId, appUser.id))
        .where(and(eq(session.tokenHash, tokenHash)))
        .get(),
    touchSession: (id: string, now: number) =>
      db
        .update(session)
        .set({ lastSeenAt: now })
        .where(eq(session.id, id))
        .run(),
    revokeSession: (tokenHash: string, now: number) =>
      db
        .update(session)
        .set({ revokedAt: now })
        .where(eq(session.tokenHash, tokenHash))
        .run(),
  };
}
