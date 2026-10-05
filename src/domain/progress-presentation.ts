import type { LearningState } from '@/server/learning/read';
import { unitPath } from './study-context';
import { requiredProgress, progressScopes } from './progress';
export type ProgressViewState = Pick<
  LearningState,
  'units' | 'enrollment' | 'timezone'
> & {
  items: Pick<
    LearningState['items'][number],
    'id' | 'stableKey' | 'kind' | 'title' | 'parentId' | 'orderIndex'
  >[];
  days: Pick<
    LearningState['days'][number],
    'itemId' | 'dayNumber' | 'assessmentKind' | 'completionCriterionMarkdown'
  >[];
  weeks: Pick<LearningState['weeks'][number], 'itemId' | 'weekNumber'>[];
  preparation: Pick<
    LearningState['preparation'][number],
    'preparationItemId'
  >[];
};
export function progressItemPath(item: ProgressViewState['items'][number]) {
  const base = '/course/software-engineer';
  return `${base}/${item.kind === 'module' ? 'modules' : item.kind === 'week' ? 'weeks' : item.kind === 'day' ? 'days' : 'guide'}/${item.stableKey}`;
}
export function unitLabel(
  state: ProgressViewState,
  unit: LearningState['units'][number],
) {
  return `Day ${unit.dayNumber} · ${unit.kind === 'lesson' ? 'Study' : 'Exercise'} — ${state.items.find((item) => item.id === unit.dayId)?.title ?? unit.key}`;
}
export function unitLocation(
  state: ProgressViewState,
  unit: LearningState['units'][number],
) {
  const day = state.items.find((item) => item.id === unit.dayId);
  const week = state.items.find((item) => item.id === day?.parentId);
  const phase = state.items.find((item) => item.id === week?.parentId);
  return {
    day,
    week,
    module: phase,
    weekNumber: state.weeks.find((row) => row.itemId === week?.id)?.weekNumber,
  };
}
export function progressPresentation(state: ProgressViewState) {
  const scopes = progressScopes(state.units, state.items);
  const summary = requiredProgress(state.units);
  const modules = state.items
    .filter((item) => item.kind === 'module')
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const checkpoint = state.units
    .filter(
      (unit) =>
        unit.kind === 'exercise' &&
        unit.started &&
        !unit.complete &&
        state.days.find((day) => day.itemId === unit.dayId)?.assessmentKind !==
          'practice',
    )
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  return { scopes, summary, modules, checkpoint };
}
export { unitPath };
