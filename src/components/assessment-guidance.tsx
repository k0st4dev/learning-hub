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
  const week = Math.ceil(assessment.dayNumber / 7);
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
          <ul>
            {assessment.dayNumber === 7 ? (
              [3, 4, 5].map((day) => (
                <li key={day}>
                  <Link
                    href={`/course/software-engineer/days/d${String(day).padStart(3, '0')}`}
                  >
                    Day {day}
                  </Link>
                </li>
              ))
            ) : assessment.dayNumber === 28 ? (
              [1, 2, 3, 4].map((reviewWeek) => (
                <li key={reviewWeek}>
                  <Link
                    href={`/course/software-engineer/weeks/w${String(reviewWeek).padStart(2, '0')}`}
                  >
                    Week {reviewWeek}
                  </Link>
                </li>
              ))
            ) : (
              <li>
                <Link
                  href={`/course/software-engineer/weeks/w${String(week).padStart(2, '0')}`}
                >
                  Week {week}
                </Link>
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}
