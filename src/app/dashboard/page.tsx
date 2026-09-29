import { pageStudent } from '@/server/auth/page';
import { getStore } from '@/server/db/current';
import { snapshot } from '@/server/learning/read';
import { LearningClient } from '@/components/learning-client';
import { StudentShell } from '@/components/student-shell';
import { en } from '@/i18n/en';
export default async function Dashboard() {
  const { student, token } = await pageStudent('/dashboard');
  return (
    <StudentShell name={student.displayName || student.email}>
      <h1>{en.dashboard}</h1>
      <LearningClient
        view="dashboard"
        initialState={snapshot(getStore(), token)}
      />
    </StudentShell>
  );
}
