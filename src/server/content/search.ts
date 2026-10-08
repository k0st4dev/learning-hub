import {
  searchQuerySchema,
  searchTokens,
  normalizeSearch,
  escapeLike,
  searchSnippet,
  type SearchResponse,
  type SearchResult,
} from '../../domain/search';
import type { Store } from '../db/connection';
import { ownedEnrollment } from '../learning/read';
import { AppError } from '../errors';
import {
  ensureSearchIndex,
  searchIndexTable,
  type ResourceProjection,
} from './search-index';

type Row = {
  id: string;
  kind: SearchResult['kind'];
  title: string;
  body: string;
  href: string;
  breadcrumbs: string;
};
export function searchCurriculum(
  store: Store,
  token: string | undefined,
  input: unknown,
  expectedStudentId?: string,
  projection: ResourceProjection = 'reviewed-bindings',
): SearchResponse {
  const enrollment = ownedEnrollment(store, token);
  if (!enrollment)
    throw new AppError(
      404,
      'ENROLLMENT_REQUIRED',
      'Start the course before searching its content.',
    );
  if (
    expectedStudentId !== undefined &&
    expectedStudentId !== enrollment.userId
  )
    throw new AppError(
      403,
      'ACCOUNT_CHANGED',
      'The signed-in account changed. Reload search for the current account.',
    );
  const query = searchQuerySchema.parse(input);
  return store.native
    .transaction((): SearchResponse => {
      ensureSearchIndex(store, enrollment.releaseId, projection);
      const table = searchIndexTable(projection);
      const tokens = searchTokens(query.q);
      const params: (string | number)[] = [enrollment.releaseId];
      const clauses = ['release_id = ?'];
      if (query.kind.length) {
        clauses.push('kind IN (' + query.kind.map(() => '?').join(',') + ')');
        params.push(...query.kind);
      }
      for (const [key, column] of [
        ['module', 'modules'],
        ['week', 'weeks'],
        ['day', 'days'],
      ] as const) {
        if (!query[key].length) continue;
        clauses.push(
          'EXISTS (SELECT 1 FROM json_each(' +
            column +
            ') WHERE value IN (' +
            query[key].map(() => '?').join(',') +
            '))',
        );
        params.push(...query[key]);
      }
      for (const token of tokens) {
        clauses.push("normalized_text LIKE ? ESCAPE '\\'");
        params.push('%' + escapeLike(token) + '%');
      }
      if (!tokens.length)
        return {
          releaseId: enrollment.releaseId,
          query,
          total: 0,
          pageSize: 20,
          results: [],
        };
      const where = clauses.join(' AND ');
      const total = (
        store.native
          .prepare(
            'SELECT count(*) AS n FROM temp.' + table + ' WHERE ' + where,
          )
          .get(...params) as { n: number }
      ).n;
      const titleQuery = normalizeSearch(query.q)
        .split(/\s+/u)
        .filter(Boolean)
        .join(' ');
      const ranking = `CASE WHEN normalized_title = ? THEN 0
      WHEN normalized_title LIKE ? ESCAPE '\\' THEN 1
      WHEN ${tokens.map(() => "normalized_title LIKE ? ESCAPE '\\'").join(' AND ')} THEN 2 ELSE 3 END`;
      const rows = store.native
        .prepare(
          'SELECT id, kind, title, body, href, breadcrumbs FROM temp.' +
            table +
            ' WHERE ' +
            where +
            ' ORDER BY ' +
            ranking +
            ', order_index, id LIMIT 20 OFFSET ?',
        )
        .all(
          ...params,
          titleQuery,
          escapeLike(titleQuery) + '%',
          ...tokens.map((token) => '%' + escapeLike(token) + '%'),
          (query.page - 1) * 20,
        ) as Row[];
      return {
        releaseId: enrollment.releaseId,
        query,
        total,
        pageSize: 20,
        results: rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          href: row.href,
          snippet: searchSnippet(row.body || row.title, tokens),
          breadcrumbs: JSON.parse(
            row.breadcrumbs,
          ) as SearchResult['breadcrumbs'],
        })),
      };
    })
    .deferred();
}
