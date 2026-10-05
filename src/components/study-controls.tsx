'use client';
import Link from 'next/link';
import type { useExerciseSave } from './use-exercise-save';
import { studyText as t } from '@/i18n/study';
import { en } from '@/i18n/en';
export function StudyControls({
  work,
  itemId,
}: {
  work: ReturnType<typeof useExerciseSave>;
  itemId: string;
}) {
  const context = work.confirmed.context;
  if (!context) return null;
  const savedAnchor =
    context.activeItemId === itemId &&
    context.anchors.includes(context.resumeAnchor ?? '')
      ? context.resumeAnchor
      : null;
  const anchorLabels: Record<string, string> = {
    study: en.learning.study,
    tasks: en.learning.practice,
    ai: en.learning.ai,
    criterion: en.learning.criterion,
    evidence: 'Evidence',
  };
  return (
    <section className="card stack" aria-label={t.context}>
      <p>{context.activeItemId === itemId ? t.active : t.reference}</p>
      {savedAnchor && (
        <p>
          Saved section:{' '}
          <Link
            href={`${itemId === context.lessonId ? context.lessonPath : context.exercisePath}#${savedAnchor}`}
          >
            {anchorLabels[savedAnchor] ??
              `Task ${Number(savedAnchor.split('-').at(-1))}`}
          </Link>
        </p>
      )}
      <p>
        {context.completed}/{context.total} required units in this day ·{' '}
        {context.percent}%
      </p>
      {context.completed === context.total && <p>{t.dayComplete}</p>}
      {context.outOfSequence && (
        <>
          <p>{t.later}</p>
          <Link href={context.recommendedPath}>{t.recommended}</Link>
        </>
      )}
      <div className="actions">
        <button
          className="button primary"
          disabled={work.locked || !context.studyTargetId}
          onClick={() => void work.saveCursor('study')}
        >
          {t.studyDay}
        </button>
        <button
          className="button"
          disabled={work.locked}
          onClick={() => void work.saveCursor('open')}
        >
          {t.openReference}
        </button>
      </div>
    </section>
  );
}
