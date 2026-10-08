import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  resourceRequirements,
  resourceTypes,
} from '../../domain/resource-library.ts';
import type { Catalog } from './read.ts';

export const resourceLabelVersion = 'se-26w-v1-resource-labels-v1';
export const resourceLabelRelease = 'se-26w-v1';
export const labelDigest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const textDigest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

// Only immutable imported fields. Reviewed destinations/link health are operational metadata.
export function resourceIdentity(
  row: Pick<
    Catalog['resources'][number],
    | 'id'
    | 'releaseId'
    | 'stableKey'
    | 'title'
    | 'originalUrl'
    | 'sourceName'
    | 'type'
    | 'descriptionMarkdown'
    | 'linkOrigin'
  >,
) {
  return labelDigest([
    row.id,
    row.releaseId,
    row.stableKey,
    row.title,
    row.originalUrl,
    row.sourceName,
    row.type,
    row.descriptionMarkdown,
    row.linkOrigin,
  ]);
}
export function resourceUseIdentity(row: Catalog['uses'][number]) {
  return labelDigest([
    row.id,
    row.releaseId,
    row.resourceId,
    row.contentItemId,
    row.assignedText,
    row.sectionLocator,
    row.requirementMode,
    row.orderIndex,
  ]);
}
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const nonempty = z.string().min(1);
const evidenceRefs = z.array(nonempty).min(1).max(20);
export const resourceLabelSchema = z.strictObject({
  formatVersion: z.literal(1),
  interpretationId: z.literal(resourceLabelVersion),
  releaseId: z.literal(resourceLabelRelease),
  manifestSha256: hash,
  wordSha256: hash,
  proposalSha256: hash,
  rules: z.record(nonempty, nonempty),
  resources: z
    .array(
      z.strictObject({
        resourceId: nonempty,
        identitySha256: hash,
        type: z.enum(resourceTypes),
        provider: nonempty.nullable(),
        confidence: z.enum(['high', 'medium']),
        category: nonempty,
        rationale: nonempty,
        evidenceRefs,
        ambiguity: z.boolean(),
      }),
    )
    .length(69),
  uses: z
    .array(
      z.strictObject({
        useId: nonempty,
        identitySha256: hash,
        sourceId: nonempty,
        requirementMode: z.enum(resourceRequirements),
        rule: nonempty,
        choiceGroup: nonempty.nullable(),
        evidenceRefs,
        caveats: z.array(nonempty).max(20),
        ambiguity: z.boolean(),
      }),
    )
    .length(290),
  evidence: z
    .array(
      z.strictObject({
        sourceId: nonempty,
        sha256: hash,
        table: z.number().int().positive().nullable(),
        row: z.number().int().nonnegative().nullable(),
        cell: z.number().int().nonnegative().nullable(),
      }),
    )
    .length(252),
});
export type ResourceLabels = z.infer<typeof resourceLabelSchema>;
