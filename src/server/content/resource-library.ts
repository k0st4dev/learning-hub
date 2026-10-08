import {
  resourceQuerySchema,
  resourceDetailKeySchema,
  resourceUseMatches,
} from '../../domain/resource-library.ts';
import { escapeLike, searchTokens } from '../../domain/search.ts';
import type { Store } from '../db/connection.ts';
import { ownedEnrollment } from '../learning/read';
import { AppError } from '../errors.ts';
import {
  ensureSearchIndex,
  searchIndexTable,
  type ResourceProjection,
} from './search-index.ts';
import { readCatalog, type Catalog } from './read.ts';
import { courseNavigation } from './navigation.ts';
import { catalogScopeOptions } from './scope-options.ts';
import { resourceBindingPresentation } from './resource-bindings.ts';
import {
  resourceLabelPresentation,
  type ResourceUsePresentation,
} from './resource-labels.ts';

// Explicit code-unit title/ID order, independent of locale, insertion order or query rank.
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function resourceContexts(
  catalog: Catalog,
  labels: ReturnType<typeof resourceLabelPresentation>,
  bindings?: ReturnType<typeof resourceBindingPresentation>,
) {
  const navigation = courseNavigation(catalog);
  const keys = new Map(catalog.items.map((item) => [item.id, item.stableKey]));
  const grouped = new Map<
    string,
    (Catalog['uses'][number] &
      ResourceUsePresentation & {
        binding?: NonNullable<
          ReturnType<
            ReturnType<typeof resourceBindingPresentation>['uses']['get']
          >
        >;
        effective: ResourceUsePresentation['effective'] & {
          resourceId?: string;
        };
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
    const binding = bindings?.uses.get(use.id);
    const context = {
      ...use,
      ...labels.uses.get(use.id)!,
      ...(binding
        ? {
            binding,
            effective: {
              ...labels.uses.get(use.id)!.effective,
              resourceId: binding.effectiveResourceId,
            },
          }
        : {}),
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
    const resourceId = binding?.effectiveResourceId ?? use.resourceId;
    const uses = grouped.get(resourceId) ?? [];
    uses.push(context);
    grouped.set(resourceId, uses);
  }
  for (const uses of grouped.values())
    uses.sort((a, b) => a.orderIndex - b.orderIndex || compare(a.id, b.id));
  return grouped;
}

function resourceEnrollment(
  store: Store,
  token: string | undefined,
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
  return enrollment;
}

function presentResource(
  resource: Catalog['resources'][number],
  uses: NonNullable<ReturnType<ReturnType<typeof resourceContexts>['get']>>,
  labels: ReturnType<typeof resourceLabelPresentation>,
  matchesUse: (use: (typeof uses)[number]) => boolean = () => true,
  originalUses?: typeof uses,
) {
  const days = new Map<
    string,
    { title: string; href: string; dayNumber: number }
  >();
  for (const use of uses) {
    if (!use.day || use.dayNumber === null) continue;
    const day = use.breadcrumbs.find((item) => /\/days\/d\d+$/.test(item.href));
    if (day) days.set(use.day, { ...day, dayNumber: use.dayNumber });
  }
  return {
    ...resource,
    ...labels.resources.get(resource.id)!,
    href: '/resources/' + resource.stableKey,
    uses,
    ...(originalUses ? { originalUses } : {}),
    matchingUseIds: uses.filter(matchesUse).map((use) => use.id),
    relatedDays: [...days.values()].sort((a, b) => a.dayNumber - b.dayNumber),
  };
}

export function readResourceDetail(
  store: Store,
  token: string | undefined,
  key: unknown,
  expectedStudentId?: string,
  projection: ResourceProjection = 'reviewed-bindings',
) {
  const enrollment = resourceEnrollment(store, token, expectedStudentId);
  const stableKey = resourceDetailKeySchema.parse(key);
  return store.native.transaction(() => {
    const catalog = readCatalog(store, enrollment.releaseId);
    if (!catalog)
      throw new AppError(
        503,
        'CONTENT_UNAVAILABLE',
        'Your enrolled resources are unavailable.',
      );
    const resource = catalog.resources.find(
      (row) => row.stableKey === stableKey,
    );
    if (!resource)
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        'This resource is not in your enrolled course.',
      );
    const labels = resourceLabelPresentation(catalog);
    const bindings =
      projection === 'reviewed-bindings'
        ? resourceBindingPresentation(catalog)
        : undefined;
    const contexts = resourceContexts(catalog, labels, bindings);
    return {
      releaseId: enrollment.releaseId,
      resource: presentResource(
        resource,
        contexts.get(resource.id) ?? [],
        labels,
        undefined,
        bindings
          ? [...contexts.values()]
              .flat()
              .filter((use) => use.resourceId === resource.id)
          : undefined,
      ),
      ...(bindings ? { metadataBindingInterpretation: bindings.status } : {}),
      metadataInterpretation: labels.status,
    };
  })();
}

export function readResourceLibrary(
  store: Store,
  token: string | undefined,
  input: unknown,
  expectedStudentId?: string,
  projection: ResourceProjection = 'reviewed-bindings',
) {
  const enrollment = resourceEnrollment(store, token, expectedStudentId);
  const query = resourceQuerySchema.parse(input);
  return store.native.transaction(() => {
    ensureSearchIndex(store, enrollment.releaseId, projection);
    const table = searchIndexTable(projection);
    const catalog = readCatalog(store, enrollment.releaseId);
    if (!catalog)
      throw new AppError(
        503,
        'CONTENT_UNAVAILABLE',
        'Your enrolled resources are unavailable.',
      );
    const tokens = searchTokens(query.q);
    const labels = resourceLabelPresentation(catalog);
    const candidates = new Set(
      (
        store.native
          .prepare(
            'SELECT id FROM temp.' +
              table +
              " WHERE release_id=? AND kind='resource'" +
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
    const bindings =
      projection === 'reviewed-bindings'
        ? resourceBindingPresentation(catalog)
        : undefined;
    const contexts = resourceContexts(catalog, labels, bindings);
    const matchesUse = (
      use: (typeof catalog.uses)[number] & {
        effective: { requirementMode: string };
        module: string | null;
        week: string | null;
        day: string | null;
      },
    ) =>
      resourceUseMatches(query, {
        ...use,
        requirementMode: use.effective.requirementMode,
      });
    const contextual =
      query.requirement.length ||
      query.module.length ||
      query.week.length ||
      query.day.length;
    const resources = catalog.resources
      .filter((resource) => {
        const effective = labels.resources.get(resource.id)!.effective;
        if (
          !candidates.has(resource.id) ||
          (query.source.length &&
            !query.source.includes(effective.sourceFilterKey)) ||
          (query.type.length &&
            !query.type.some((type) => type === effective.type))
        )
          return false;
        return (
          !contextual ||
          (contexts.get(resource.id) ?? []).some((use) => matchesUse(use))
        );
      })
      .sort((a, b) => compare(a.title, b.title) || compare(a.id, b.id));
    const results = resources
      .slice((query.page - 1) * 25, query.page * 25)
      .map((resource) =>
        presentResource(
          resource,
          contexts.get(resource.id) ?? [],
          labels,
          matchesUse,
          bindings
            ? [...contexts.values()]
                .flat()
                .filter((use) => use.resourceId === resource.id)
            : undefined,
        ),
      );
    return {
      releaseId: enrollment.releaseId,
      query,
      pageSize: 25 as const,
      total: resources.length,
      results,
      metadataInterpretation: labels.status,
      ...(bindings ? { metadataBindingInterpretation: bindings.status } : {}),
      options: {
        ...catalogScopeOptions(catalog),
        source: [
          ...new Map(
            [...labels.resources.values()].map(({ effective }) => [
              effective.sourceFilterKey,
              {
                value: effective.sourceFilterKey,
                label: effective.provider ?? 'Provider not specified in manual',
              },
            ]),
          ).values(),
        ].sort(
          (a, b) => compare(a.label, b.label) || compare(a.value, b.value),
        ),
      },
      metadataCoverage: {
        typesObserved: [
          ...new Set(catalog.resources.map((resource) => resource.type)),
        ].sort(compare),
        requirementsObserved: [
          ...new Set(catalog.uses.map((use) => use.requirementMode)),
        ].sort(compare),
      },
      effectiveMetadataCoverage: {
        typesObserved: [
          ...new Set(
            [...labels.resources.values()].map((row) => row.effective.type),
          ),
        ].sort(compare),
        requirementsObserved: [
          ...new Set(
            [...labels.uses.values()].map(
              (row) => row.effective.requirementMode,
            ),
          ),
        ].sort(compare),
      },
    };
  })();
}
export type ResourceLibrary = ReturnType<typeof readResourceLibrary>;

// Complete original/effective inventory for audits and shared learning context.
export function readResourceBindings(
  store: Store,
  token: string | undefined,
  expectedStudentId?: string,
) {
  const enrollment = resourceEnrollment(store, token, expectedStudentId);
  return store.native.transaction(() => {
    const catalog = readCatalog(store, enrollment.releaseId);
    if (!catalog)
      throw new AppError(
        503,
        'CONTENT_UNAVAILABLE',
        'Your enrolled resources are unavailable.',
      );
    const bindings = resourceBindingPresentation(catalog);
    const labels = resourceLabelPresentation(catalog);
    const uses = [...resourceContexts(catalog, labels, bindings).values()]
      .flat()
      .sort((a, b) => a.orderIndex - b.orderIndex || compare(a.id, b.id))
      .map((use) => {
        const binding = bindings.uses.get(use.id)!;
        return {
          ...use,
          binding,
          effective: {
            ...use.effective,
            resourceId: binding.effectiveResourceId,
          },
        };
      });
    return {
      releaseId: enrollment.releaseId,
      metadataBindingInterpretation: bindings.status,
      resources: catalog.resources.map((resource) => ({
        ...resource,
        ...labels.resources.get(resource.id)!,
        href: '/resources/' + resource.stableKey,
        originalUseIds: uses
          .filter((use) => use.resourceId === resource.id)
          .map((use) => use.id),
        effectiveUseIds: uses
          .filter((use) => use.effective.resourceId === resource.id)
          .map((use) => use.id),
      })),
      uses,
    };
  })();
}
