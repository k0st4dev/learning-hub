import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser, sessionCookieName } from './service';
import { getStore } from '../db/current';

export async function pageStudent(returnTo: string) {
  const token = (await cookies()).get(sessionCookieName)?.value;
  const student = currentUser(getStore(), token);
  if (!student) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return { student, token };
}
