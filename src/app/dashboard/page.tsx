import { pageStudent } from '@/server/auth/page';
import { getStore } from '@/server/db/current';
import { snapshot, latestRelease } from '@/server/learning/read';
import { LearningClient } from '@/components/learning-client';
import { StudentShell } from '@/components/student-shell';
import { en } from '@/i18n/en';
export default async function Dashboard() {
  const { student, token } = await pageStudent('/dashboard');
  const state = snapshot(getStore(), token);
  const fixture =
    (state?.enrollment.releaseId ?? latestRelease(getStore())?.id)?.startsWith(
      'development-',
    ) ?? false;
  return (
    <StudentShell
      name={student.displayName || student.email}
      showFixtureNotice={fixture}
    >
      <h1>{en.dashboard}</h1>
      <LearningClient view="dashboard" initialState={state} />
    </StudentShell>
  );
}
