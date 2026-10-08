import type { Catalog } from './read.ts';
import type { SearchOptions } from '../../domain/search.ts';

export function catalogScopeOptions(catalog: Catalog): SearchOptions {
  const options: SearchOptions = { module: [], week: [], day: [] };
  const numbers = new Map(
    catalog.days.map((day) => [day.itemId, day.dayNumber]),
  );
  for (const key of ['module', 'week', 'day'] as const)
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
  return options;
}
