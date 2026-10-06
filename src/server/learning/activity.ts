import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Store } from '../db/connection';
import { activityEvent } from '../db/schema';
import { ownedEnrollment } from './read';
import { AppError } from '../errors';
import { activityTypes } from '../../domain/activity';

const querySchema = z.strictObject({
  limit: z.number().int().min(1).max(20),
  before: z.uuid().optional(),
});
const eventSchema = z.object({
  id: z.uuid(),
  type: z.enum(activityTypes),
  itemStableKey: z.string().nullable(),
  occurredAt: z.number().int().nonnegative(),
});
/** Owned, read-only history; kept out of mutation snapshots and historical receipts. */
export function readActivity(
  store: Store,
  token: string | undefined,
  input: unknown,
) {
  const enrollment = ownedEnrollment(store, token);
  if (!enrollment)
    throw new AppError(
      404,
      'ENROLLMENT_REQUIRED',
      'Start the course before viewing its history.',
    );
  const parsed = querySchema.safeParse(input);
  const unavailable = () =>
    new AppError(
      400,
      'HISTORY_PAGE_UNAVAILABLE',
      'This history page is unavailable. View the newest activity.',
    );
  if (!parsed.success) throw unavailable();
  const { limit, before } = parsed.data;
  // SQLite insertion order breaks equal timestamp ties, including events in one transaction.
  const position = sql<number>`${activityEvent}.rowid`;
  const owner = eq(activityEvent.enrollmentId, enrollment.id);
  const cursor = before
    ? store.orm
        .select({ occurredAt: activityEvent.occurredAt, position })
        .from(activityEvent)
        .where(and(owner, eq(activityEvent.id, before)))
        .get()
    : undefined;
  if (before && !cursor) throw unavailable();
  const rows = store.orm
    .select({
      id: activityEvent.id,
      type: activityEvent.type,
      itemStableKey: activityEvent.itemStableKey,
      occurredAt: activityEvent.occurredAt,
    })
    .from(activityEvent)
    .where(
      cursor
        ? and(
            owner,
            or(
              lt(activityEvent.occurredAt, cursor.occurredAt),
              and(
                eq(activityEvent.occurredAt, cursor.occurredAt),
                sql`${position} < ${cursor.position}`,
              ),
            ),
          )
        : owner,
    )
    .orderBy(desc(activityEvent.occurredAt), desc(position))
    .limit(limit + 1)
    .all();
  const events = rows.slice(0, limit).map((row) => {
    const parsed = eventSchema.safeParse(row);
    if (!parsed.success)
      throw new AppError(
        503,
        'HISTORY_UNAVAILABLE',
        'Your saved activity is unavailable. Please retry.',
      );
    return parsed.data;
  });
  return { events, next: rows.length > limit ? events.at(-1)!.id : null };
}
export type ActivityPage = ReturnType<typeof readActivity>;
