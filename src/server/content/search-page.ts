import type { Store } from '../db/connection';
import { ownedEnrollment } from '../learning/read';
import { readCatalog } from './read';
import { AppError } from '../errors';
import type { SearchOptions, SearchBreadcrumb } from '../../domain/search';

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
  const options: SearchOptions = { module: [], week: [], day: [] };
  const numbers = new Map(
    catalog.days.map((day) => [day.itemId, day.dayNumber]),
  );
  for (const key of ['module', 'week', 'day'] as const) {
    options[key] = catalog.items
      .filter((item) => item.kind === key)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id))
      .map((item) => ({
        value: item.stableKey,
        label:
          key === 'day'
            ? 'Day ' + numbers.get(item.id) + ' — ' + item.title
            : item.title,
      }));
  }
  const recent: SearchBreadcrumb[] = [];
  const last = catalog.items.find(
    (item) => item.id === enrollment.lastOpenedItemId,
  );
  if (last) recent.push({ title: last.title, href: last.route });
  return { releaseId: enrollment.releaseId, options, recent };
}
