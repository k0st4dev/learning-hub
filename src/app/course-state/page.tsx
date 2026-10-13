import { headers } from 'next/headers';
import { CourseState } from '@/components/course-state';
export const metadata = { robots: { index: false, follow: false } };
export default async function CourseStatePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const paramIssue =
    typeof params?.issue === 'string' ? params.issue : undefined;
  const issue = paramIssue ?? (await headers()).get('x-course-issue');
  return (
    <CourseState
      issue={
        issue === 'setup' || issue === 'unpublished' || issue === 'unavailable'
          ? issue
          : 'missing'
      }
    />
  );
}
