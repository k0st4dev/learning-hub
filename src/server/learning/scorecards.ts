import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  scorecardDefinitionSchema,
  scorecardEntries,
  scorecardPeriod,
  scorecardPeriodSchema,
  scorecardStateSchema,
  scorecardSubmissionSchema,
  type ScorecardState,
} from '../../domain/scorecards';
import type { Store } from '../db/connection';
import * as s from '../db/schema';
import { requireStudent } from '../auth/service';
import { digest } from '../auth/crypto';
import { AppError } from '../errors';
import { ownedEnrollment } from './read';

function context(store: Store, token: string | undefined) {
  const enrollment = ownedEnrollment(store, token);
  if (!enrollment)
    throw new AppError(
      404,
      'ENROLLMENT_REQUIRED',
      'Start the course before using the scorecard.',
    );
  const definition = store.orm
    .select({ metadata: s.contentItem.metadataJson })
    .from(s.contentItem)
    .innerJoin(s.courseRelease, eq(s.contentItem.releaseId, s.courseRelease.id))
    .where(
      and(
        eq(s.contentItem.releaseId, enrollment.releaseId),
        eq(s.contentItem.stableKey, 'scorecard-definition'),
        eq(s.courseRelease.status, 'published'),
      ),
    )
    .get();
  try {
    const metadata = z
      .object({ scorecard: scorecardDefinitionSchema })
      .parse(JSON.parse(definition?.metadata ?? 'null'));
    return { enrollment, definition: metadata.scorecard };
  } catch {
    throw new AppError(
      503,
      'SCORECARD_UNAVAILABLE',
      'The enrolled scorecard definition is unavailable. Preserve your data and retry.',
    );
  }
}
type Context = ReturnType<typeof context>;
function confirmed(
  store: Store,
  ctx: Context,
  periodKey: string,
): ScorecardState {
  const row = store.orm
    .select()
    .from(s.scorecard)
    .where(
      and(
        eq(s.scorecard.enrollmentId, ctx.enrollment.id),
        eq(s.scorecard.periodKey, periodKey),
      ),
    )
    .get();
  try {
    const ratings = scorecardSubmissionSchema.shape.ratings.parse(
      JSON.parse(row?.ratingsJson ?? '{}'),
    );
    const evidence = scorecardSubmissionSchema.shape.evidence.parse(
      JSON.parse(row?.evidenceJson ?? '{}'),
    );
    return scorecardStateSchema.parse({
      periodKey,
      ...ctx.definition,
      ratings: scorecardEntries(ctx.definition.dimensions, ratings),
      evidence: scorecardEntries(ctx.definition.dimensions, evidence),
      revision: row?.revision ?? 0,
      createdAt: row?.createdAt ?? null,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch {
    throw new AppError(
      503,
      'SCORECARD_UNAVAILABLE',
      'The saved scorecard is unavailable. Preserve your data and retry.',
    );
  }
}
function student(store: Store, token: string | undefined, expected?: unknown) {
  const owner = requireStudent(store, token);
  if (
    expected !== undefined &&
    scorecardSubmissionSchema.shape.expectedStudentId.parse(expected) !==
      owner.id
  )
    throw new AppError(
      403,
      'ACCOUNT_CHANGED',
      'The signed-in account changed. Return to the original account before using this draft.',
    );
  return owner;
}
export function readScorecard(
  store: Store,
  token: string | undefined,
  period?: unknown,
  expectedStudentId?: unknown,
  now = Date.now(),
) {
  const owner = student(store, token, expectedStudentId);
  let periodKey: string;
  if (period !== undefined) periodKey = scorecardPeriodSchema.parse(period);
  else {
    try {
      periodKey = scorecardPeriod(owner.timezone, now);
    } catch {
      throw new AppError(
        503,
        'TIMEZONE_UNAVAILABLE',
        'The profile timezone is unavailable. Review settings before selecting the current month.',
      );
    }
  }
  return store.native
    .transaction(() => confirmed(store, context(store, token), periodKey))
    .deferred();
}
export function saveScorecard(
  store: Store,
  token: string | undefined,
  input: unknown,
): ScorecardState {
  const owner = student(store, token);
  const data = scorecardSubmissionSchema.parse(input);
  if (owner.id !== data.expectedStudentId)
    throw new AppError(
      403,
      'ACCOUNT_CHANGED',
      'The signed-in account changed. Return to the original account before saving this draft.',
    );
  return store.native
    .transaction(() => {
      const ctx = context(store, token);
      let ratings: typeof data.ratings;
      let evidence: typeof data.evidence;
      try {
        ratings = scorecardEntries(ctx.definition.dimensions, data.ratings);
        evidence = scorecardEntries(ctx.definition.dimensions, data.evidence);
      } catch {
        throw new AppError(
          400,
          'INVALID_DIMENSION',
          'Use only the dimensions from your enrolled scorecard.',
        );
      }
      const requestHash = digest(
        JSON.stringify({ kind: 'scorecard', ...data, ratings, evidence }),
      );
      const receipt = store.orm
        .select()
        .from(s.mutationReceipt)
        .where(
          and(
            eq(s.mutationReceipt.enrollmentId, ctx.enrollment.id),
            eq(s.mutationReceipt.mutationId, data.mutationId),
          ),
        )
        .get();
      if (receipt) {
        if (receipt.requestHash !== requestHash)
          throw new AppError(
            409,
            'MUTATION_REUSED',
            'This save identifier was already used for a different change. Reload confirmed state.',
          );
        return scorecardStateSchema.parse(JSON.parse(receipt.responseJson));
      }
      const currentState = confirmed(store, ctx, data.periodKey);
      if (currentState.revision !== data.expectedRevision)
        throw new AppError(
          409,
          'REVISION_CONFLICT',
          'This scorecard changed in another tab. Keep your draft and review the confirmed version.',
          { revision: currentState.revision, currentState },
        );
      const now = Date.now();
      const result: ScorecardState = {
        ...currentState,
        ratings,
        evidence,
        revision: currentState.revision + 1,
        createdAt: currentState.createdAt ?? now,
        updatedAt: now,
      };
      store.orm
        .insert(s.scorecard)
        .values({
          id: randomUUID(),
          enrollmentId: ctx.enrollment.id,
          periodKey: data.periodKey,
          ratingsJson: JSON.stringify(ratings),
          evidenceJson: JSON.stringify(evidence),
          revision: result.revision,
          createdAt: result.createdAt!,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [s.scorecard.enrollmentId, s.scorecard.periodKey],
          set: {
            ratingsJson: JSON.stringify(ratings),
            evidenceJson: JSON.stringify(evidence),
            revision: result.revision,
            updatedAt: now,
          },
        })
        .run();
      store.orm
        .insert(s.mutationReceipt)
        .values({
          enrollmentId: ctx.enrollment.id,
          mutationId: data.mutationId,
          requestHash,
          responseJson: JSON.stringify(result),
          createdAt: now,
        })
        .run();
      return result;
    })
    .immediate();
}
