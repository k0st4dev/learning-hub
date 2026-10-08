import { z } from 'zod';
import { searchQuerySchema } from './search.ts';

export const resourceTypes = [
  'documentation',
  'article',
  'video',
  'course',
  'tool',
  'reference',
  'practice',
  'guide',
] as const;
export const resourceRequirements = [
  'required',
  'optional',
  'reference',
  'conditional',
] as const;

// Reviewed providers use a distinct namespace; unknown choices never acquire a fabricated name.
export function resourceProviderKey(provider: string | null) {
  return provider === null
    ? 'provider-unspecified'
    : 'provider/' + encodeURIComponent(provider);
}
export const resourceQuerySchema = z
  .strictObject({
    q: searchQuerySchema.shape.q,
    page: searchQuerySchema.shape.page,
    source: z.array(z.string().min(1).max(200)).max(16).default([]),
    type: z.array(z.enum(resourceTypes)).max(8).default([]),
    module: searchQuerySchema.shape.module,
    week: searchQuerySchema.shape.week,
    day: searchQuerySchema.shape.day,
    requirement: z.array(z.enum(resourceRequirements)).max(4).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.q.split(/\s+/u).filter(Boolean).length > 8)
      ctx.addIssue({
        code: 'custom',
        path: ['q'],
        message: 'Use at most eight search words.',
      });
  });
export type ResourceQuery = z.infer<typeof resourceQuerySchema>;
const filters = [
  'source',
  'type',
  'module',
  'week',
  'day',
  'requirement',
] as const;
export function resourceQueryInput(
  params: URLSearchParams,
): Record<string, unknown> {
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => [
      key,
      filters.some((filter) => filter === key) ||
      params.getAll(key).length !== 1
        ? params.getAll(key)
        : params.get(key),
    ]),
  );
}
export function resourceLibraryHref(query: ResourceQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  for (const key of filters)
    for (const value of query[key]) params.append(key, value);
  if (query.page > 1) params.set('page', String(query.page));
  return '/resources' + (params.size ? '?' + params : '');
}
export type ResourceUseScope = {
  requirementMode: string;
  module: string | null;
  week: string | null;
  day: string | null;
};
/** All contextual dimensions must match the same use; unrelated uses cannot combine. */
export function resourceUseMatches(
  query: ResourceQuery,
  use: ResourceUseScope,
) {
  if (
    query.requirement.length &&
    !query.requirement.some((value) => value === use.requirementMode)
  )
    return false;
  return (['module', 'week', 'day'] as const).every(
    (key) =>
      !query[key].length ||
      (use[key] !== null && query[key].includes(use[key]!)),
  );
}
