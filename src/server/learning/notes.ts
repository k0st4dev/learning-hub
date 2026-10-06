import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  noteItemIdSchema,
  noteSubmissionSchema,
  type NoteState,
} from '../../domain/notes';
import type { Store } from '../db/connection';
import * as s from '../db/schema';
import { digest } from '../auth/crypto';
import { requireStudent } from '../auth/service';
import { AppError } from '../errors';
import { ownedEnrollment } from './read';

function noteContext(store: Store, token: string | undefined, itemId: string) {
  const enrollment = ownedEnrollment(store, token);
  if (!enrollment)
    throw new AppError(
      404,
      'ENROLLMENT_REQUIRED',
      'Start the course before using notes.',
    );
  const item = store.orm
    .select({ id: s.contentItem.id })
    .from(s.contentItem)
    .where(
      and(
        eq(s.contentItem.id, itemId),
        eq(s.contentItem.releaseId, enrollment.releaseId),
      ),
    )
    .get();
  if (!item)
    throw new AppError(
      404,
      'ITEM_NOT_FOUND',
      'This item is not available in your enrolled release.',
    );
  return enrollment;
}

function confirmedNote(
  store: Store,
  enrollmentId: string,
  itemId: string,
): NoteState {
  const row = store.orm
    .select()
    .from(s.note)
    .where(
      and(
        eq(s.note.enrollmentId, enrollmentId),
        eq(s.note.contentItemId, itemId),
      ),
    )
    .get();
  return {
    itemId,
    body: row?.bodyText ?? '',
    revision: row?.revision ?? 0,
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

export function readNote(
  store: Store,
  token: string | undefined,
  input: unknown,
  expectedStudentId?: unknown,
): NoteState {
  const student = requireStudent(store, token);
  if (
    expectedStudentId !== undefined &&
    noteSubmissionSchema.shape.expectedStudentId.parse(expectedStudentId) !==
      student.id
  )
    throw new AppError(
      403,
      'ACCOUNT_CHANGED',
      'The signed-in account changed. Return to the original account before reading this draft’s saved note.',
    );
  const itemId = noteItemIdSchema.parse(input);
  return store.native
    .transaction(() => {
      const enrollment = noteContext(store, token, itemId);
      return confirmedNote(store, enrollment.id, itemId);
    })
    .deferred();
}

export function saveNote(
  store: Store,
  token: string | undefined,
  input: unknown,
): NoteState {
  const student = requireStudent(store, token);
  const data = noteSubmissionSchema.parse(input);
  if (data.expectedStudentId !== student.id)
    throw new AppError(
      403,
      'ACCOUNT_CHANGED',
      'The signed-in account changed. Return to the original account before saving this draft.',
    );
  return store.native
    .transaction(() => {
      const enrollment = noteContext(store, token, data.itemId);
      // Receipts share the enrollment namespace with progress. The domain discriminator
      // prevents a note request from ever replaying a progress response (or vice versa).
      const requestHash = digest(JSON.stringify({ kind: 'note', ...data }));
      const receipt = store.orm
        .select()
        .from(s.mutationReceipt)
        .where(
          and(
            eq(s.mutationReceipt.enrollmentId, enrollment.id),
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
        return JSON.parse(receipt.responseJson) as NoteState;
      }
      const currentState = confirmedNote(store, enrollment.id, data.itemId);
      if (currentState.revision !== data.expectedRevision)
        throw new AppError(
          409,
          'REVISION_CONFLICT',
          'This note changed in another tab. Keep your draft and review the confirmed note before saving again.',
          { revision: currentState.revision, currentState },
        );
      const now = Date.now();
      const result: NoteState = {
        itemId: data.itemId,
        body: data.body,
        revision: currentState.revision + 1,
        createdAt: currentState.createdAt ?? now,
        updatedAt: now,
      };
      store.orm
        .insert(s.note)
        .values({
          id: randomUUID(),
          enrollmentId: enrollment.id,
          releaseId: enrollment.releaseId,
          contentItemId: data.itemId,
          bodyText: result.body,
          revision: result.revision,
          createdAt: result.createdAt!,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [s.note.enrollmentId, s.note.contentItemId],
          set: {
            bodyText: result.body,
            revision: result.revision,
            updatedAt: now,
          },
        })
        .run();
      store.orm
        .insert(s.mutationReceipt)
        .values({
          enrollmentId: enrollment.id,
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
