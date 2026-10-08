import { eq } from 'drizzle-orm';
import {
  normalizeSearch,
  searchKinds,
  type SearchBreadcrumb,
} from '../../domain/search.ts';
import type { Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
import { AppError } from '../errors.ts';
import { readCatalog, type Catalog } from './read.ts';
import { courseNavigation } from './navigation.ts';
import { resourceBindingPresentation } from './resource-bindings.ts';

// Internal staging choice only; no request parameter or persistent feature flag.
export type ResourceProjection = 'original' | 'reviewed-bindings';
export function searchIndexTable(projection: ResourceProjection = 'original') {
  return projection === 'reviewed-bindings'
    ? 'curriculum_search_bindings'
    : 'curriculum_search';
}

// Connection-local derived content only: no student data and no persistent schema change.
const indexed = new WeakMap<
  Store,
  Map<string, { manifest: string; count: number }>
>();
export function ensureSearchIndex(
  store: Store,
  releaseId: string,
  projection: ResourceProjection = 'original',
) {
  const table = searchIndexTable(projection);
  const cacheKey = releaseId + ':' + projection;
  const release = store.orm
    .select()
    .from(s.courseRelease)
    .where(eq(s.courseRelease.id, releaseId))
    .get();
  if (
    !release ||
    release.status !== 'published' ||
    releaseId.startsWith('development-')
  )
    throw new AppError(
      503,
      'CONTENT_UNAVAILABLE',
      'Your enrolled curriculum is unavailable. Preserve your data and retry.',
    );
  // Revalidate reviewed bindings even on a warm connection before returning indexed text.
  const reviewedCatalog =
    projection === 'reviewed-bindings' ? readCatalog(store, releaseId) : null;
  if (projection === 'reviewed-bindings' && !reviewedCatalog)
    throw new AppError(
      503,
      'CONTENT_UNAVAILABLE',
      'Your enrolled resources are unavailable.',
    );
  const bindings = reviewedCatalog
    ? resourceBindingPresentation(reviewedCatalog)
    : undefined;
  const cached = indexed.get(store)?.get(cacheKey);
  // A caller's outer transaction may have rolled back TEMP writes after derivation.
  if (
    cached?.manifest === release.manifestSha256 &&
    store.native
      .prepare('SELECT name FROM sqlite_temp_master WHERE name=?')
      .get(table) &&
    (
      store.native
        .prepare(
          'SELECT count(*) AS n FROM temp.' + table + ' WHERE release_id=?',
        )
        .get(releaseId) as { n: number }
    ).n === cached.count
  )
    return;
  const catalog = reviewedCatalog ?? readCatalog(store, releaseId);
  if (!catalog)
    throw new AppError(
      503,
      'CONTENT_UNAVAILABLE',
      'Your enrolled curriculum is unavailable.',
    );
  populate(store, catalog, table, bindings);
  const releases =
    indexed.get(store) ??
    new Map<string, { manifest: string; count: number }>();
  releases.set(cacheKey, {
    manifest: release.manifestSha256,
    count: catalog.items.length + catalog.resources.length,
  });
  indexed.set(store, releases);
}
function populate(
  store: Store,
  catalog: Catalog,
  table: ReturnType<typeof searchIndexTable>,
  bindings?: ReturnType<typeof resourceBindingPresentation>,
) {
  const navigation = courseNavigation(catalog);
  const byId = new Map(catalog.items.map((item) => [item.id, item]));
  const blocks = new Map(
    catalog.blocks.map((block) => [block.id, block.exactText]),
  );
  const mapped = new Map<string, string[]>();
  for (const mapping of catalog.mappings) {
    if (mapping.mappingKind === 'metadata') continue;
    const texts = mapped.get(mapping.contentItemId) ?? [];
    texts.push(blocks.get(mapping.sourceBlockId) ?? '');
    mapped.set(mapping.contentItemId, texts);
  }
  const paths = new Map<string, string[]>();
  function lineage(id: string): string[] {
    const existing = paths.get(id);
    if (existing) return existing;
    const item = byId.get(id);
    if (!item) throw new Error('Missing search context');
    const chain = navigation
      .forItem(id)!
      .breadcrumbs.map((ancestor) => ancestor.id);
    paths.set(id, chain);
    return chain;
  }
  function context(ids: string[], kind: string) {
    return [
      ...new Set(
        ids
          .flatMap(lineage)
          .filter((id) => byId.get(id)?.kind === kind)
          .map((id) => byId.get(id)!.stableKey),
      ),
    ];
  }
  function breadcrumbs(id: string): SearchBreadcrumb[] {
    return navigation
      .forItem(id)!
      .breadcrumbs.map((item) => ({ title: item.title, href: item.route }));
  }
  function safeRoute(route: string) {
    if (
      !/^\/(?:course\/software-engineer(?:[\/#]|$)|resources(?:[\/#]|$)|progress\/scorecard$)/.test(
        route,
      )
    )
      throw new Error('Invalid search destination');
    return route;
  }
  // preorder number follows the actual hierarchy, not lexical day IDs or row insertion order.
  const ordered: string[] = [];
  function visit(parent: string | null) {
    for (const item of navigation.children(parent)) {
      ordered.push(item.id);
      visit(item.id);
    }
  }
  visit(null);
  const order = new Map(ordered.map((id, index) => [id, index]));
  store.native.exec(`CREATE TEMP TABLE IF NOT EXISTS ${table} (
    release_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL,
    title TEXT NOT NULL, body TEXT NOT NULL, normalized_title TEXT NOT NULL,
    normalized_text TEXT NOT NULL, href TEXT NOT NULL, order_index INTEGER NOT NULL,
    breadcrumbs TEXT NOT NULL, modules TEXT NOT NULL, weeks TEXT NOT NULL, days TEXT NOT NULL,
    PRIMARY KEY(release_id, id)
  )`);
  store.native.transaction(() => {
    store.native
      .prepare('DELETE FROM temp.' + table + ' WHERE release_id = ?')
      .run(catalog.release.id);
    const insert = store.native.prepare(
      'INSERT INTO temp.' +
        table +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    function add(
      id: string,
      kind: string,
      title: string,
      body: string,
      href: string,
      position: number,
      parents: string[],
      crumbs: SearchBreadcrumb[],
    ) {
      insert.run(
        catalog.release.id,
        id,
        kind,
        title,
        body,
        normalizeSearch(title),
        normalizeSearch(title + '\n' + body),
        safeRoute(href),
        position,
        JSON.stringify(crumbs),
        JSON.stringify(context(parents, 'module')),
        JSON.stringify(context(parents, 'week')),
        JSON.stringify(context(parents, 'day')),
      );
    }
    for (const item of catalog.items) {
      if (!searchKinds.some((kind) => kind === item.kind))
        throw new Error('Invalid search kind');
      const body = [
        ...new Set(
          [item.bodyMarkdown, ...(mapped.get(item.id) ?? [])].filter(Boolean),
        ),
      ].join('\n\n');
      add(
        item.id,
        item.kind,
        item.title,
        body,
        item.route,
        order.get(item.id)!,
        [item.id],
        breadcrumbs(item.id),
      );
    }
    for (const resource of catalog.resources) {
      const uses = catalog.uses.filter(
        (use) =>
          (bindings?.uses.get(use.id)?.effectiveResourceId ??
            use.resourceId) === resource.id,
      );
      const parents = [...new Set(uses.map((use) => use.contentItemId))];
      const body = [
        ...new Set([
          resource.sourceName,
          resource.descriptionMarkdown,
          resource.originalUrl ?? '',
          ...uses.map((use) => use.assignedText),
        ]),
      ].join('\n\n');
      const first = parents
        .slice()
        .sort((a, b) => order.get(a)! - order.get(b)!)[0];
      add(
        resource.id,
        'resource',
        resource.title,
        body,
        '/resources/' + resource.stableKey,
        first ? order.get(first)! : ordered.length,
        parents,
        first
          ? breadcrumbs(first)
          : [{ title: 'Resources', href: '/resources' }],
      );
    }
  })();
}
