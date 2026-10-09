import type { CatalogPage } from './read';

/** Exact Appendix B labels; these are advisory checks, never progress tasks. */
export function gitReviewItems(page: CatalogPage) {
  return reviewItems(page, 'guide-appendix-b', 2229, 2234, 2);
}

/** One concept's exact self-checks; checking these cannot establish mastery. */
export function conceptReviewItems(page: CatalogPage) {
  return reviewItems(page, 'guide-appendix-c', 2235, 2242, 1);
}

function reviewItems(
  page: CatalogPage,
  guideKey: string,
  first: number,
  last: number,
  guidanceBlocks: number,
) {
  if (page.item.kind !== 'guide' || page.item.stableKey !== guideKey)
    return null;
  const blocks = [];
  for (let number = first; number <= last; number++) {
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
    .slice(guidanceBlocks)
    .map((block) => ({ id: block.sourceLocator, text: block.exactText }));
}
