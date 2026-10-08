import { z } from 'zod';

export const resourceEvidenceSchema = z.object({
  sourceId: z.string(),
  exactText: z.string(),
  sha256: z.string(),
  table: z.number().nullable(),
  row: z.number().nullable(),
  cell: z.number().nullable(),
});
const reference = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  href: z.string().regex(/^\/resources\/[a-zA-Z0-9_-]+$/),
});
export const resourceBindingViewSchema = z
  .object({
    originalResourceId: z.string(),
    effectiveResourceId: z.string(),
    originalResource: reference,
    effectiveResource: reference,
    changed: z.boolean(),
    interpretation: z.object({
      origin: z.enum(['added-product-interpretation', 'imported-metadata']),
      version: z.string().nullable(),
      sourceId: z.string().nullable(),
      kind: z.enum(['top-foundations-context', 'fso-week-context']).nullable(),
      reason: z.string().nullable(),
      evidence: z.array(resourceEvidenceSchema),
    }),
  })
  .refine(
    (row) =>
      row.originalResourceId === row.originalResource.id &&
      row.effectiveResourceId === row.effectiveResource.id &&
      row.changed === (row.originalResourceId !== row.effectiveResourceId),
    'Resource connection identities disagree',
  );
export type ResourceBindingView = z.infer<typeof resourceBindingViewSchema>;
export function isHistoricalBindingCaveat(
  binding: ResourceBindingView,
  text: string,
) {
  return (
    binding.changed &&
    text ===
      'Parent binding correction proposed separately; no runtime relationship has changed.'
  );
}
