import type { Catalog } from './read';

const guideKeys = [
  'guide-how-to-study',
  'guide-ai-protocol',
  'guide-appendix-b',
  'guide-appendix-c',
  'guide-appendix-e',
] as const;

/** Added shortcuts into this published catalog; never a learning target. */
export function dailyHandbookLinks(catalog: Catalog) {
  const links = guideKeys.flatMap((key) => {
    const matches = catalog.items.filter((item) => item.stableKey === key);
    const item = matches[0];
    const href =
      '/course/software-engineer/guide/' + key.slice('guide-'.length);
    if (
      matches.length !== 1 ||
      !item ||
      item.kind !== 'guide' ||
      item.releaseId !== catalog.release.id ||
      !item.title.trim() ||
      item.route !== href ||
      catalog.items.filter((candidate) => candidate.route === href).length !== 1
    )
      return [];
    return [{ key, href, title: item.title }];
  });
  return { links, unavailable: links.length !== guideKeys.length };
}

export type DailyHandbook = ReturnType<typeof dailyHandbookLinks>;
