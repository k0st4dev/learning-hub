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
