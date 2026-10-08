import { z } from 'zod';
import {
  resourceQuerySchema,
  resourceRequirements,
  resourceTypes,
} from './resource-library';

export const resourceTypeLabels: Record<
  (typeof resourceTypes)[number],
  string
> = {
  documentation: 'Documentation',
  article: 'Article / tutorial',
  video: 'Video',
  course: 'Course',
  tool: 'Tool',
  reference: 'Reference',
  practice: 'Practice website',
  guide: 'Internal guide',
};
export const resourceRequirementLabels: Record<
  (typeof resourceRequirements)[number],
  string
> = {
  required: 'Required section',
  optional: 'Optional supplement',
  reference: 'Reference',
  conditional: 'Conditional',
};
const localHref = z
  .string()
  .regex(/^\/(?:resources|course\/software-engineer)(?:[/?#]|$)/);
const externalHref = z
  .url()
  .refine((value) => ['https:', 'http:'].includes(new URL(value).protocol));
const sourceEvidence = z.object({
  sourceId: z.string(),
  exactText: z.string(),
  sha256: z.string(),
  table: z.number().nullable(),
  row: z.number().nullable(),
  cell: z.number().nullable(),
});
const interpretation = z.object({
  origin: z.enum(['added-product-interpretation', 'imported-metadata']),
  version: z.string().nullable(),
  ambiguity: z.boolean(),
  evidence: z.array(sourceEvidence),
});
const use = z.object({
  id: z.string(),
  assignedText: z.string(),
  sectionLocator: z.string().nullable(),
  requirementMode: z.enum(resourceRequirements),
  href: localHref,
  title: z.string(),
  day: z.string().nullable(),
  dayNumber: z.number().nullable(),
  breadcrumbs: z.array(z.object({ title: z.string(), href: localHref })),
  effective: z.object({ requirementMode: z.enum(resourceRequirements) }),
  interpretation: interpretation.extend({
    sourceId: z.string().nullable(),
    ruleDescription: z.string().nullable(),
    choiceGroup: z.string().nullable(),
    caveats: z.array(z.string()),
  }),
});
const option = z.object({ value: z.string(), label: z.string() });
// Validate the fields rendered in the browser, retaining original text as escaped React strings.
export const resourceLibraryViewSchema = z.object({
  releaseId: z.string(),
  query: resourceQuerySchema,
  pageSize: z.literal(25),
  total: z.number().int().nonnegative(),
  options: z.object({
    source: z.array(option),
    module: z.array(option),
    week: z.array(option),
    day: z.array(option),
  }),
  results: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        href: localHref,
        descriptionMarkdown: z.string(),
        originalUrl: externalHref.nullable(),
        resolvedUrl: externalHref.nullable(),
        sourceName: z.string(),
        type: z.enum(resourceTypes),
        linkOrigin: z.enum(['source', 'supplemental', 'unresolved']),
        linkStatus: z.string(),
        checkedAt: z.number().nullable(),
        effective: z.object({
          type: z.enum(resourceTypes),
          provider: z.string().nullable(),
          sourceFilterKey: z.string(),
        }),
        interpretation: interpretation.extend({
          confidence: z.string().nullable(),
          rationale: z.string().nullable(),
          category: z.string().nullable(),
        }),
        uses: z.array(use),
        matchingUseIds: z.array(z.string()),
        relatedDays: z.array(
          z.object({
            title: z.string(),
            href: localHref,
            dayNumber: z.number(),
          }),
        ),
      }),
    )
    .max(25),
});
export type ResourceLibraryView = z.infer<typeof resourceLibraryViewSchema>;
