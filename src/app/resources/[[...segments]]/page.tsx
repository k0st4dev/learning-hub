import { publishedPage } from '@/server/content/page';
import { FullCurriculumPage } from '@/components/full-curriculum-page';
import { StudentShell } from '@/components/student-shell';
export default async function Resources({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  const route =
    '/resources' + (segments.length ? '/' + segments.join('/') : '');
  const { student, catalog } = await publishedPage(route);
  return (
    <StudentShell
      name={student.displayName || student.email}
      showFixtureNotice={false}
    >
      <FullCurriculumPage catalog={catalog} route={route} />
    </StudentShell>
  );
}
