'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { useExerciseSave } from './use-exercise-save';
import { exerciseText as t } from '@/i18n/exercise';
import { studyText } from '@/i18n/study';
import { en } from '@/i18n/en';
export function SaveFeedback({
  work,
  lesson = false,
}: {
  work: ReturnType<typeof useExerciseSave>;
  lesson?: boolean;
}) {
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (work.error) errorRef.current?.focus();
  }, [work.error]);
  return (
    <>
      <p role="status">
        {work.pending
          ? t.saving
          : work.dirty
            ? t.unsaved
            : work.message ||
              (work.confirmed.completed
                ? lesson
                  ? studyText.completed
                  : t.completed
                : t.initial)}
      </p>
      {work.error && (
        <div
          role="alert"
          tabIndex={-1}
          ref={errorRef}
          className="error-summary"
        >
          <p>{work.conflict ? t.conflict : work.error.message}</p>
          <p>{t.error}</p>
          <div className="actions">
            {work.retry && (
              <button
                className="button"
                disabled={work.pending}
                onClick={() => void work.retry?.()}
              >
                {t.retry}
              </button>
            )}
            {work.conflict &&
              (lesson ? (
                <button className="button" onClick={() => work.resolve(false)}>
                  {studyText.conflict}
                </button>
              ) : (
                <>
                  <button className="button" onClick={() => work.resolve(true)}>
                    {t.keep}
                  </button>
                  <button
                    className="button"
                    onClick={() => work.resolve(false)}
                  >
                    {t.useSaved}
                  </button>
                </>
              ))}
            {[401, 403].includes(work.error.status) && (
              <Link target="_blank" rel="noopener noreferrer" href="/login">
                {en.login} {en.curriculum.newTab}
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
