'use client';
import { CourseState } from '@/components/course-state';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <CourseState issue="unavailable" retry={reset} />;
}
