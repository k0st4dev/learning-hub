import { notFound, redirect } from 'next/navigation';
import { pageStudent } from '@/server/auth/page';
import { getStore } from '@/server/db/current';
import { snapshot, coursePath, latestRelease } from '@/server/learning/read';
import { readCatalog } from '@/server/content/read';
import { FullCurriculumPage } from '@/components/full-curriculum-page';
import {
  LearningClient,
  type LearningView,
} from '@/components/learning-client';
import { StudentShell } from '@/components/student-shell';
import { en } from '@/i18n/en';
import { AppError } from '@/server/errors';
import { ExerciseEditor } from '@/components/exercise-editor';
import { loadExerciseRequirements } from '@/server/learning/exercise-work';
import Link from 'next/link';
import { StudyEditor } from '@/components/study-editor';
import { studyContext } from '@/domain/study-context';
import { exerciseSubmissionSchema } from '@/domain/exercise-requirements';
import { ScopedProgress } from '@/components/scoped-progress';
import { ProgressOverview } from '@/components/progress-overview';
export default async function Course({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  const route = segments.join('/');
  const { student, token } = await pageStudent(`${coursePath}/${route}`);
  const state = snapshot(getStore(), token);
  const releaseId =
    state?.enrollment.releaseId ?? latestRelease(getStore())?.id;
  if (!releaseId)
    throw new AppError(503, 'SETUP_REQUIRED', 'Course setup is needed.');
  if (releaseId && !releaseId.startsWith('development-')) {
    const catalog = readCatalog(getStore(), releaseId);
    if (!catalog)
      throw new AppError(
        503,
        'CONTENT_UNAVAILABLE',
        'This course version is unavailable.',
      );
    const exercise = catalog.items.find(
      (item) =>
        item.kind === 'exercise' && item.route === coursePath + '/' + route,
    );
    const progress = state?.exerciseProgress.find(
      (item) => item.exerciseId === exercise?.id,
    );
    const exerciseEditor = exercise ? (
      state ? (
        <ExerciseEditor
          key={`${student.id}:${exercise.id}`}
          itemId={exercise.id}
          studentId={student.id}
          requirements={
            loadExerciseRequirements(getStore(), releaseId, exercise.id)
              .requirements
          }
          tasks={catalog.items
            .filter(
              (item) => item.kind === 'task' && item.parentId === exercise.id,
            )
            .map((item) => ({ id: item.stableKey, text: item.bodyMarkdown }))}
          initial={{
            revision: state.revision,
            completed: progress?.status === 'completed',
            context: studyContext(state, exercise.id),
            submission: progress?.submission ?? {
              tasks: [],
              evidence: '',
              selectedScope: '',
              attested: false,
              result: null,
              transferPath: null,
              transferReflection: '',
              scoreEvidence: '',
              remediationNote: '',
            },
          }}
        />
      ) : (
        <p className="section">
          <Link href={coursePath}>{en.learning.start}</Link>
        </p>
      )
    ) : undefined;
    const currentItem = catalog.items.find(
      (item) => item.route === coursePath + '/' + route,
    );
    const studyLesson =
      currentItem?.kind === 'lesson'
        ? currentItem
        : currentItem?.kind === 'day'
          ? catalog.items.find(
              (item) =>
                item.kind === 'lesson' && item.parentId === currentItem.id,
            )
          : undefined;
    const studyEditor =
      studyLesson && state ? (
        <StudyEditor
          key={`${student.id}:${studyLesson.id}:${currentItem?.kind}`}
          itemId={studyLesson.id}
          studentId={student.id}
          dayOverview={currentItem?.kind === 'day'}
          initial={{
            revision: state.revision,
            completed:
              state.units.find((unit) => unit.id === studyLesson.id)
                ?.complete ?? false,
            context: studyContext(state, studyLesson.id),
            submission: exerciseSubmissionSchema.parse({
              tasks: [],
              evidence: '',
              selectedScope: '',
              attested: false,
              result: null,
            }),
          }}
        />
      ) : studyLesson ? (
        <p className="section">
          <Link href={coursePath}>{en.learning.start}</Link>
        </p>
      ) : undefined;
    return (
      <StudentShell
        name={student.displayName || student.email}
        showFixtureNotice={false}
      >
        {route === 'progress' ? (
          <>
            <h1>{en.learning.progress}</h1>
            <LearningClient
              key={`${student.id}:${state?.revision}`}
              view="progress"
              initialState={state}
            />
          </>
        ) : (
          <FullCurriculumPage
            catalog={catalog}
            route={coursePath + (route ? '/' + route : '')}
            exerciseEditor={exerciseEditor}
            exerciseWorkAvailable={!!state && !!exercise}
            studyEditor={studyEditor}
            progressView={
              state &&
              (route === '' ? (
                <ProgressOverview
                  key={student.id}
                  state={state}
                  view="course"
                />
              ) : currentItem &&
                ['module', 'week', 'day'].includes(currentItem.kind) ? (
                <ScopedProgress state={state} itemId={currentItem.id} />
              ) : undefined)
            }
          />
        )}
        {route === '' && !state && (
          <section className="section">
            <LearningClient view="course" initialState={null} />
          </section>
        )}
        {route === 'preparation' && state && (
          <section className="section">
            <LearningClient view="preparation" initialState={state} />
          </section>
        )}
      </StudentShell>
    );
  }
  let view: LearningView = 'course';
  let itemKey: string | undefined;
  if (route === 'preparation') view = 'preparation';
  else if (route === 'progress') view = 'progress';
  else if (route === 'days/d001') {
    view = 'day';
    itemKey = 'd001-learn';
  } else if (route === 'days/d001/lessons/d001-learn') {
    view = 'lesson';
    itemKey = 'd001-learn';
  } else if (route === 'days/d001/exercises/d001-practice') {
    view = 'exercise';
    itemKey = 'd001-practice';
  } else if (route !== '') notFound();
  if (!state && view !== 'course') redirect(coursePath);
  const title =
    view === 'preparation'
      ? en.learning.preparation
      : view === 'progress'
        ? en.learning.progress
        : itemKey
          ? state?.items.find((i) => i.stableKey === itemKey)?.title
          : en.courseLabel;
  return (
    <StudentShell name={student.displayName || student.email}>
      <h1 lang={itemKey ? 'sr-Latn' : 'en'}>{title}</h1>
      <LearningClient
        key={`${view}:${itemKey}`}
        view={view}
        itemKey={itemKey}
        initialState={state}
      />
    </StudentShell>
  );
}
