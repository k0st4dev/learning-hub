import { notFound, redirect } from 'next/navigation';
import { pageStudent } from '@/server/auth/page';
import { getStore } from '@/server/db/current';
import { snapshot, coursePath } from '@/server/learning/read';
import {
  LearningClient,
  type LearningView,
} from '@/components/learning-client';
import { StudentShell } from '@/components/student-shell';
import { en } from '@/i18n/en';
export default async function Course({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  const route = segments.join('/');
  const { student, token } = await pageStudent(`${coursePath}/${route}`);
  const state = snapshot(getStore(), token);
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
