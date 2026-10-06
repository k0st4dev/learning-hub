'use client';
import Link from 'next/link';
import { useState } from 'react';
import { requiredProgress, unitStatus } from '@/domain/progress';
import { resolveContinue } from '@/domain/resume';
import {
  progressPresentation,
  progressItemPath,
  unitLocation,
  unitLabel,
  unitPath,
  type ProgressViewState,
} from '@/domain/progress-presentation';
import { progressText as t } from '@/i18n/progress';
import { ProgressSummary, SavedTime } from './progress-summary';
import { AssessmentReviewLinks } from './assessment-guidance';
const base = '/course/software-engineer';
export function ProgressOverview({
  state,
  view,
  activity,
}: {
  state: ProgressViewState;
  view: 'dashboard' | 'course' | 'progress';
  activity?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<keyof typeof t.filters>('incomplete');
  const model = progressPresentation(state);
  const resume = resolveContinue(state);
  const targetUnit = state.units.find((unit) => unit.id === resume.target?.id);
  const location = targetUnit ? unitLocation(state, targetUnit) : null;
  const lastSaved = Math.max(
    targetUnit?.updatedAt ?? 0,
    resume.reason === 'active' ? (state.enrollment.resumeUpdatedAt ?? 0) : 0,
  );
  const lastOpened = state.units.find(
    (unit) => unit.id === state.enrollment.lastOpenedItemId,
  );
  const days = state.days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => ({
      day,
      units: state.units.filter((unit) => unit.dayId === day.itemId),
    }))
    .filter(
      ({ units }) =>
        filter === 'all' ||
        (filter === 'completed'
          ? units.every((unit) => unit.complete)
          : filter === 'needs_review'
            ? units.some((unit) => unit.needsReview && !unit.complete)
            : units.some((unit) => !unit.complete)),
    );
  const checkpointDay = state.days.find(
    (day) => day.itemId === model.checkpoint?.dayId,
  );
  const preparations = state.items.filter(
    (item) => item.kind === 'preparation',
  );
  const needsPreparation =
    !state.enrollment.preparationAcknowledgedAt ||
    state.preparation.length < preparations.length;
  const finalDay = state.days
    .slice()
    .sort((a, b) => b.dayNumber - a.dayNumber)[0];
  const finalItem = state.items.find((item) => item.id === finalDay?.itemId);
  return (
    <div className="stack progress-overview">
      <section className="card stack" aria-labelledby="continue-card-title">
        <h2 id="continue-card-title">
          {resume.reason === 'completed' ? t.reviewCourse : t.continue}
        </h2>
        {resume.reason === 'preparation' ? (
          <p>Review or explicitly defer preparation before Day 1.</p>
        ) : resume.reason === 'completed' ? (
          <p>
            {t.complete}: {model.summary.completedDays}/
            {model.summary.totalDays}.
          </p>
        ) : (
          resume.target && (
            <>
              {location?.module && (
                <p lang="sr-Latn">{location.module.title}</p>
              )}
              <p>
                Week {location?.weekNumber} · {unitLabel(state, targetUnit!)}
              </p>
              <p>
                {resume.target.kind === 'lesson'
                  ? 'Finish the study lesson'
                  : 'Continue the exercise and confirm its original criterion'}
              </p>
              <p>
                {lastSaved ? (
                  <>
                    {t.saved}:{' '}
                    <SavedTime value={lastSaved} timezone={state.timezone} />
                  </>
                ) : (
                  t.noSavedWork
                )}
              </p>
            </>
          )
        )}
        {resume.fallback && <p>{t.fallback}</p>}
        {resume.target && resume.outOfSequence && <p>{t.outOfSequence}</p>}
        <Link className="button primary" href="/continue">
          {resume.reason === 'completed' ? t.reviewCourse : t.resume}
        </Link>
        {resume.target &&
          resume.recommended &&
          resume.target.id !== resume.recommended.id && (
            <Link href={unitPath(resume.recommended)}>
              {t.recommended}: Day {resume.recommended.dayNumber} ·{' '}
              {resume.recommended.kind === 'lesson' ? t.study : t.exercise}
            </Link>
          )}
      </section>
      <section aria-label={t.heading} className="progress-counts">
        <ProgressSummary
          progress={model.summary}
          title={t.course}
          timezone={state.timezone}
        />
        <section className="card">
          <h2>{t.days}</h2>
          <p>
            {model.summary.completedDays}/{model.summary.totalDays}
          </p>
          <p>
            {model.summary.totalDays - model.summary.completedDays} days
            remaining
          </p>
        </section>
        <section className="card">
          <h2>{t.lessons}</h2>
          <p>{model.summary.remainingLessons}</p>
        </section>
        <section className="card">
          <h2>{t.exercises}</h2>
          <p>{model.summary.remainingExercises}</p>
        </section>
      </section>
      {location && (
        <section className="card stack" aria-label={t.current}>
          <h2>{t.current}</h2>
          {location.module && (
            <>
              <Link href={progressItemPath(location.module)} lang="sr-Latn">
                {location.module.title}
              </Link>
              <ProgressSummary
                title="Current module progress"
                progress={requiredProgress(
                  model.scopes.get(location.module.id) ?? [],
                )}
                timezone={state.timezone}
              />
            </>
          )}
          {location.week && (
            <>
              <Link href={progressItemPath(location.week)}>
                Week {location.weekNumber} —{' '}
                <span lang="sr-Latn">{location.week.title}</span>
              </Link>
              <ProgressSummary
                title="Current week progress"
                progress={requiredProgress(
                  model.scopes.get(location.week.id) ?? [],
                )}
                timezone={state.timezone}
              />
            </>
          )}
          {location.day && (
            <Link href={progressItemPath(location.day)}>
              Day {resume.target?.dayNumber} —{' '}
              <span lang="sr-Latn">{location.day.title}</span>
            </Link>
          )}
        </section>
      )}
      {activity}
      {resume.reason === 'completed' && (
        <section className="notice stack">
          <h2>{t.completeHelp}</h2>
          {finalItem && (
            <Link href={progressItemPath(finalItem)}>{t.retrospective}</Link>
          )}
          <Link href={base + '/guide/appendix-g'}>{t.appendix}</Link>
        </section>
      )}
      <section
        className="card stack"
        aria-label="Study and reference locations"
      >
        <h2>Study and reference locations</h2>
        <p>
          {t.active}:{' '}
          {resume.active ? (
            <Link href={unitPath(resume.active, state.enrollment.resumeAnchor)}>
              {unitLabel(
                state,
                state.units.find((unit) => unit.id === resume.active!.id)!,
              )}
            </Link>
          ) : (
            'No incomplete active unit; Continue uses the recommended next work.'
          )}
        </p>
        <p>
          {t.lastOpened}:{' '}
          {lastOpened ? (
            <Link href={unitPath(lastOpened)}>
              {unitLabel(state, lastOpened)}
            </Link>
          ) : (
            t.noReference
          )}
        </p>
        {lastOpened && state.enrollment.lastOpenedAt && (
          <p>
            <SavedTime
              value={state.enrollment.lastOpenedAt}
              timezone={state.timezone}
            />
          </p>
        )}
      </section>
      {needsPreparation && (
        <section className="notice stack" aria-label={t.preparation}>
          <h2>{t.preparation}</h2>
          <p>
            {state.preparation.length}/{preparations.length} checks recorded.{' '}
            {t.preparationHelp}
          </p>
          <Link href={base + '/preparation'}>Review preparation</Link>
        </section>
      )}
      {model.checkpoint && checkpointDay && (
        <section className="notice stack" aria-label={t.checkpoint}>
          <h2>{t.checkpoint}</h2>
          <Link href={unitPath(model.checkpoint)}>
            {unitLabel(state, model.checkpoint)}
          </Link>
          <p>{t.statuses[unitStatus(model.checkpoint)]}</p>
          <h3>{t.originalCriterion}</h3>
          <p lang="sr-Latn" className="source">
            {checkpointDay.completionCriterionMarkdown}
          </p>
          {model.checkpoint.needsReview && (
            <AssessmentReviewLinks dayNumber={checkpointDay.dayNumber} />
          )}
        </section>
      )}
      {view !== 'dashboard' && (
        <section className="stack" aria-label={t.modules}>
          <h2>{t.modules}</h2>
          {model.modules.map((module) => (
            <article className="card stack" key={module.id}>
              <Link href={progressItemPath(module)} lang="sr-Latn">
                {module.title}
              </Link>
              <ProgressSummary
                title={`${module.title} — progress`}
                progress={requiredProgress(model.scopes.get(module.id) ?? [])}
                timezone={state.timezone}
              />
            </article>
          ))}
        </section>
      )}
      {view === 'progress' && (
        <section className="stack" aria-label={t.dayList}>
          <h2>{t.dayList}</h2>
          <div className="field">
            <label htmlFor="progress-day-filter">{t.filter}</label>
            <select
              id="progress-day-filter"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as keyof typeof t.filters)
              }
            >
              {Object.entries(t.filters).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p role="status">
            {days.length} {days.length === 1 ? 'day' : 'days'} shown
          </p>
          {!days.length && <p>{t.noMatches}</p>}
          <ul className="progress-list">
            {days.map(({ day, units }) => (
              <li className="card" key={day.itemId}>
                <Link
                  href={progressItemPath(
                    state.items.find((item) => item.id === day.itemId)!,
                  )}
                >
                  Day {day.dayNumber} —{' '}
                  <span lang="sr-Latn">
                    {state.items.find((item) => item.id === day.itemId)?.title}
                  </span>
                </Link>
                <p>
                  {requiredProgress(units).completed}/{units.length} required
                  units · {requiredProgress(units).percent}% ·{' '}
                  {t.statuses[requiredProgress(units).status]}
                </p>
                {units.map((unit) => (
                  <p key={unit.id}>
                    <Link href={unitPath(unit)}>
                      {unit.kind === 'lesson' ? t.study : t.exercise}
                    </Link>{' '}
                    — {t.statuses[unitStatus(unit)]}
                    {unit.complete && unit.completedAt && (
                      <>
                        {' '}
                        ·{' '}
                        <SavedTime
                          value={unit.completedAt}
                          timezone={state.timezone}
                        />
                      </>
                    )}
                  </p>
                ))}
              </li>
            ))}
          </ul>
          <Link href="/progress/scorecard">Monthly scorecard</Link>
        </section>
      )}
    </div>
  );
}
