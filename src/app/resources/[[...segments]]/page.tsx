import { publishedPage } from '@/server/content/page';
import { FullCurriculumPage } from '@/components/full-curriculum-page';
import { StudentShell } from '@/components/student-shell';
import { SearchEntry } from '@/components/search-entry';
import Link from 'next/link';
import { ResourceLibraryExplorer } from '@/components/resource-library-explorer';
import { ResourceDetailView } from '@/components/resource-detail-view';
import { notFound, redirect } from 'next/navigation';
import {
  resourceQueryInput,
  resourceQuerySchema,
} from '@/domain/resource-library';
import {
  readResourceLibrary,
  readResourceDetail,
} from '@/server/content/resource-library';
import { getStore } from '@/server/db/current';
import { AppError } from '@/server/errors';
export default async function Resources({
  params,
  searchParams,
}: {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { segments = [] } = await params;
  const route =
    '/resources' + (segments.length ? '/' + segments.join('/') : '');
  const queryParams = new URLSearchParams();
  if (!segments.length)
    for (const [key, value] of Object.entries(await searchParams))
      for (const part of Array.isArray(value)
        ? value
        : value === undefined
          ? []
          : [value])
        queryParams.append(key, part);
  const { student, catalog, token } = await publishedPage(
    route + (queryParams.size ? '?' + queryParams : ''),
  );
  const input = resourceQueryInput(queryParams);
  let initialData: ReturnType<typeof readResourceLibrary> | null = null;
  let detailData: ReturnType<typeof readResourceDetail> | null = null;
  let initialError: { status: number; message: string } | undefined;
  if (segments.length) {
    if (
      !catalog.resources.some((row) => '/resources/' + row.stableKey === route)
    )
      notFound();
    try {
      detailData = readResourceDetail(
        getStore(),
        token,
        segments[0],
        student.id,
      );
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      if (error.status === 401)
        redirect('/login?' + new URLSearchParams({ returnTo: route }));
      if (error.code === 'RESOURCE_NOT_FOUND') notFound();
      if (![404, 503].includes(error.status)) throw error;
      initialError = { status: error.status, message: error.message };
    }
  }
  if (!segments.length && resourceQuerySchema.safeParse(input).success) {
    try {
      initialData = readResourceLibrary(getStore(), token, input, student.id);
    } catch (error) {
      if (!(error instanceof AppError) || ![404, 503].includes(error.status))
        throw error;
      initialError = { status: error.status, message: error.message };
    }
  }
  return (
    <StudentShell
      name={student.displayName || student.email}
      showFixtureNotice={false}
    >
      {!segments.length && <SearchEntry />}
      <FullCurriculumPage
        catalog={catalog}
        route={route}
        learnerTool={
          !segments.length ? (
            <>
              {initialError?.status === 404 ? (
                <div className="notice stack">
                  <p>Start the course to filter your enrolled resources.</p>
                  <Link href="/course/software-engineer">Start the course</Link>
                </div>
              ) : (
                <ResourceLibraryExplorer
                  key={student.id}
                  studentId={student.id}
                  releaseId={catalog.release.id}
                  initialInput={input}
                  initialData={initialData}
                  initialError={initialError}
                />
              )}
              <h2 id="original-resource-manual" tabIndex={-1}>
                Original resource manual
              </h2>
            </>
          ) : detailData ? (
            <ResourceDetailView
              data={detailData}
              releaseId={catalog.release.id}
            />
          ) : (
            <section
              className="section notice stack"
              aria-labelledby="resource-detail-labels"
            >
              <h2 id="resource-detail-labels">
                Resource labels and source evidence
              </h2>
              {initialError?.status === 404 ? (
                <>
                  <p>
                    Start the course to see labels for your enrolled resources.
                    Original instructions remain below.
                  </p>
                  <Link href="/course/software-engineer">Start the course</Link>
                </>
              ) : (
                <>
                  <p role="alert">
                    Resource labels are unavailable. Original instructions
                    remain below; added labels are not shown.
                  </p>
                  <a href={route}>Retry resource labels</a>
                </>
              )}
            </section>
          )
        }
      />
    </StudentShell>
  );
}
