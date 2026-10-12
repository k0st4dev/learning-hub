import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser, sessionCookieName } from './service';
import { getStore } from '../db/current';
import { AppError } from '../errors';

export async function redirectSignedInStudent() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) return;
  let student;
  try {
    student = currentUser(getStore(), token);
  } catch (cause) {
    if (cause instanceof AppError && cause.status === 503) return;
    throw cause;
  }
  if (student) redirect('/dashboard');
}

export async function pageStudent(returnTo: string) {
  const token = (await cookies()).get(sessionCookieName)?.value;
  const student = currentUser(getStore(), token);
  if (!student) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return { student, token };
}
