import { progressText as t } from '@/i18n/progress';
import type { ProgressRollup } from '@/domain/progress';
export function SavedTime({
  value,
  timezone = 'UTC',
}: {
  value: number;
  timezone?: string;
}) {
  return (
    <time dateTime={new Date(value).toISOString()}>
      {new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(value)}{' '}
      ({timezone})
    </time>
  );
}
export function ProgressSummary({
  progress,
  title = t.heading,
  timezone,
}: {
  progress: ProgressRollup;
  title?: string;
  timezone?: string;
}) {
  return (
    <section className="card stack" aria-label={title} data-progress-scope>
      <h2>{title}</h2>
      <p>
        {progress.total
          ? `${progress.completed}/${progress.total} required units · ${progress.percent}%`
          : t.statuses.not_applicable}
      </p>
      {progress.total > 0 && (
        <progress
          max={progress.total}
          value={progress.completed}
          aria-label={title}
        />
      )}
      <p>{t.statuses[progress.status]}</p>
      {progress.completedAt !== null && (
        <p>
          Completed{' '}
          <SavedTime value={progress.completedAt} timezone={timezone} />
        </p>
      )}
      {progress.needsReview > 0 && (
        <p>
          {progress.needsReview} checkpoint
          {progress.needsReview === 1 ? ' needs' : 's need'} review
        </p>
      )}
    </section>
  );
}
