import { unitPath, type unitSchema } from './study-context';
import type { z } from 'zod';
export type ResumeState = {
  units: z.infer<typeof unitSchema>[];
  enrollment: {
    preparationAcknowledgedAt: number | null;
    resumeItemId: string | null;
    resumeAnchor: string | null;
  };
};
export function resolveContinue(state: ResumeState | null) {
  const base = '/course/software-engineer';
  const recommended = state?.units.find((unit) => !unit.complete) ?? null;
  const cursor = state?.units.find(
    (unit) => unit.id === state.enrollment.resumeItemId,
  );
  const active = cursor && !cursor.complete ? cursor : null;
  const fallback = !!state?.enrollment.resumeItemId && !cursor;
  const target =
    active ??
    (cursor
      ? state?.units.find(
          (unit) => unit.dayId === cursor.dayId && !unit.complete,
        )
      : null) ??
    recommended;
  const reason = !state
    ? 'unenrolled'
    : !state.enrollment.preparationAcknowledgedAt
      ? 'preparation'
      : !recommended
        ? 'completed'
        : active
          ? 'active'
          : 'recommended';
  const path =
    reason === 'unenrolled'
      ? base
      : reason === 'preparation'
        ? base + '/preparation'
        : reason === 'completed'
          ? base + '/progress'
          : unitPath(
              target!,
              active
                ? state!.enrollment.resumeAnchor
                : target!.kind === 'lesson'
                  ? 'study'
                  : 'tasks',
            );
  return {
    path,
    reason,
    target:
      reason === 'preparation' ||
      reason === 'unenrolled' ||
      reason === 'completed'
        ? null
        : target,
    recommended,
    active,
    fallback,
    outOfSequence: !!target && !!recommended && target.id !== recommended.id,
  };
}
