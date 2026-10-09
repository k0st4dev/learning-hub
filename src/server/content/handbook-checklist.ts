import type { CatalogPage } from './read';

/** Exact Appendix B labels; these are advisory checks, never progress tasks. */
export function gitReviewItems(page: CatalogPage) {
  if (page.item.kind !== 'guide' || page.item.stableKey !== 'guide-appendix-b')
    return null;
  const blocks = [];
  for (let number = 2229; number <= 2234; number++) {
    const ref = 'p' + number;
    const matches = page.blocks.filter((block) => block.sourceLocator === ref);
    const block = matches[0];
    if (
      matches.length !== 1 ||
      !block?.exactText.trim() ||
      block.tableNumber !== null
    )
      return null;
    blocks.push(block);
  }
  return blocks
    .slice(2)
    .map((block) => ({ id: block.sourceLocator, text: block.exactText }));
}
