import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DayWorkspace } from '@/server/content/day-workspace';
import { en } from '@/i18n/en';

export function DailyContext({
  workspace,
  currentId,
}: {
  workspace: DayWorkspace;
  currentId: string;
}) {
  const { day, week, dayItem, lesson, exercise } = workspace;
  return (
    <section className="card mb-8 daily-context" aria-label={en.daily.orient}>
      <p>
        <strong>
          {en.navigation.day} {day.dayNumber}
        </strong>{' '}
        · {en.daily.plan}: {day.estimatedMinutes} {en.daily.minutes}
      </p>
      <h2>{en.daily.why}</h2>
      <p lang="sr-Latn" className="source" data-week-objective>
        {week.objectiveMarkdown}
      </p>
      <nav className="actions" aria-label={en.daily.destinations}>
        {(
          [
            [dayItem, en.daily.overview],
            [lesson, en.learning.study],
            [exercise, en.learning.practice],
          ] as const
        ).map(([item, label]) => {
          return item.id === currentId ? (
            <span key={item.id} aria-current="page">
              {label}
            </span>
          ) : (
            <Link key={item.id} href={item.route}>
              {label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

export function DailyWorkspace({
  workspace,
  sourceHeader,
  sourceReview,
  resources,
}: {
  workspace: DayWorkspace;
  sourceHeader: ReactNode;
  sourceReview: ReactNode;
  resources: ReactNode;
}) {
  return (
    <div className="daily-workspace">
      <section className="mb-8" aria-label={en.daily.originalContext}>
        {sourceHeader}
      </section>
      <section className="section" aria-labelledby="daily-study">
        <h2 id="daily-study">{en.learning.study}</h2>
        <p lang="sr-Latn" className="source" data-daily-study>
          {workspace.lesson.bodyMarkdown}
        </p>
        <Link className="button primary" href={workspace.lesson.route}>
          {en.daily.openStudy}
        </Link>
        {resources}
      </section>
      <section className="section" aria-labelledby="daily-practice">
        <h2 id="daily-practice">{en.learning.practice}</h2>
        <p className="muted">{en.daily.localIde}</p>
        <ol className="daily-tasks">
          {workspace.tasks.map((task) => (
            <li key={task.id} lang="sr-Latn" data-daily-task={task.stableKey}>
              {task.bodyMarkdown}
            </li>
          ))}
        </ol>
        <Link href={workspace.exercise.route}>{en.daily.openExercise}</Link>
      </section>
      <section className="section" aria-labelledby="daily-review">
        <h2 id="daily-review">{en.daily.review}</h2>
        {sourceReview}
      </section>
    </div>
  );
}
