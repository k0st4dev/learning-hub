import {
  progressItemPath,
  type ProgressViewState,
} from './progress-presentation';
import { unitPath } from './study-context';
export const activityTypes = [
  'lesson_completed',
  'lesson_reopened',
  'exercise_completed',
  'exercise_reopened',
  'checkpoint_needs_review',
  'day_completed',
  'day_reopened',
  'course_completed',
  'course_reopened',
  'release_migrated',
] as const;
export type ActivityType = (typeof activityTypes)[number];
export function activityLocation(state: ProgressViewState, key: string | null) {
  const item = state.items.find(
    (item) => item.stableKey === (key ?? 'overview'),
  );
  const unit = state.units.find((unit) => unit.id === item?.id);
  const day = state.days.find(
    (day) => day.itemId === (unit?.dayId ?? item?.id),
  );
  return {
    title: item?.title ?? null,
    dayNumber: day?.dayNumber ?? null,
    path: !item
      ? null
      : unit
        ? unitPath(unit)
        : item.kind === 'day'
          ? progressItemPath(item)
          : item.stableKey === 'overview'
            ? '/course/software-engineer'
            : null,
  };
}
