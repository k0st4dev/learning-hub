import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
const routeMetadata = z.looseObject({ route: z.string().startsWith('/') });
export function readCatalog(store: Store, releaseId: string) {
  const release = store.orm
    .select()
    .from(s.courseRelease)
    .where(eq(s.courseRelease.id, releaseId))
    .get();
  if (!release || release.status !== 'published') return null;
  const items = store.orm
    .select()
    .from(s.contentItem)
    .where(eq(s.contentItem.releaseId, releaseId))
    .all()
    .map((item) => ({
      ...item,
      route: routeMetadata.parse(JSON.parse(item.metadataJson)).route,
    }));
  return {
    release,
    items,
    blocks: store.orm
      .select()
      .from(s.sourceBlock)
      .where(eq(s.sourceBlock.releaseId, releaseId))
      .all(),
    mappings: store.orm
      .select()
      .from(s.sourceMapping)
      .where(eq(s.sourceMapping.releaseId, releaseId))
      .all(),
    resources: store.orm
      .select()
      .from(s.resource)
      .where(eq(s.resource.releaseId, releaseId))
      .all(),
    uses: store.orm
      .select()
      .from(s.resourceUse)
      .where(eq(s.resourceUse.releaseId, releaseId))
      .all(),
    days: store.orm
      .select()
      .from(s.courseDay)
      .all()
      .filter((d) => items.some((item) => item.id === d.itemId)),
    weeks: store.orm
      .select()
      .from(s.courseWeek)
      .all()
      .filter((w) => items.some((item) => item.id === w.itemId)),
    rules: store.orm
      .select()
      .from(s.exerciseTask)
      .all()
      .filter((t) => items.some((item) => item.id === t.itemId)),
  };
}
export type Catalog = NonNullable<ReturnType<typeof readCatalog>>;
export function catalogPage(catalog: Catalog, route: string) {
  const item = catalog.items.find((item) => item.route === route);
  if (!item) return null;
  const mappings = catalog.mappings.filter(
    (m) => m.websiteLocation.split('#')[0] === route,
  );
  const anchors = new Set<string>();
  const blocks = catalog.blocks
    .filter((b) => mappings.some((m) => m.sourceBlockId === b.id))
    .map((block) => {
      const anchor = mappings
        .find((m) => m.sourceBlockId === block.id)
        ?.websiteLocation.split('#')[1];
      const uniqueAnchor = anchor && !anchors.has(anchor) ? anchor : null;
      if (anchor) anchors.add(anchor);
      return { ...block, anchor: uniqueAnchor };
    });
  return {
    item,
    blocks,
    children: catalog.items
      .filter((child) => child.parentId === item.id)
      .sort((a, b) => a.orderIndex - b.orderIndex),
    uses: catalog.uses.filter((use) => use.contentItemId === item.id),
  };
}
export type CatalogPage = NonNullable<ReturnType<typeof catalogPage>>;
