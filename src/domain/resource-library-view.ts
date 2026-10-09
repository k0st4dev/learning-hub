import { z } from 'zod';
import {
  resourceMentionViewSchema,
  resourceParentViewSchema,
} from './resource-mention-view';
import {
  resourceBindingViewSchema,
  resourceEvidenceSchema,
} from './resource-binding-view';
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
const sourceEvidence = resourceEvidenceSchema;
const interpretation = z.object({
  origin: z.enum(['added-product-interpretation', 'imported-metadata']),
  version: z.string().nullable(),
  ambiguity: z.boolean(),
  evidence: z.array(sourceEvidence),
});
const use = z.object({
  id: z.string(),
  resourceId: z.string(),
  binding: resourceBindingViewSchema,
  assignedText: z.string(),
  sectionLocator: z.string().nullable(),
  requirementMode: z.enum(resourceRequirements),
  href: localHref,
  title: z.string(),
  day: z.string().nullable(),
  dayNumber: z.number().nullable(),
  breadcrumbs: z.array(z.object({ title: z.string(), href: localHref })),
  effective: z.object({
    requirementMode: z.enum(resourceRequirements),
    resourceId: z.string(),
  }),
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
  inventory: z
    .object({
      originalResources: z.number().int().nonnegative(),
      derivedResources: z.number().int().nonnegative(),
      originalUses: z.number().int().nonnegative(),
      derivedMentions: z.number().int().nonnegative(),
    })
    .optional(),
  options: z.object({
    source: z.array(option),
    module: z.array(option),
    week: z.array(option),
    day: z.array(option),
  }),
  results: z
    .array(
      z
        .object({
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
          originalUses: z.array(use).default([]),
          matchingUseIds: z.array(z.string()),
          relatedDays: z.array(
            z.object({
              title: z.string(),
              href: localHref,
              dayNumber: z.number(),
            }),
          ),
          recordOrigin: z
            .enum(['imported-resource', 'added-product-interpretation'])
            .optional(),
          parent: resourceParentViewSchema.nullable().optional(),
          derivedMentions: z.array(resourceMentionViewSchema).optional(),
          matchingMentionKeys: z.array(z.string()).optional(),
        })
        .refine(
          (resource) =>
            resource.uses.every(
              (use) =>
                use.effective.resourceId === resource.id &&
                use.binding.originalResourceId === use.resourceId &&
                use.binding.effectiveResourceId === use.effective.resourceId,
            ) &&
            resource.originalUses.every(
              (use) =>
                use.resourceId === resource.id &&
                use.binding.originalResourceId === use.resourceId &&
                use.binding.effectiveResourceId === use.effective.resourceId,
            ) &&
            new Set(resource.uses.map((use) => use.id)).size ===
              resource.uses.length &&
            new Set(resource.originalUses.map((use) => use.id)).size ===
              resource.originalUses.length &&
            resource.matchingUseIds.every((id) =>
              resource.uses.some((use) => use.id === id),
            ) &&
            (resource.derivedMentions ?? []).every(
              (row) => row.resourceId === resource.id,
            ) &&
            new Set((resource.derivedMentions ?? []).map((row) => row.key))
              .size === (resource.derivedMentions ?? []).length &&
            (resource.matchingMentionKeys ?? []).every((key) =>
              (resource.derivedMentions ?? []).some((row) => row.key === key),
            ) &&
            (resource.recordOrigin !== 'added-product-interpretation' ||
              (resource.uses.length === 0 &&
                resource.originalUses.length === 0 &&
                resource.originalUrl === null &&
                resource.resolvedUrl === null &&
                (resource.derivedMentions ?? []).length > 0)),
          'Resource assignment grouping disagrees',
        ),
    )
    .max(25),
});
export type ResourceLibraryView = z.infer<typeof resourceLibraryViewSchema>;
export const resourceDetailViewSchema = z.object({
  releaseId: z.string(),
  resource: resourceLibraryViewSchema.shape.results.element,
});
