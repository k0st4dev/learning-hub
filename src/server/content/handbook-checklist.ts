import type { CatalogPage } from './read';
import { handbookNavigation } from './handbook-navigation.ts';

/** Exact Appendix B labels; these are advisory checks, never progress tasks. */
export function gitReviewItems(page: CatalogPage) {
  return reviewItems(page, 'guide-appendix-b', 2229, 2234, 2);
}

/** One concept's exact self-checks; checking these cannot establish mastery. */
export function conceptReviewItems(page: CatalogPage) {
  return reviewItems(page, 'guide-appendix-c', 2235, 2242, 1);
}

/** Preserve the source's seven numbered steps; marks confer no AI permission. */
export function stuckReviewItems(page: CatalogPage) {
  const items = reviewItems(page, 'guide-appendix-e', 2334, 2341, 1);
  return items?.every((item, index) => item.text.startsWith(`${index + 1}. `))
    ? items
    : null;
}

/** Link only to existing original guidance in the enrolled catalog. */
export function stuckReviewLinks(page: CatalogPage | null) {
  const links: { kind: 'protocol' | 'hints'; href: string }[] = [];
  if (
    page?.item.kind !== 'guide' ||
    page.item.stableKey !== 'guide-ai-protocol'
  )
    return links;
  if (
    page.blocks.some(
      (block) => block.sourceLocator === 'p0054' && block.exactText.trim(),
    )
  )
    links.push({ kind: 'protocol', href: page.item.route });
  const hintSection = handbookNavigation(page)?.sections.find(
    (section) => section.sourceId === 'p0062',
  );
  if (hintSection)
    links.push({
      kind: 'hints',
      href: page.item.route + '#' + encodeURIComponent(hintSection.anchor),
    });
  return links;
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
