import { progressScopes } from './progress';
import type { ProgressViewState } from './progress-presentation';

export type ScorecardReviewMilestone = {
  key: string;
  label: string;
  assessmentId: string;
};
const reviewWeeks = new Set([4, 8, 12, 16, 20, 24]);

/** Advisory opportunities from confirmed owned progress, never wall-clock deadlines. */
export function scorecardReviewMilestones(
  state: ProgressViewState,
  scopes = progressScopes(state.units, state.items),
): ScorecardReviewMilestone[] {
  const assessments = new Map(
    state.days.map((day) => [day.itemId, day.assessmentKind]),
  );
  const reviews: ScorecardReviewMilestone[] = [];
  for (const week of state.weeks
    .slice()
    .sort((a, b) => a.weekNumber - b.weekNumber)) {
    if (!reviewWeeks.has(week.weekNumber)) continue;
    const units = scopes.get(week.itemId) ?? [];
    const checkpoint = units.find(
      (unit) =>
        unit.kind === 'exercise' &&
        assessments.get(unit.dayId) === 'weekly_checkpoint',
    );
    if (!checkpoint || !units.every((unit) => unit.complete)) continue;
    reviews.push({
      key: 'week:' + week.weekNumber,
      label: 'Week ' + week.weekNumber,
      assessmentId: checkpoint.id,
    });
  }
  for (const unit of state.units) {
    if (
      unit.kind === 'exercise' &&
      unit.complete &&
      assessments.get(unit.dayId) === 'final_exam'
    )
      reviews.push({
        key: 'final:' + unit.id,
        label: 'Final exam',
        assessmentId: unit.id,
      });
  }
  return reviews;
}
