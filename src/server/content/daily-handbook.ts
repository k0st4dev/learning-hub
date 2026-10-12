import type { Catalog } from './read';
import { handbookGuide } from './handbook-guide.ts';

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
    const guide = handbookGuide(catalog, key);
    return guide ? [{ key, href: guide.route, title: guide.title }] : [];
  });
  return { links, unavailable: links.length !== guideKeys.length };
}

export type DailyHandbook = ReturnType<typeof dailyHandbookLinks>;
