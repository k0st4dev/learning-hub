import { z } from 'zod';
import type { Catalog } from './read.ts';
import {
  labelDigest,
  resourceLabelRelease,
  resourceLabelVersion,
} from './resource-label-contract.ts';

export const resourceBindingVersion = 'se-26w-v1-resource-bindings-v1';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().min(1);
export const resourceBindingSchema = z.strictObject({
  formatVersion: z.literal(1),
  interpretationId: z.literal(resourceBindingVersion),
  releaseId: z.literal(resourceLabelRelease),
  manifestSha256: hash,
  wordSha256: hash,
  proposalSha256: hash,
  labelInterpretationId: z.literal(resourceLabelVersion),
  labelSha256: hash,
  corrections: z
    .array(
      z.strictObject({
        useId: text,
        identitySha256: hash,
        originalResourceId: text,
        effectiveResourceId: text,
        sourceId: text,
        kind: z.enum(['top-foundations-context', 'fso-week-context']),
        reason: text,
        scope: z.strictObject({
          module: text,
          week: text,
          day: text.nullable(),
        }),
        evidenceRefs: z.array(text).min(2).max(20),
        ancestors: z
          .array(z.strictObject({ itemId: text, identitySha256: hash }))
          .min(2)
          .max(4),
      }),
    )
    .length(18),
});
export function resourceContextIdentity(
  item: Pick<
    Catalog['items'][number],
    | 'id'
    | 'releaseId'
    | 'stableKey'
    | 'kind'
    | 'parentId'
    | 'orderIndex'
    | 'title'
    | 'contentHash'
    | 'metadataJson'
  >,
) {
  return labelDigest([
    item.id,
    item.releaseId,
    item.stableKey,
    item.kind,
    item.parentId,
    item.orderIndex,
    item.title,
    item.contentHash,
    item.metadataJson,
  ]);
}
