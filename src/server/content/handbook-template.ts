import type { CatalogPage } from './read';

// A view of the mapped source block, never a second authored template.
export function appendixATemplate(page: CatalogPage) {
  if (page.item.kind !== 'guide' || page.item.stableKey !== 'guide-appendix-a')
    return null;
  const blocks = page.blocks.filter((block) => block.sourceLocator === 'p2228');
  const block = blocks[0];
  if (blocks.length !== 1 || !block?.exactText || block.tableNumber !== null)
    return null;
  return {
    text: block.exactText,
    sourceId: block.sourceLocator,
    anchor: block.anchor ?? 'source-p2228',
  };
}
