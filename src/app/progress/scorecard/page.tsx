import { publishedPage } from '@/server/content/page';
import { FullCurriculumPage } from '@/components/full-curriculum-page';
import { StudentShell } from '@/components/student-shell';
export default async function ScorecardSource() {
  const { student, catalog } = await publishedPage('/progress/scorecard');
  return (
    <StudentShell
      name={student.displayName || student.email}
      showFixtureNotice={false}
    >
      <FullCurriculumPage catalog={catalog} route="/progress/scorecard" />
    </StudentShell>
  );
}
