import {
  resourceQuerySchema,
  resourceUseMatches,
} from '../../domain/resource-library.ts';
import { escapeLike, searchTokens } from '../../domain/search.ts';
import type { Store } from '../db/connection.ts';
import { ownedEnrollment } from '../learning/read';
import { AppError } from '../errors.ts';
import { ensureSearchIndex } from './search-index.ts';
import { readCatalog, type Catalog } from './read.ts';
import { courseNavigation } from './navigation.ts';
import { catalogScopeOptions } from './scope-options.ts';

// Explicit code-unit title/ID order, independent of locale, insertion order or query rank.
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function resourceContexts(catalog: Catalog) {
  const navigation = courseNavigation(catalog);
  const keys = new Map(catalog.items.map((item) => [item.id, item.stableKey]));
  const grouped = new Map<
    string,
    (Catalog['uses'][number] & {
      href: string;
      title: string;
      module: string | null;
      week: string | null;
      day: string | null;
      dayNumber: number | null;
      breadcrumbs: { title: string; href: string }[];
    })[]
  >();
  for (const use of catalog.uses) {
    const page = navigation.forItem(use.contentItemId);
    if (!page)
      throw new AppError(
        503,
        'INVALID_CONTENT',
        'Resource context is unavailable.',
      );
    const context = {
      ...use,
      href: page.current.route,
      title: page.current.title,
      module:
        keys.get(
          page.breadcrumbs.find((item) => item.kind === 'module')?.id ?? '',
        ) ?? null,
      week:
        keys.get(
          page.breadcrumbs.find((item) => item.kind === 'week')?.id ?? '',
        ) ?? null,
      day:
        keys.get(
          page.breadcrumbs.find((item) => item.kind === 'day')?.id ?? '',
        ) ?? null,
      dayNumber: page.current.dayNumber,
      breadcrumbs: page.breadcrumbs.map((item) => ({
        title: item.title,
        href: item.route,
      })),
    };
    const uses = grouped.get(use.resourceId) ?? [];
    uses.push(context);
    grouped.set(use.resourceId, uses);
  }
  for (const uses of grouped.values())
    uses.sort((a, b) => a.orderIndex - b.orderIndex || compare(a.id, b.id));
  return grouped;
}

export function readResourceLibrary(
  store: Store,
  token: string | undefined,
  input: unknown,
  expectedStudentId?: string,
) {
  const enrollment = ownedEnrollment(store, token);
  if (!enrollment)
    throw new AppError(
      404,
      'ENROLLMENT_REQUIRED',
      'Start the course before filtering its resources.',
    );
  if (
    expectedStudentId !== undefined &&
    expectedStudentId !== enrollment.userId
  )
    throw new AppError(
      403,
      'ACCOUNT_CHANGED',
      'The signed-in account changed. Reload resources for the current account.',
    );
  const query = resourceQuerySchema.parse(input);
  return store.native.transaction(() => {
    ensureSearchIndex(store, enrollment.releaseId);
    const catalog = readCatalog(store, enrollment.releaseId);
    if (!catalog)
      throw new AppError(
        503,
        'CONTENT_UNAVAILABLE',
        'Your enrolled resources are unavailable.',
      );
    const tokens = searchTokens(query.q);
    const candidates = new Set(
      (
        store.native
          .prepare(
            "SELECT id FROM temp.curriculum_search WHERE release_id=? AND kind='resource'" +
              tokens
                .map(() => " AND normalized_text LIKE ? ESCAPE '\\'")
                .join(''),
          )
          .all(
            enrollment.releaseId,
            ...tokens.map((token) => '%' + escapeLike(token) + '%'),
          ) as { id: string }[]
      ).map((row) => row.id),
    );
    const contexts = resourceContexts(catalog);
    const contextual =
      query.requirement.length ||
      query.module.length ||
      query.week.length ||
      query.day.length;
    const resources = catalog.resources
      .filter((resource) => {
        if (
          !candidates.has(resource.id) ||
          (query.source.length &&
            !query.source.includes(resource.sourceName)) ||
          (query.type.length &&
            !query.type.some((type) => type === resource.type))
        )
          return false;
        return (
          !contextual ||
          (contexts.get(resource.id) ?? []).some((use) =>
            resourceUseMatches(query, use),
          )
        );
      })
      .sort((a, b) => compare(a.title, b.title) || compare(a.id, b.id));
    const results = resources
      .slice((query.page - 1) * 25, query.page * 25)
      .map((resource) => {
        const uses = contexts.get(resource.id) ?? [];
        const days = new Map<
          string,
          { title: string; href: string; dayNumber: number }
        >();
        for (const use of uses) {
          if (!use.day || use.dayNumber === null) continue;
          const day = use.breadcrumbs.find((item) =>
            /\/days\/d\d+$/.test(item.href),
          );
          if (day) days.set(use.day, { ...day, dayNumber: use.dayNumber });
        }
        return {
          ...resource,
          href: '/resources/' + resource.stableKey,
          uses,
          matchingUseIds: uses
            .filter((use) => resourceUseMatches(query, use))
            .map((use) => use.id),
          relatedDays: [...days.values()].sort(
            (a, b) => a.dayNumber - b.dayNumber,
          ),
        };
      });
    return {
      releaseId: enrollment.releaseId,
      query,
      pageSize: 25 as const,
      total: resources.length,
      results,
      options: {
        ...catalogScopeOptions(catalog),
        source: [
          ...new Set(catalog.resources.map((resource) => resource.sourceName)),
        ]
          .sort(compare)
          .map((value) => ({ value, label: value })),
      },
      metadataCoverage: {
        typesObserved: [
          ...new Set(catalog.resources.map((resource) => resource.type)),
        ].sort(compare),
        requirementsObserved: [
          ...new Set(catalog.uses.map((use) => use.requirementMode)),
        ].sort(compare),
      },
    };
  })();
}
export type ResourceLibrary = ReturnType<typeof readResourceLibrary>;
