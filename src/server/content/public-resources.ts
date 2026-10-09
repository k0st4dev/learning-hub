import type { Store } from '../db/connection';
import { readCatalog, type Catalog } from './read';
import { presentNamedMention } from './resource-mention-view';
import { resourceMentionVersion } from './resource-mention-contract';
import {
  resourceLibraryViewSchema,
  resourceDetailViewSchema,
} from '../../domain/resource-library-view';
import {
  readResourceMentionLibrary,
  readResourceMentionDetail,
} from './resource-mention-projection';
import { resourceLabelPresentation } from './resource-labels';
import { AppError } from '../errors';

type Candidate = ReturnType<typeof readResourceMentionDetail>['resource'];
function present(
  catalog: Catalog,
  resource: Candidate,
  matches?: { matchingUseIds: string[]; matchingMentionKeys: string[] },
) {
  const parent =
    resource.parent &&
    catalog.resources.find((row) => row.id === resource.parent!.resourceId)!;
  const mentions = resource.derivedMentions.map((row) =>
    presentNamedMention(catalog, row),
  );
  const days = new Map<
    string,
    { title: string; href: string; dayNumber: number }
  >();
  for (const context of [
    ...resource.uses.map((row) => ({
      day: row.day,
      dayNumber: row.dayNumber,
      breadcrumbs: row.breadcrumbs,
    })),
    ...resource.derivedMentions.map((row) => ({
      day: row.scope.day,
      dayNumber: row.dayNumber,
      breadcrumbs: row.breadcrumbs,
    })),
  ]) {
    const day = context.breadcrumbs.find((row) =>
      /\/days\/d\d+$/.test(row.href),
    );
    if (day && context.day && context.dayNumber !== null)
      days.set(context.day, { ...day, dayNumber: context.dayNumber });
  }
  const original = resource.originalResource;
  return {
    ...(original ?? {
      id: resource.id,
      stableKey: resource.stableKey,
      title: resource.title,
      descriptionMarkdown: '',
      originalUrl: null,
      resolvedUrl: null,
      sourceName: '',
      type: resource.effective.type,
      linkOrigin: 'unresolved' as const,
      linkStatus: 'unchecked',
      checkedAt: null,
      interpretation: {
        origin: 'added-product-interpretation' as const,
        version: resourceMentionVersion,
        ambiguity: false,
        confidence: null,
        rationale:
          'This resource entry and its title are added interpretations of the named reference. Original instructions and source evidence are shown below.',
        category: 'named-mention',
        evidence: [
          ...new Map(
            mentions
              .flatMap((row) => row.evidence)
              .map((row) => [row.sourceId, row]),
          ).values(),
        ],
      },
    }),
    recordOrigin: resource.origin,
    href: resource.href,
    effective: resource.effective,
    parent:
      parent && resource.parent
        ? {
            resourceId: parent.id,
            title: parent.title,
            href: '/resources/' + parent.stableKey,
            originalUrl: resource.parent.originalUrl,
          }
        : null,
    uses: resource.uses,
    originalUses: resource.originalUses,
    derivedMentions: mentions,
    matchingUseIds:
      matches?.matchingUseIds ?? resource.uses.map((row) => row.id),
    matchingMentionKeys:
      matches?.matchingMentionKeys ?? mentions.map((row) => row.key),
    relatedDays: [...days.values()].sort((a, b) => a.dayNumber - b.dayNumber),
  };
}
export function readResourceLibrary(
  store: Store,
  token: string | undefined,
  input: unknown,
  expectedStudentId?: string,
) {
  return store.native.transaction(() => {
    const data = readResourceMentionLibrary(
      store,
      token,
      input,
      expectedStudentId,
    );
    const catalog = readCatalog(store, data.releaseId);
    if (!catalog)
      throw new AppError(
        503,
        'CONTENT_UNAVAILABLE',
        'Your enrolled resources are unavailable.',
      );
    const labels = resourceLabelPresentation(catalog);
    const result = {
      ...data,
      results: data.results.map((row) => present(catalog, row, row)),
      metadataInterpretation: labels.status,
      metadataCoverage: {
        typesObserved: [
          ...new Set(catalog.resources.map((row) => row.type)),
        ].sort(),
        requirementsObserved: [
          ...new Set(catalog.uses.map((row) => row.requirementMode)),
        ].sort(),
      },
    };
    resourceLibraryViewSchema.parse(result);
    return result;
  })();
}
export function readResourceDetail(
  store: Store,
  token: string | undefined,
  key: unknown,
  expectedStudentId?: string,
) {
  return store.native.transaction(() => {
    const data = readResourceMentionDetail(
      store,
      token,
      key,
      expectedStudentId,
    );
    const catalog = readCatalog(store, data.releaseId);
    if (!catalog)
      throw new AppError(
        503,
        'CONTENT_UNAVAILABLE',
        'Your enrolled resources are unavailable.',
      );
    const result = { ...data, resource: present(catalog, data.resource) };
    resourceDetailViewSchema.parse(result);
    return result;
  })();
}
export type ResourceLibrary = ReturnType<typeof readResourceLibrary>;
