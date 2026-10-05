export type ProgressUnit = {
  id: string;
  kind: string;
  dayId: string;
  complete: boolean;
  started?: boolean;
  needsReview?: boolean;
  completedAt?: number | null;
};
export function requiredProgress(units: readonly ProgressUnit[]) {
  const completed = units.filter((unit) => unit.complete).length;
  const total = units.length;
  const days = new Map<string, ProgressUnit[]>();
  for (const unit of units)
    days.set(unit.dayId, [...(days.get(unit.dayId) ?? []), unit]);
  const complete = total > 0 && completed === total;
  const status: 'not_applicable' | 'completed' | 'started' | 'not_started' =
    !total
      ? 'not_applicable'
      : complete
        ? 'completed'
        : units.some(
              (unit) => unit.complete || unit.started || unit.needsReview,
            )
          ? 'started'
          : 'not_started';
  return {
    completed,
    total,
    percent: total ? Math.floor((100 * completed) / total) : null,
    status,
    completedAt:
      complete && units.every((unit) => unit.completedAt != null)
        ? Math.max(...units.map((unit) => unit.completedAt!))
        : null,
    completedDays: [...days.values()].filter((day) =>
      day.every((unit) => unit.complete),
    ).length,
    totalDays: days.size,
    remainingLessons: units.filter(
      (unit) => unit.kind === 'lesson' && !unit.complete,
    ).length,
    remainingExercises: units.filter(
      (unit) => unit.kind === 'exercise' && !unit.complete,
    ).length,
    needsReview: units.filter((unit) => !unit.complete && unit.needsReview)
      .length,
  };
}
export type ProgressRollup = ReturnType<typeof requiredProgress>;
export function unitStatus(unit: ProgressUnit) {
  return unit.complete
    ? 'completed'
    : unit.needsReview
      ? 'needs_review'
      : unit.started
        ? 'started'
        : 'not_started';
}
export function progressScopes<T extends ProgressUnit>(
  units: readonly T[],
  items: readonly { id: string; parentId: string | null }[],
) {
  const parents = new Map(items.map((item) => [item.id, item.parentId]));
  const scopes = new Map<string, T[]>();
  for (const unit of units) {
    let id: string | null = unit.id;
    const seen = new Set<string>();
    while (id) {
      if (seen.has(id)) throw new Error('Invalid progress hierarchy');
      seen.add(id);
      scopes.set(id, [...(scopes.get(id) ?? []), unit]);
      id = parents.get(id) ?? null;
    }
  }
  return scopes;
}
