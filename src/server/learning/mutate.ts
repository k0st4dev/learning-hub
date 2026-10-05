import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
import { requireStudent } from '../auth/service.ts';
import { digest } from '../auth/crypto.ts';
import { AppError } from '../errors.ts';
import { latestRelease, ownedEnrollment, snapshot } from './read.ts';
import { exerciseSubmissionSchema } from '../../domain/exercise-requirements';
import { saveExerciseWork } from './exercise-work';

const base = {
  mutationId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
};
const itemId = z.string().min(1).max(160);
const legacyMutationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...base,
      kind: z.literal('orientation'),
      acknowledged: z.literal(true),
      deferred: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal('preparation'),
      itemId,
      completed: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal('lesson'),
      itemId,
      completed: z.boolean(),
    })
    .strict(),
  z
    .object({ ...base, kind: z.literal('task'), itemId, done: z.boolean() })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal('exercise'),
      itemId,
      completed: z.boolean(),
      evidence: z.string().max(2000),
      attested: z.boolean(),
      result: z.enum(['passed', 'needs_review']),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal('cursor'),
      itemId,
      mode: z.enum(['open', 'study']),
      anchor: z.string().max(160),
    })
    .strict(),
]);
export const mutationSchema = z.union([
  legacyMutationSchema,
  z.strictObject({
    ...base,
    kind: z.literal('exercise'),
    itemId,
    completed: z.boolean(),
    submission: exerciseSubmissionSchema,
    expectedStudentId: z.string().min(1).max(160).optional(),
  }),
]);
export type LearningMutation = z.infer<typeof mutationSchema>;
export function startCourse(store: Store, token: string | undefined) {
  const student = requireStudent(store, token);
  return store.native
    .transaction(() => {
      const existing = ownedEnrollment(store, token);
      if (!existing) {
        const release = latestRelease(store);
        if (!release)
          throw new AppError(
            503,
            'COURSE_UNAVAILABLE',
            'No published curriculum is installed. Run the documented setup.',
          );
        store.orm
          .insert(s.enrollment)
          .values({
            id: randomUUID(),
            userId: student.id,
            courseId: release.courseId,
            releaseId: release.id,
            startedAt: Date.now(),
          })
          .run();
      }
      return snapshot(store, token)!;
    })
    .immediate();
}
export function mutateLearning(
  store: Store,
  token: string | undefined,
  input: unknown,
) {
  const student = requireStudent(store, token);
  const data = mutationSchema.parse(input);
  if (
    'expectedStudentId' in data &&
    data.expectedStudentId &&
    data.expectedStudentId !== student.id
  )
    throw new AppError(
      403,
      'ACCOUNT_CHANGED',
      'The signed-in account changed. Return to the original account before saving this draft.',
    );
  return store.native
    .transaction(() => {
      const enrollment = ownedEnrollment(store, token);
      if (!enrollment)
        throw new AppError(
          404,
          'ENROLLMENT_REQUIRED',
          'Start the course before saving progress.',
        );
      const db = store.orm;
      const now = Date.now();
      const whereEnrollment = eq(s.enrollment.id, enrollment.id);
      const hash = digest(JSON.stringify(data));
      const receipt = db
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
        if (receipt.requestHash !== hash)
          throw new AppError(
            409,
            'MUTATION_REUSED',
            'This save identifier was already used for a different change. Reload confirmed state.',
          );
        return JSON.parse(receipt.responseJson) as NonNullable<
          ReturnType<typeof snapshot>
        >;
      }
      const before = snapshot(store, token)!;
      if (enrollment.revision !== data.expectedRevision)
        throw new AppError(
          409,
          'REVISION_CONFLICT',
          'Progress changed in another tab. Reload confirmed state before saving again.',
          { revision: enrollment.revision, currentState: before },
        );
      const item =
        'itemId' in data
          ? db
              .select()
              .from(s.contentItem)
              .where(
                and(
                  eq(s.contentItem.id, data.itemId),
                  eq(s.contentItem.releaseId, enrollment.releaseId),
                ),
              )
              .get()
          : undefined;
      if (
        'itemId' in data &&
        (!item || (data.kind !== 'cursor' && item.kind !== data.kind))
      )
        throw new AppError(
          404,
          'ITEM_NOT_FOUND',
          'This item is not available in your enrolled release.',
        );
      const event = (type: string, stableKey?: string) =>
        db
          .insert(s.activityEvent)
          .values({
            id: randomUUID(),
            enrollmentId: enrollment.id,
            itemStableKey: stableKey,
            type,
            occurredAt: now,
          })
          .run();
      const epWhere = (id: string) =>
        and(
          eq(s.exerciseProgress.enrollmentId, enrollment.id),
          eq(s.exerciseProgress.exerciseId, id),
        );
      const reopenExercise = (id: string) => {
        const previous = db
          .select()
          .from(s.exerciseProgress)
          .where(epWhere(id))
          .get();
        if (previous?.status === 'completed') {
          db.update(s.exerciseProgress)
            .set({
              status: 'started',
              completedAt: null,
              criterionAttestedAt: null,
              updatedAt: now,
            })
            .where(epWhere(id))
            .run();
          event(
            'exercise_reopened',
            before.items.find((item) => item.id === id)?.stableKey,
          );
        }
      };
      if (data.kind === 'orientation') {
        if (
          !data.deferred &&
          before.items
            .filter((item) => item.kind === 'preparation')
            .some(
              (item) =>
                !before.preparation.some(
                  (p) => p.preparationItemId === item.id,
                ),
            )
        )
          throw new AppError(
            422,
            'PREPARATION_PENDING',
            'Complete the preparation checks or explicitly defer them.',
          );
        db.update(s.enrollment)
          .set({
            preparationAcknowledgedAt:
              enrollment.preparationAcknowledgedAt ?? now,
          })
          .where(whereEnrollment)
          .run();
      } else if (data.kind === 'preparation') {
        if (data.completed)
          db.insert(s.preparationProgress)
            .values({
              enrollmentId: enrollment.id,
              releaseId: enrollment.releaseId,
              preparationItemId: item!.id,
              completedAt: now,
            })
            .onConflictDoNothing()
            .run();
        else
          db.delete(s.preparationProgress)
            .where(
              and(
                eq(s.preparationProgress.enrollmentId, enrollment.id),
                eq(s.preparationProgress.preparationItemId, item!.id),
              ),
            )
            .run();
      } else if (data.kind === 'lesson') {
        const where = and(
          eq(s.userProgress.enrollmentId, enrollment.id),
          eq(s.userProgress.lessonId, item!.id),
        );
        const previous = db.select().from(s.userProgress).where(where).get();
        const wasComplete = previous?.status === 'completed';
        db.insert(s.userProgress)
          .values({
            enrollmentId: enrollment.id,
            releaseId: enrollment.releaseId,
            lessonId: item!.id,
            status: data.completed ? 'completed' : 'started',
            startedAt: now,
            completedAt: data.completed ? now : null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [s.userProgress.enrollmentId, s.userProgress.lessonId],
            set: {
              status: data.completed ? 'completed' : 'started',
              completedAt: data.completed
                ? (previous?.completedAt ?? now)
                : null,
              updatedAt: now,
            },
          })
          .run();
        if (data.completed !== wasComplete)
          event(
            data.completed ? 'lesson_completed' : 'lesson_reopened',
            item!.stableKey,
          );
      } else if (data.kind === 'task') {
        if (enrollment.releaseId !== 'development-day1-v1')
          throw new AppError(
            422,
            'EXERCISE_WORK_REQUIRED',
            'Save task decisions together with the full exercise submission.',
          );
        const rule = db
          .select()
          .from(s.exerciseTask)
          .where(eq(s.exerciseTask.itemId, item!.id))
          .get();
        if (rule?.requirementMode !== 'required')
          throw new AppError(
            422,
            'UNSUPPORTED_RULE',
            'This milestone supports Day 1 required tasks only.',
          );
        if (data.done)
          db.insert(s.taskProgress)
            .values({
              enrollmentId: enrollment.id,
              releaseId: enrollment.releaseId,
              taskId: item!.id,
              status: 'done',
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [s.taskProgress.enrollmentId, s.taskProgress.taskId],
              set: { status: 'done', updatedAt: now },
            })
            .run();
        else {
          db.delete(s.taskProgress)
            .where(
              and(
                eq(s.taskProgress.enrollmentId, enrollment.id),
                eq(s.taskProgress.taskId, item!.id),
              ),
            )
            .run();
          reopenExercise(item!.parentId!);
        }
      } else if (data.kind === 'exercise' && 'submission' in data) {
        const wasComplete = saveExerciseWork(
          store,
          enrollment,
          item!.id,
          data.completed,
          data.submission,
          now,
        );
        if (data.completed !== wasComplete)
          event(
            data.completed ? 'exercise_completed' : 'exercise_reopened',
            item!.stableKey,
          );
      } else if (data.kind === 'exercise') {
        if (enrollment.releaseId !== 'development-day1-v1')
          throw new AppError(
            422,
            'EXERCISE_WORK_REQUIRED',
            'This course requires the full exercise submission.',
          );
        const previous = db
          .select()
          .from(s.exerciseProgress)
          .where(epWhere(item!.id))
          .get();
        if (data.completed) {
          const tasks = before.items.filter(
            (task) => task.kind === 'task' && task.parentId === item!.id,
          );
          if (
            !tasks.length ||
            tasks.some(
              (task) =>
                !before.tasks.some(
                  (p) => p.taskId === task.id && p.status === 'done',
                ),
            ) ||
            !data.evidence.trim() ||
            !data.attested ||
            data.result !== 'passed'
          )
            throw new AppError(
              422,
              'COMPLETION_REQUIREMENTS',
              'Complete every required task, save evidence, and confirm that your work passes the original criterion.',
            );
        }
        const wasComplete = previous?.status === 'completed';
        const update = {
          status: data.completed ? 'completed' : 'started',
          evidenceText: data.evidence,
          result: data.result,
          criterionAttestedAt: data.completed
            ? (previous?.criterionAttestedAt ?? now)
            : null,
          completedAt: data.completed ? (previous?.completedAt ?? now) : null,
          updatedAt: now,
        };
        db.insert(s.exerciseProgress)
          .values({
            ...update,
            enrollmentId: enrollment.id,
            releaseId: enrollment.releaseId,
            exerciseId: item!.id,
            startedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              s.exerciseProgress.enrollmentId,
              s.exerciseProgress.exerciseId,
            ],
            set: update,
          })
          .run();
        if (data.completed !== wasComplete)
          event(
            data.completed ? 'exercise_completed' : 'exercise_reopened',
            item!.stableKey,
          );
      } else if (data.kind === 'cursor') {
        if (!['lesson', 'exercise'].includes(item!.kind))
          throw new AppError(
            400,
            'INVALID_CURSOR',
            'Choose a study lesson or exercise.',
          );
        const anchors = [
          'study',
          'tasks',
          'evidence',
          'criterion',
          'ai',
          ...before.items
            .filter(
              (task) => task.kind === 'task' && task.parentId === item!.id,
            )
            .map((task) => task.stableKey),
        ];
        if (!anchors.includes(data.anchor))
          throw new AppError(
            400,
            'INVALID_ANCHOR',
            'This section is not available.',
          );
        db.update(s.enrollment)
          .set({
            lastOpenedItemId: item!.id,
            lastOpenedAt: now,
            ...(data.mode === 'study'
              ? {
                  resumeItemId: item!.id,
                  resumeAnchor: data.anchor,
                  resumeUpdatedAt: now,
                }
              : {}),
          })
          .where(whereEnrollment)
          .run();
      }
      if (item && ['lesson', 'exercise', 'task'].includes(data.kind)) {
        const resumeItemId = data.kind === 'task' ? item.parentId! : item.id;
        db.update(s.enrollment)
          .set({
            resumeItemId,
            resumeAnchor:
              data.kind === 'task'
                ? item.stableKey
                : data.kind === 'lesson'
                  ? 'study'
                  : 'evidence',
            resumeUpdatedAt: now,
          })
          .where(whereEnrollment)
          .run();
      }
      db.update(s.enrollment)
        .set({ revision: enrollment.revision + 1 })
        .where(whereEnrollment)
        .run();
      const after = snapshot(store, token)!;
      for (const day of after.days) {
        const completedBefore = before.units
          .filter((unit) => unit.dayId === day.itemId)
          .every((unit) => unit.complete);
        const completedAfter = after.units
          .filter((unit) => unit.dayId === day.itemId)
          .every((unit) => unit.complete);
        if (completedBefore !== completedAfter)
          event(
            completedAfter ? 'day_completed' : 'day_reopened',
            after.items.find((item) => item.id === day.itemId)?.stableKey,
          );
      }
      if (
        (before.completed === before.total) !==
        (after.completed === after.total)
      )
        event(
          after.completed === after.total
            ? 'course_completed'
            : 'course_reopened',
        );
      db.insert(s.mutationReceipt)
        .values({
          enrollmentId: enrollment.id,
          mutationId: data.mutationId,
          requestHash: hash,
          responseJson: JSON.stringify(after),
          createdAt: now,
        })
        .run();
      return after;
    })
    .immediate();
}
