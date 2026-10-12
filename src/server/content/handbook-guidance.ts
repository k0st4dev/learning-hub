import type { Catalog, CatalogPage } from './read';
import { handbookGuide } from './handbook-guide.ts';
import { handbookNavigation } from './handbook-navigation.ts';

/** Related reading and branch anchors only; no permission or saved choice. */
export function handbookGuidance(catalog: Catalog, page: CatalogPage) {
  const kind =
    page.item.stableKey === 'guide-appendix-f'
      ? 'ai'
      : page.item.stableKey === 'guide-appendix-c'
        ? 'concept'
        : page.item.stableKey === 'guide-appendix-g'
          ? 'branches'
          : null;
  if (
    !kind ||
    page.item.kind !== 'guide' ||
    page.item.releaseId !== catalog.release.id ||
    handbookGuide(catalog, page.item.stableKey)?.id !== page.item.id
  )
    return null;
  const blocks = handbookNavigation(page)!.blocks;
  const relatedKeys =
    kind === 'ai'
      ? ['guide-appendix-c', 'guide-ai-protocol']
      : kind === 'concept'
        ? ['guide-appendix-f', 'guide-ai-protocol']
        : [];
  const links = relatedKeys.flatMap((key) => {
    const guide = handbookGuide(catalog, key);
    return guide ? [{ href: guide.route, title: guide.title }] : [];
  });
  const branches: {
    sourceId: string;
    anchor: string;
    label: string;
    headingLevel: null;
  }[] = [];
  const occupied = new Set(
    blocks.flatMap((block) => (block.anchor ? [block.anchor] : [])),
  );
  if (kind === 'branches') {
    for (const sourceId of ['p2351', 'p2352', 'p2353', 'p2354']) {
      const matches = blocks.filter(
        (block) => block.sourceLocator === sourceId,
      );
      const block = matches[0];
      if (
        matches.length !== 1 ||
        !block?.exactText.trim() ||
        block.tableNumber !== null
      )
        continue;
      let anchor = block.anchor;
      if (!anchor) {
        const base = 'handbook-branch-' + sourceId;
        anchor = base;
        for (let suffix = 2; occupied.has(anchor); suffix++)
          anchor = base + '-' + suffix;
        occupied.add(anchor);
      }
      branches.push({
        sourceId,
        anchor,
        label: block.exactText,
        headingLevel: null,
      });
    }
  }
  return {
    kind,
    links,
    branches,
    unavailable:
      links.length !== relatedKeys.length ||
      (kind === 'branches' && branches.length !== 4),
    blocks: blocks.map((block) => {
      const branch = branches.find(
        (entry) => entry.sourceId === block.sourceLocator,
      );
      return branch ? { ...block, anchor: branch.anchor } : block;
    }),
  };
}
export type HandbookGuidanceModel = NonNullable<
  ReturnType<typeof handbookGuidance>
>;
