import { and, eq, desc } from 'drizzle-orm';
import type { Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
import { requireStudent } from '../auth/service.ts';
import { AppError } from '../errors.ts';
import { readExerciseSubmission } from './exercise-work';
export { unitPath } from '../../domain/study-context';
import { unitPath } from '../../domain/study-context';

export const coursePath = '/course/software-engineer';
export function ownedEnrollment(store: Store, token: string | undefined) {
  const student = requireStudent(store, token);
  return store.orm
    .select()
    .from(s.enrollment)
    .where(
      and(
        eq(s.enrollment.userId, student.id),
        eq(s.enrollment.courseId, 'software-engineer'),
      ),
    )
    .get();
}
export function latestRelease(store: Store) {
  return store.orm
    .select()
    .from(s.courseRelease)
    .where(
      and(
        eq(s.courseRelease.courseId, 'software-engineer'),
        eq(s.courseRelease.status, 'published'),
      ),
    )
    .orderBy(desc(s.courseRelease.publishedAt))
    .get();
}
export function snapshot(store: Store, token: string | undefined) {
  const enrollment = ownedEnrollment(store, token);
  if (!enrollment) return null;
  const db = store.orm;
  const items = db
    .select()
    .from(s.contentItem)
    .where(eq(s.contentItem.releaseId, enrollment.releaseId))
    .all();
  const byId = new Map(items.map((item) => [item.id, item]));
  const dayRows = db
    .select()
    .from(s.courseDay)
    .all()
    .filter((day) => byId.has(day.itemId));
  const dayFor = (id: string): string => {
    let item = byId.get(id);
    const visited = new Set<string>();
    while (item && item.kind !== 'day') {
      if (visited.has(item.id))
        throw new AppError(
          503,
          'INVALID_CONTENT',
          'Course structure is unavailable.',
        );
      visited.add(item.id);
      item = item.parentId ? byId.get(item.parentId) : undefined;
    }
    return item?.id ?? '';
  };
  const lessonProgress = db
    .select()
    .from(s.userProgress)
    .where(eq(s.userProgress.enrollmentId, enrollment.id))
    .all();
  const exerciseProgress = db
    .select()
    .from(s.exerciseProgress)
    .where(eq(s.exerciseProgress.enrollmentId, enrollment.id))
    .all();
  const done = new Set([
    ...lessonProgress
      .filter((p) => p.status === 'completed')
      .map((p) => p.lessonId),
    ...exerciseProgress
      .filter((p) => p.status === 'completed')
      .map((p) => p.exerciseId),
  ]);
  const units = items
    .filter(
      (item) =>
        item.required === 1 && ['lesson', 'exercise'].includes(item.kind),
    )
    .map((item) => {
      const dayId = dayFor(item.id);
      const day = dayRows.find((day) => day.itemId === dayId);
      if (!day)
        throw new AppError(
          503,
          'INVALID_CONTENT',
          'A required learning unit has no day.',
        );
      return {
        id: item.id,
        key: item.stableKey,
        kind: item.kind,
        dayId,
        dayKey: byId.get(dayId)!.stableKey,
        dayNumber: day.dayNumber,
        complete: done.has(item.id),
        order: item.orderIndex,
      };
    })
    .sort(
      (a, b) =>
        a.dayNumber - b.dayNumber ||
        (a.kind === b.kind ? a.order - b.order : a.kind === 'lesson' ? -1 : 1),
    );
  if (!units.length)
    throw new AppError(
      503,
      'INVALID_CONTENT',
      'The enrolled release has no required learning units.',
    );
  const completed = units.filter((unit) => unit.complete).length;
  const tasks = db
    .select()
    .from(s.taskProgress)
    .where(eq(s.taskProgress.enrollmentId, enrollment.id))
    .all();
  return {
    revision: enrollment.revision,
    enrollment: {
      releaseId: enrollment.releaseId,
      preparationAcknowledgedAt: enrollment.preparationAcknowledgedAt,
      resumeItemId: enrollment.resumeItemId,
      resumeAnchor: enrollment.resumeAnchor,
    },
    items: items.map(
      ({ id, stableKey, kind, title, parentId, bodyMarkdown, orderIndex }) => ({
        id,
        stableKey,
        kind,
        title,
        parentId,
        bodyMarkdown,
        orderIndex,
      }),
    ),
    days: dayRows,
    units,
    completed,
    total: units.length,
    percent: Math.floor((100 * completed) / units.length),
    lessonProgress,
    exerciseProgress: exerciseProgress.map((progress) => ({
      ...progress,
      ...(enrollment.releaseId === 'se-26w-v1'
        ? { submission: readExerciseSubmission(progress, tasks, items) }
        : {}),
    })),
    tasks,
    preparation: db
      .select()
      .from(s.preparationProgress)
      .where(eq(s.preparationProgress.enrollmentId, enrollment.id))
      .all(),
    lessons: db
      .select()
      .from(s.lesson)
      .all()
      .filter((lesson) => byId.has(lesson.itemId)),
    weeks: db
      .select()
      .from(s.courseWeek)
      .all()
      .filter((week) => byId.has(week.itemId)),
  };
}
export type LearningState = NonNullable<ReturnType<typeof snapshot>>;
export function continuePath(state: LearningState | null) {
  if (!state) return coursePath;
  if (!state.enrollment.preparationAcknowledgedAt)
    return `${coursePath}/preparation`;
  const earliest = state.units.find((unit) => !unit.complete);
  if (!earliest) return `${coursePath}/progress`;
  const active = state.units.find(
    (unit) => unit.id === state.enrollment.resumeItemId,
  );
  if (active && !active.complete)
    return unitPath(active, state.enrollment.resumeAnchor);
  const next = active
    ? (state.units.find(
        (unit) => unit.dayId === active.dayId && !unit.complete,
      ) ?? earliest)
    : earliest;
  return unitPath(next, next.kind === 'lesson' ? 'study' : 'tasks');
}
