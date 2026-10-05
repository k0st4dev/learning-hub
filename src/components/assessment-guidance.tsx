import Link from 'next/link';
import type { ExerciseRequirements } from '@/domain/exercise-requirements';
import { exerciseText as t } from '@/i18n/exercise';

export function AssessmentGuidance({
  assessment,
  tasks,
  needsReview,
}: {
  assessment: NonNullable<ExerciseRequirements['assessment']>;
  tasks: { id: string; text: string }[];
  needsReview: boolean;
}) {
  const exam = assessment.kind === 'final_exam';
  return (
    <section className="card stack" aria-labelledby="assessment-guidance-title">
      <h3 id="assessment-guidance-title">
        {exam ? t.finalExam : t.checkpoint}
      </h3>
      <p>{t.assessmentHelp}</p>
      {needsReview && (
        <p role="status">
          <strong>{t.review}</strong> — {t.reviewHelp}
        </p>
      )}
      <h4>{t.originalCriterion}</h4>
      <p lang="sr-Latn" className="source">
        {assessment.criterion}
      </p>
      <h4>{t.originalAI}</h4>
      <p lang="sr-Latn" className="source">
        {assessment.aiPolicy}
      </p>
      {exam && (
        <>
          <h4>{t.originalTiming}</h4>
          <p lang="sr-Latn" className="source">
            {assessment.studyInstruction}
          </p>
          <ol>
            {tasks.slice(0, 3).map((task) => (
              <li key={task.id} lang="sr-Latn">
                {task.text}
              </li>
            ))}
          </ol>
          <p>{t.timingHelp}</p>
        </>
      )}
      {needsReview && (
        <>
          <h4>{t.reviewLinks}</h4>
          <p>{t.addedReviewHelp}</p>
          <AssessmentReviewLinks dayNumber={assessment.dayNumber} />
        </>
      )}
    </section>
  );
}
export function AssessmentReviewLinks({ dayNumber }: { dayNumber: number }) {
  const days = dayNumber === 7 ? [3, 4, 5] : null;
  const weeks = dayNumber === 28 ? [1, 2, 3, 4] : [Math.ceil(dayNumber / 7)];
  return (
    <ul className="curriculum-links">
      {(days ?? weeks).map((number) => (
        <li key={number}>
          <Link
            href={`/course/software-engineer/${days ? 'days/d' + String(number).padStart(3, '0') : 'weeks/w' + String(number).padStart(2, '0')}`}
          >
            {days ? 'Day' : 'Week'} {number}
          </Link>
        </li>
      ))}
    </ul>
  );
}
