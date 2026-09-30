import { notFound } from 'next/navigation';
import { pageStudent } from '../auth/page';
import { getStore } from '../db/current';
import { latestRelease, ownedEnrollment } from '../learning/read';
import { readCatalog } from './read';
export async function publishedPage(route: string) {
  const { student, token } = await pageStudent(route);
  const store = getStore();
  const pinned = ownedEnrollment(store, token);
  const releaseId = pinned?.releaseId ?? latestRelease(store)?.id;
  if (!releaseId || releaseId.startsWith('development-')) notFound();
  const catalog = readCatalog(store, releaseId);
  if (!catalog) notFound();
  return { student, catalog };
}
