import Link from 'next/link';
import { pageStudent } from '@/server/auth/page';
import { getStore } from '@/server/db/current';
import { searchPageContext } from '@/server/content/search-page';
import { searchInput } from '@/domain/search';
import { AppError } from '@/server/errors';
import { StudentShell } from '@/components/student-shell';
import { CurriculumSearch } from '@/components/curriculum-search';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const part of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, part);
  const { student, token } = await pageStudent(
    '/search' + (params.size ? '?' + params : ''),
  );
  let context: ReturnType<typeof searchPageContext> | undefined;
  try {
    context = searchPageContext(getStore(), token);
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 503) throw error;
  }
  return (
    <StudentShell
      name={student.displayName || student.email}
      showFixtureNotice={false}
    >
      <h1>Search the course</h1>
      <p>Find original lessons, tasks, topics, handbook text and resources.</p>
      {context === null ? (
        <div className="notice stack">
          <p>Start the course to search your enrolled curriculum.</p>
          <Link href="/course/software-engineer">Start the course</Link>
        </div>
      ) : (
        <CurriculumSearch
          key={student.id}
          studentId={student.id}
          releaseId={context?.releaseId}
          initialInput={searchInput(params)}
          options={context?.options ?? { module: [], week: [], day: [] }}
          recent={context?.recent ?? []}
        />
      )}
    </StudentShell>
  );
}
