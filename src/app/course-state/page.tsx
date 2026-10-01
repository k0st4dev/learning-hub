import { headers } from 'next/headers';
import { CourseState } from '@/components/course-state';
export const metadata = { robots: { index: false, follow: false } };
export default async function CourseStatePage() {
  const issue = (await headers()).get('x-course-issue');
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
