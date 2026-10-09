import type { Store } from '../db/connection.ts';
import { readCatalog } from './read.ts';
import { readResourceBindings } from './resource-library.ts';
import { resourceMentionPresentation } from './resource-mentions.ts';
import {
  resourceDetailKeySchema,
  resourceProviderKey,
  resourceQuerySchema,
  resourceUseMatches,
} from '../../domain/resource-library.ts';
import { normalizeSearch, searchTokens } from '../../domain/search.ts';
import { catalogScopeOptions } from './scope-options.ts';
import { AppError } from '../errors.ts';

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
// Internal owned candidate only; public routes and Search remain on reviewed bindings.
function ownedProjection(
  store: Store,
  token: string | undefined,
  expectedStudentId?: string,
) {
  const original = readResourceBindings(store, token, expectedStudentId);
  const catalog = readCatalog(store, original.releaseId);
  if (!catalog)
    throw new AppError(
      503,
      'CONTENT_UNAVAILABLE',
      'Your enrolled resources are unavailable.',
    );
  const named = resourceMentionPresentation(catalog);
  const originalById = new Map(original.resources.map((row) => [row.id, row]));
  const definitions = new Map(named.resources.map((row) => [row.id, row]));
  const resources = [
    ...original.resources.map((row) => ({
      id: row.id,
      stableKey: row.stableKey,
      title: row.title,
      href: row.href,
      origin: 'imported-resource' as const,
      originalResource: row as typeof row | null,
      effective: row.effective,
      parent: definitions.get(row.id)?.parent ?? null,
      uses: original.uses.filter((use) => use.effective.resourceId === row.id),
      originalUses: original.uses.filter((use) => use.resourceId === row.id),
      derivedMentions: named.mentions.filter(
        (mention) => mention.resourceId === row.id,
      ),
    })),
    ...named.resources
      .filter((row) => !originalById.has(row.id))
      .map((row) => ({
        id: row.id,
        stableKey: row.stableKey,
        title: row.title,
        href: '/resources/' + row.stableKey,
        origin: 'added-product-interpretation' as const,
        originalResource: null,
        effective: {
          type: row.type,
          provider: row.provider,
          sourceFilterKey: resourceProviderKey(row.provider),
        },
        parent: row.parent,
        uses: [],
        originalUses: [],
        derivedMentions: named.mentions.filter(
          (mention) => mention.resourceId === row.id,
        ),
      })),
  ].sort((a, b) => compare(a.title, b.title) || compare(a.id, b.id));
  return {
    releaseId: original.releaseId,
    metadataMentionInterpretation: named.status,
    metadataBindingInterpretation: original.metadataBindingInterpretation,
    resources,
    originalUses: original.uses,
    derivedMentions: named.mentions,
    options: {
      ...catalogScopeOptions(catalog),
      source: [
        ...new Map(
          resources.map((row) => [
            row.effective.sourceFilterKey,
            {
              value: row.effective.sourceFilterKey,
              label:
                row.effective.provider ?? 'Provider not specified in manual',
            },
          ]),
        ).values(),
      ].sort((a, b) => compare(a.label, b.label) || compare(a.value, b.value)),
    },
  };
}
export function readResourceMentionProjection(
  store: Store,
  token: string | undefined,
  expectedStudentId?: string,
) {
  return store.native.transaction(() =>
    ownedProjection(store, token, expectedStudentId),
  )();
}
export function readResourceMentionLibrary(
  store: Store,
  token: string | undefined,
  input: unknown,
  expectedStudentId?: string,
) {
  return store.native.transaction(() => {
    const data = ownedProjection(store, token, expectedStudentId);
    const query = resourceQuerySchema.parse(input);
    const tokens = searchTokens(query.q);
    const contextual =
      query.module.length ||
      query.week.length ||
      query.day.length ||
      query.requirement.length;
    const results = data.resources.flatMap((resource) => {
      const matchingUseIds = resource.uses
        .filter((use) =>
          resourceUseMatches(query, {
            ...use,
            requirementMode: use.effective.requirementMode,
          }),
        )
        .map((use) => use.id);
      const matchingMentionKeys = resource.derivedMentions
        .filter((mention) =>
          resourceUseMatches(query, {
            ...mention.scope,
            requirementMode: mention.requirementMode,
          }),
        )
        .map((mention) => mention.key);
      const text = normalizeSearch(
        [
          resource.title,
          resource.originalResource?.descriptionMarkdown ?? '',
          resource.originalResource?.originalUrl ?? '',
          ...resource.uses.map((use) => use.assignedText),
          ...resource.derivedMentions.flatMap((mention) => [
            mention.displayName,
            mention.exactInstruction,
          ]),
        ].join(' '),
      );
      if (
        !tokens.every((token) => text.includes(token)) ||
        (query.source.length &&
          !query.source.includes(resource.effective.sourceFilterKey)) ||
        (query.type.length &&
          !query.type.some((type) => type === resource.effective.type)) ||
        (contextual && !matchingUseIds.length && !matchingMentionKeys.length)
      )
        return [];
      return [{ ...resource, matchingUseIds, matchingMentionKeys }];
    });
    return {
      releaseId: data.releaseId,
      query,
      pageSize: 25 as const,
      total: results.length,
      results: results.slice((query.page - 1) * 25, query.page * 25),
      options: data.options,
      metadataMentionInterpretation: data.metadataMentionInterpretation,
    };
  })();
}
export function readResourceMentionDetail(
  store: Store,
  token: string | undefined,
  key: unknown,
  expectedStudentId?: string,
) {
  return store.native.transaction(() => {
    const data = ownedProjection(store, token, expectedStudentId);
    const stableKey = resourceDetailKeySchema.parse(key);
    const resource = data.resources.find((row) => row.stableKey === stableKey);
    if (!resource)
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        'This resource is not in your enrolled course.',
      );
    return {
      releaseId: data.releaseId,
      resource,
      metadataMentionInterpretation: data.metadataMentionInterpretation,
    };
  })();
}
