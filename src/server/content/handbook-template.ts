import type { CatalogPage } from './read';

export type SourcePrompt = {
  text: string;
  sourceId: string;
  anchor: string;
  title: string;
};

export function aiPromptTemplates(page: CatalogPage): SourcePrompt[] | null {
  if (page.item.kind !== 'guide' || page.item.stableKey !== 'guide-ai-protocol')
    return [];
  const prompts: SourcePrompt[] = [];
  for (let number = 70; number <= 77; number++) {
    const sourceId = 'p' + String(number).padStart(4, '0');
    const blocks = page.blocks.filter(
      (block) => block.sourceLocator === sourceId,
    );
    const block = blocks[0];
    const colon = block?.exactText.indexOf(': ') ?? -1;
    if (
      blocks.length !== 1 ||
      !block ||
      block.tableNumber !== null ||
      colon <= 0
    )
      return null;
    prompts.push({
      sourceId,
      text: block.exactText,
      title: block.exactText.slice(0, colon),
      anchor: block.anchor ?? 'source-' + sourceId,
    });
  }
  return prompts;
}

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
