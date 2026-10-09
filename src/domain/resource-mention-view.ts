import { z } from 'zod';
import { resourceEvidenceSchema } from './resource-binding-view';
import { resourceRequirements } from './resource-library';

const contextHref = z.string().regex(/^\/course\/software-engineer\//);
export const resourceParentViewSchema = z.object({
  resourceId: z.string(),
  title: z.string(),
  href: z.string().regex(/^\/resources\/[a-zA-Z0-9_-]+$/),
  originalUrl: z
    .url()
    .refine((value) => ['https:', 'http:'].includes(new URL(value).protocol)),
});
export const resourceMentionViewSchema = z
  .object({
    key: z.string().min(1),
    resourceId: z.string().min(1),
    displayName: z.string(),
    origin: z.literal('added-product-interpretation'),
    sourceId: z.string(),
    exactInstruction: z.string(),
    href: contextHref,
    sourceMappingHref: contextHref,
    title: z.string(),
    dayNumber: z.number().nullable(),
    requirementMode: z.enum(resourceRequirements),
    choiceGroup: z.string().nullable(),
    reason: z.string(),
    scope: z.object({
      module: z.string().nullable(),
      week: z.string().nullable(),
      day: z.string().nullable(),
    }),
    evidence: z.array(resourceEvidenceSchema).min(1),
    originReferences: z
      .array(
        z.object({
          useId: z.string(),
          title: z.string(),
          href: z.string().regex(/^\/resources\/[a-zA-Z0-9_-]+$/),
        }),
      )
      .min(1),
  })
  .refine(
    (row) => row.sourceMappingHref.split('#')[0] === row.href,
    'Named resource source context disagrees',
  );
export type ResourceMentionView = z.infer<typeof resourceMentionViewSchema>;
