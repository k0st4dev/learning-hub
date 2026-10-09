import { z } from 'zod';
import {
  resourceTypes,
  resourceRequirements,
} from '../../domain/resource-library.ts';
import {
  resourceLabelRelease,
  resourceLabelVersion,
} from './resource-label-contract.ts';
import { resourceBindingVersion } from './resource-binding-contract.ts';

export const resourceMentionVersion = 'se-26w-v1-resource-mentions-v1';
export const resourceMentionProposalSha256 =
  '517b6b73e0104ca0c2ff9e6b961c61ecbafbe3956aacab25c71fdcb0e3ac22e8';
const text = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const key = text.regex(/^[a-zA-Z0-9_-]+$/);
export const resourceMentionSchema = z.strictObject({
  formatVersion: z.literal(1),
  interpretationId: z.literal(resourceMentionVersion),
  releaseId: z.literal(resourceLabelRelease),
  manifestSha256: hash,
  wordSha256: hash,
  proposalSha256: z.literal(resourceMentionProposalSha256),
  labelInterpretationId: z.literal(resourceLabelVersion),
  labelSha256: hash,
  bindingInterpretationId: z.literal(resourceBindingVersion),
  bindingSha256: hash,
  resources: z
    .array(
      z.strictObject({
        id: text,
        stableKey: key,
        title: text,
        action: z.enum(['reuse-existing-resource', 'derived-resource']),
        originalIdentitySha256: hash.nullable(),
        type: z.enum(resourceTypes),
        provider: text.nullable(),
        parent: z
          .strictObject({
            resourceId: text,
            identitySha256: hash,
            originalUrl: z.url(),
          })
          .nullable(),
      }),
    )
    .length(12),
  mentions: z
    .array(
      z.strictObject({
        candidateId: text,
        key,
        resourceId: text,
        displayName: text,
        sourceId: text,
        contentItemId: text,
        exactInstruction: text,
        sourceMappingHref: text,
        requirementMode: z.enum(resourceRequirements),
        choiceGroup: text.nullable(),
        reason: text,
        scope: z.strictObject({
          module: text,
          week: text,
          day: text.nullable(),
        }),
        origins: z
          .array(z.strictObject({ useId: text, identitySha256: hash }))
          .min(1)
          .max(2),
        ancestors: z
          .array(z.strictObject({ itemId: text, identitySha256: hash }))
          .min(2)
          .max(4),
        evidenceRefs: z.array(text).min(1).max(20),
      }),
    )
    .length(13),
  evidence: z
    .array(
      z.strictObject({
        sourceId: text,
        sha256: hash,
        table: z.number().int().positive().nullable(),
        row: z.number().int().nonnegative().nullable(),
        cell: z.number().int().nonnegative().nullable(),
      }),
    )
    .length(18),
});
export type ResourceMentions = z.infer<typeof resourceMentionSchema>;
