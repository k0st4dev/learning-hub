import type { Catalog } from './read.ts';
import type { resourceMentionPresentation } from './resource-mentions.ts';
import { resourceMentionViewSchema } from '../../domain/resource-mention-view';

export function presentNamedMention(
  catalog: Catalog,
  mention: ReturnType<typeof resourceMentionPresentation>['mentions'][number],
) {
  return resourceMentionViewSchema.parse({
    ...mention,
    originReferences: mention.origins.map((origin) => {
      const use = catalog.uses.find((row) => row.id === origin.useId)!;
      const resource = catalog.resources.find(
        (row) => row.id === use.resourceId,
      )!;
      return {
        useId: use.id,
        title: resource.title,
        href: '/resources/' + resource.stableKey,
      };
    }),
  });
}
