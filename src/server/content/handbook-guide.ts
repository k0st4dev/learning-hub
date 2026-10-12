import type { Catalog } from './read';

/** Resolve only a unique canonical guide in this published course version. */
export function handbookGuide(catalog: Catalog, key: string) {
  if (
    !/^guide-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) ||
    catalog.release.status !== 'published'
  )
    return null;
  const matches = catalog.items.filter((item) => item.stableKey === key);
  const item = matches[0];
  const route = '/course/software-engineer/guide/' + key.slice('guide-'.length);
  if (
    matches.length !== 1 ||
    !item ||
    item.kind !== 'guide' ||
    item.releaseId !== catalog.release.id ||
    !item.title.trim() ||
    item.route !== route ||
    catalog.items.filter((candidate) => candidate.route === route).length !== 1
  )
    return null;
  return item;
}
