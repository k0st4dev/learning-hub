import Link from 'next/link';
import type { LearningState } from '@/server/learning/read';
import { requiredProgress, unitStatus } from '@/domain/progress';
import {
  progressPresentation,
  progressItemPath,
  unitPath,
  unitLabel,
} from '@/domain/progress-presentation';
import { ProgressSummary, SavedTime } from './progress-summary';
import { progressText as t } from '@/i18n/progress';
import { scorecardReviewMilestones } from '@/domain/scorecard-review';
import { ScorecardReviewReminders } from './scorecard-review-reminders';
export function ScopedProgress({
  state,
  itemId,
}: {
  state: LearningState;
  itemId: string;
}) {
  const { scopes } = progressPresentation(state);
  const units = scopes.get(itemId) ?? [];
  const children = state.items
    .filter(
      (item) =>
        item.parentId === itemId &&
        ['week', 'day', 'lesson', 'exercise'].includes(item.kind),
    )
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const target = units.find((unit) => !unit.complete);
  return (
    <section className="section stack" aria-label="Your progress in this scope">
      <ProgressSummary
        progress={requiredProgress(units)}
        title={t.scope}
        timezone={state.timezone}
      />
      {target && <Link href={unitPath(target)}>{t.browse}</Link>}
      <ul className="progress-list">
        {children.map((item) => {
          const group = scopes.get(item.id) ?? [];
          const progress = requiredProgress(group);
          const unit = state.units.find((unit) => unit.id === item.id);
          return (
            <li key={item.id} className="card">
              <Link href={unit ? unitPath(unit) : progressItemPath(item)}>
                {unit ? (
                  unitLabel(state, unit)
                ) : (
                  <span lang="sr-Latn">{item.title}</span>
                )}
              </Link>
              <p>
                {unit
                  ? t.statuses[unitStatus(unit)]
                  : t.statuses[progress.status]}{' '}
                ·{' '}
                {progress.total
                  ? `${progress.completed}/${progress.total} required units · ${progress.percent}%`
                  : t.statuses.not_applicable}
              </p>
              {!unit && progress.needsReview > 0 && (
                <p>Checkpoint needs review</p>
              )}
              {progress.completedAt !== null && (
                <p>
                  Completed{' '}
                  <SavedTime
                    value={progress.completedAt}
                    timezone={state.timezone}
                  />
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <ScorecardReviewReminders
        milestones={scorecardReviewMilestones(state, scopes).filter(
          (milestone) =>
            units.some((unit) => unit.id === milestone.assessmentId),
        )}
      />
    </section>
  );
}
