import { AppError } from '../errors';
import { pageStudent } from '../auth/page';
import { getStore } from '../db/current';
import { latestRelease, ownedEnrollment } from '../learning/read';
import { readCatalog } from './read';
export async function publishedPage(route: string) {
  const { student, token } = await pageStudent(route);
  const store = getStore();
  const pinned = ownedEnrollment(store, token);
  const releaseId = pinned?.releaseId ?? latestRelease(store)?.id;
  if (!releaseId)
    throw new AppError(503, 'SETUP_REQUIRED', 'Course setup is needed.');
  if (releaseId.startsWith('development-'))
    throw new AppError(
      503,
      'CONTENT_UNAVAILABLE',
      'This course version is unavailable.',
    );
  const catalog = readCatalog(store, releaseId);
  if (!catalog)
    throw new AppError(
      503,
      'CONTENT_UNAVAILABLE',
      'This course version is unavailable.',
    );
  return { student, catalog };
}
