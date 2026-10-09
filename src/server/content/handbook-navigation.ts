import type { CatalogPage } from './read';

/** A reading view of original guide headings; never a study cursor or mapping. */
export function handbookNavigation(page: CatalogPage) {
  if (page.item.kind !== 'guide' || !page.item.stableKey.startsWith('guide-'))
    return null;
  const headingLevel = (style: string) =>
    /^Heading\s?([1-6])$/.exec(style)?.[1];
  const headings = page.blocks.filter(
    (block) =>
      block.tableNumber === null &&
      headingLevel(block.sourceStyle) &&
      block.exactText.trim(),
  );
  const selected = headings.length ? headings : page.blocks.slice(0, 1);
  const occupied = new Set(
    page.blocks.flatMap((b) => (b.anchor ? [b.anchor] : [])),
  );
  const sections = selected.map((block, index) => {
    let anchor = block.anchor;
    if (!anchor) {
      const base = 'guide-section-' + (index + 1);
      anchor = base;
      for (let suffix = 2; occupied.has(anchor); suffix++)
        anchor = base + '-' + suffix;
      occupied.add(anchor);
    }
    const level = headingLevel(block.sourceStyle);
    return {
      sourceId: block.sourceLocator,
      anchor,
      label: level ? block.exactText : null,
      headingLevel: level ? Math.min(Number(level) + 1, 6) : null,
    };
  });
  return {
    sections,
    blocks: page.blocks.map((block) => {
      const section = sections.find((s) => s.sourceId === block.sourceLocator);
      return section ? { ...block, anchor: section.anchor } : block;
    }),
  };
}
