'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useExerciseSave, type ConfirmedExercise } from './use-exercise-save';
import { SaveFeedback } from './save-feedback';
import { StudyControls } from './study-controls';
import { studyText as t } from '@/i18n/study';
import { exerciseText } from '@/i18n/exercise';
import { SavedTime } from './progress-summary';
export function StudyEditor({
  itemId,
  studentId,
  initial,
  dayOverview = false,
}: {
  itemId: string;
  studentId: string;
  initial: ConfirmedExercise;
  dayOverview?: boolean;
}) {
  const work = useExerciseSave(
    itemId,
    studentId,
    initial,
    initial.submission,
    'lesson',
    !dayOverview,
  );
  const [reopening, setReopening] = useState(false);
  return (
    <section className="section stack" aria-labelledby="study-progress-title">
      <h2 id="study-progress-title">{t.title}</h2>
      <p>{t.intro}</p>
      <StudyControls work={work} itemId={itemId} />
      <SaveFeedback work={work} lesson />
      {work.confirmed.completed ? (
        <div className="card stack">
          <p>{t.completed}</p>
          {work.confirmed.context?.lessonCompletedAt != null && (
            <p>
              Completed{' '}
              <SavedTime
                value={work.confirmed.context.lessonCompletedAt}
                timezone={work.confirmed.context.timezone}
              />
            </p>
          )}
          {work.confirmed.context && (
            <Link
              className="button primary"
              href={work.confirmed.context.exercisePath}
            >
              {t.continueExercise}
            </Link>
          )}
          {reopening ? (
            <>
              <p>{t.reopenHelp}</p>
              <div className="actions">
                <button
                  className="button"
                  disabled={work.locked}
                  onClick={() => {
                    void work.save(false, true);
                    setReopening(false);
                  }}
                >
                  {t.confirmReopen}
                </button>
                <button className="button" onClick={() => setReopening(false)}>
                  {exerciseText.cancel}
                </button>
              </div>
            </>
          ) : (
            <button
              className="button"
              disabled={work.locked}
              onClick={() => setReopening(true)}
            >
              {t.reopen}
            </button>
          )}
        </div>
      ) : (
        <button
          className="button primary"
          disabled={work.locked}
          onClick={() => void work.save(true)}
        >
          {t.complete}
        </button>
      )}
    </section>
  );
}
