import Link from 'next/link';
import type { ActivityPage } from '@/server/learning/activity';
import type { ProgressViewState } from '@/domain/progress-presentation';
import { activityLocation } from '@/domain/activity';
import { activityText as t } from '@/i18n/activity';
import { SavedTime } from './progress-summary';
const historyPath = '/course/software-engineer/progress';
export function ActivityHistory({
  state,
  page,
  recent = false,
  olderPage = false,
}: {
  state: ProgressViewState;
  page: ActivityPage | null;
  recent?: boolean;
  olderPage?: boolean;
}) {
  return (
    <section
      id="activity-history"
      className="card stack section"
      aria-labelledby="activity-history-title"
    >
      <h2 id="activity-history-title">{recent ? t.recent : t.history}</h2>
      <p>{t.help}</p>
      {!page ? (
        <p role="alert">{t.unavailable}</p>
      ) : page.events.length === 0 ? (
        <p>{olderPage ? t.emptyPage : t.empty}</p>
      ) : (
        <ol className="stack activity-list">
          {page.events.map((event) => {
            const location = activityLocation(state, event.itemStableKey);
            const title = (
              <>
                {location.dayNumber != null && <>Day {location.dayNumber} — </>}
                {location.title ? (
                  <span lang="sr-Latn">{location.title}</span>
                ) : event.itemStableKey ? (
                  t.archived
                ) : (
                  t.course
                )}
              </>
            );
            return (
              <li
                key={event.id}
                data-activity-id={event.id}
                data-activity-type={event.type}
              >
                <p>
                  <strong>{t.events[event.type]}</strong>
                </p>
                <p>
                  {location.path ? (
                    <Link href={location.path}>{title}</Link>
                  ) : (
                    title
                  )}
                </p>
                <SavedTime value={event.occurredAt} timezone={state.timezone} />
              </li>
            );
          })}
        </ol>
      )}
      {(recent || olderPage || !page || page.next) && (
        <nav className="actions" aria-label={recent ? t.recent : t.history}>
          {recent ? (
            <Link href={historyPath + '#activity-history'}>{t.full}</Link>
          ) : (
            <>
              {(olderPage || !page) && (
                <Link href={historyPath + '#activity-history'}>{t.newest}</Link>
              )}
              {page?.next && (
                <Link
                  href={`${historyPath}?activity=${encodeURIComponent(page.next)}#activity-history`}
                >
                  {t.older}
                </Link>
              )}
            </>
          )}
        </nav>
      )}
    </section>
  );
}
