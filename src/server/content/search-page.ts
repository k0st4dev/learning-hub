import type { Store } from '../db/connection';
import { ownedEnrollment } from '../learning/read';
import { readCatalog } from './read';
import { AppError } from '../errors';
import type { SearchBreadcrumb } from '../../domain/search';
import { catalogScopeOptions } from './scope-options';

export function searchPageContext(store: Store, token: string | undefined) {
  const enrollment = ownedEnrollment(store, token);
  if (!enrollment) return null;
  const catalog = readCatalog(store, enrollment.releaseId);
  if (!catalog || enrollment.releaseId.startsWith('development-'))
    throw new AppError(
      503,
      'CONTENT_UNAVAILABLE',
      'Your enrolled curriculum is unavailable. Retry without changing your search.',
    );
  const options = catalogScopeOptions(catalog);
  const recent: SearchBreadcrumb[] = [];
  const last = catalog.items.find(
    (item) => item.id === enrollment.lastOpenedItemId,
  );
  if (last) recent.push({ title: last.title, href: last.route });
  return { releaseId: enrollment.releaseId, options, recent };
}
