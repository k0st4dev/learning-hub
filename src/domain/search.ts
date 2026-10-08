import { z } from 'zod';

export const searchKinds = [
  'module',
  'week',
  'day',
  'lesson',
  'exercise',
  'task',
  'guide',
  'preparation',
  'resource',
] as const;
const scopes = z.array(z.string().min(1).max(80)).max(8).default([]);
export const searchQuerySchema = z
  .strictObject({
    q: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    kind: z.array(z.enum(searchKinds)).max(9).default([]),
    module: scopes,
    week: scopes,
    day: scopes,
  })
  .superRefine((value, ctx) => {
    if (value.q.split(/\s+/u).filter(Boolean).length > 8)
      ctx.addIssue({
        code: 'custom',
        path: ['q'],
        message: 'Use at most eight search words.',
      });
  });
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export function normalizeSearch(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('đ', 'd');
}
export function searchTokens(q: string) {
  return [...new Set(normalizeSearch(q).split(/\s+/u).filter(Boolean))];
}
export function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (character) => '\\' + character);
}
/** Plain original text only. Consumers render it as text, never raw HTML. */
export function searchSnippet(
  text: string,
  tokens: readonly string[],
  limit = 180,
) {
  const offsets: number[] = [];
  let normalized = '';
  let offset = 0;
  for (const character of text) {
    const value = normalizeSearch(character);
    for (let i = 0; i < value.length; i++) offsets.push(offset);
    normalized += value;
    offset += character.length;
  }
  const matches = tokens
    .map((token) => normalized.indexOf(token))
    .filter((n) => n >= 0);
  const first = matches.length ? (offsets[Math.min(...matches)] ?? 0) : 0;
  // Code-point slicing avoids cutting a surrogate pair at a snippet boundary.
  const characters = Array.from(text);
  const position = Array.from(text.slice(0, first)).length;
  const start = Math.max(0, position - 45);
  return (
    (start ? '…' : '') +
    characters.slice(start, start + limit).join('') +
    (start + limit < characters.length ? '…' : '')
  );
}
export type SearchBreadcrumb = { title: string; href: string };
export type SearchResult = {
  id: string;
  kind: (typeof searchKinds)[number];
  title: string;
  href: string;
  snippet: string;
  breadcrumbs: SearchBreadcrumb[];
};
export type SearchResponse = {
  releaseId: string;
  query: SearchQuery;
  total: number;
  pageSize: 20;
  results: SearchResult[];
};

export function searchInput(params: URLSearchParams): Record<string, unknown> {
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => [
      key,
      ['kind', 'module', 'week', 'day'].includes(key) ||
      params.getAll(key).length !== 1
        ? params.getAll(key)
        : params.get(key),
    ]),
  );
}
export function searchHref(query: SearchQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  for (const key of ['kind', 'module', 'week', 'day'] as const)
    for (const value of query[key]) params.append(key, value);
  if (query.page > 1) params.set('page', String(query.page));
  return '/search' + (params.size ? '?' + params : '');
}
const localHref = z
  .string()
  .regex(
    /^\/(?:course\/software-engineer(?:[\/#]|$)|resources(?:[\/#]|$)|progress\/scorecard$)/,
  );
export const searchResponseSchema = z.object({
  releaseId: z.string().min(1),
  query: searchQuerySchema,
  total: z.number().int().nonnegative(),
  pageSize: z.literal(20),
  results: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(searchKinds),
        title: z.string(),
        href: localHref,
        snippet: z.string(),
        breadcrumbs: z.array(z.object({ title: z.string(), href: localHref })),
      }),
    )
    .max(20),
});
export const searchKindLabels: Record<SearchResult['kind'], string> = {
  module: 'Phases',
  week: 'Weeks',
  day: 'Days',
  lesson: 'Study lessons',
  exercise: 'Exercises',
  task: 'Tasks',
  guide: 'Handbook',
  preparation: 'Preparation',
  resource: 'Resources',
};
export type SearchOptions = Record<
  'module' | 'week' | 'day',
  { value: string; label: string }[]
>;
/** Map normalized matches back to original Unicode ranges for escaped React text markup. */
export function searchHighlights(text: string, tokens: readonly string[]) {
  let normalized = '';
  const offsets: { start: number; end: number }[] = [];
  let offset = 0;
  for (const character of text) {
    const folded = normalizeSearch(character);
    for (let i = 0; i < folded.length; i++)
      offsets.push({ start: offset, end: offset + character.length });
    if (!folded && offsets.length)
      offsets[offsets.length - 1]!.end = offset + character.length;
    normalized += folded;
    offset += character.length;
  }
  const ranges: { start: number; end: number }[] = [];
  for (const token of tokens.filter(Boolean)) {
    let position = normalized.indexOf(token);
    while (position >= 0) {
      ranges.push({
        start: offsets[position]!.start,
        end: offsets[position + token.length - 1]!.end,
      });
      position = normalized.indexOf(token, position + 1);
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range.start <= last.end)
      last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor)
      parts.push({ text: text.slice(cursor, range.start), match: false });
    parts.push({ text: text.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), match: false });
  return parts;
}
