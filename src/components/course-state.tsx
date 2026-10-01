'use client';
import Link from 'next/link';
import { en } from '@/i18n/en';
import type { CourseIssue } from '@/server/content/availability';

export function CourseState({
  issue,
  retry,
}: {
  issue: CourseIssue;
  retry?: () => void;
}) {
  const message = en.routeState[issue];
  return (
    <div className="page-shell route-state">
      <h1>{message.title}</h1>
      <p role={issue === 'unavailable' ? 'alert' : undefined}>
        {message.description}
      </p>
      {issue !== 'missing' && <p>{en.routeState.preserve}</p>}
      <div className="actions section">
        {issue !== 'missing' && (
          <button
            className="button primary"
            onClick={retry ?? (() => window.location.reload())}
          >
            {en.retry}
          </button>
        )}
        <Link
          className="button"
          href="/course/software-engineer"
          prefetch={false}
        >
          {en.routeState.course}
        </Link>
        <Link className="button" href="/dashboard" prefetch={false}>
          {en.dashboard}
        </Link>
      </div>
    </div>
  );
}
