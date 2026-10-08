import frozen from '../../../content/interpretations/se-26w-v1-resource-labels-v1.json' with { type: 'json' };
import { resourceProviderKey } from '../../domain/resource-library.ts';
import { AppError } from '../errors.ts';
import type { Catalog } from './read.ts';
import {
  labelDigest,
  resourceIdentity,
  resourceUseIdentity,
  resourceLabelSchema,
  resourceLabelRelease,
  resourceLabelVersion,
  textDigest,
} from './resource-label-contract.ts';

// Explicit application-version binding. An approved revision needs a new file/ID and reviewed pin.
export const resourceLabelSha256 =
  'c326c2b849fc4e41eaae4d7a27bdba09e0ccad49c31cde73e119af9be754cee3';
function unavailable(): never {
  throw new AppError(
    503,
    'RESOURCE_LABELS_UNAVAILABLE',
    'Reviewed resource labels do not match your curriculum. Verify the application and enrolled release.',
  );
}

// Pure validation is also used by tests; runtime always supplies the static file and fixed pin below.
export function validateResourceLabels(
  catalog: Catalog,
  input: unknown,
  trustedSha256: string,
) {
  const parsed = resourceLabelSchema.safeParse(input);
  if (!parsed.success) unavailable();
  if (labelDigest(input) !== trustedSha256) unavailable();
  const labels = parsed.data;
  if (
    catalog.release.status !== 'published' ||
    catalog.release.id !== labels.releaseId ||
    catalog.release.manifestSha256 !== labels.manifestSha256 ||
    catalog.release.sourceSha256 !== labels.wordSha256
  )
    unavailable();
  const resources = new Map(catalog.resources.map((row) => [row.id, row]));
  const uses = new Map(catalog.uses.map((row) => [row.id, row]));
  const blocks = new Map(catalog.blocks.map((row) => [row.sourceLocator, row]));
  if (
    catalog.resources.length !== labels.resources.length ||
    resources.size !== labels.resources.length ||
    catalog.uses.length !== labels.uses.length ||
    uses.size !== labels.uses.length ||
    new Set(labels.resources.map((row) => row.resourceId)).size !==
      labels.resources.length ||
    new Set(labels.uses.map((row) => row.useId)).size !== labels.uses.length ||
    new Set(labels.evidence.map((row) => row.sourceId)).size !==
      labels.evidence.length ||
    blocks.size !== catalog.blocks.length
  )
    unavailable();
  const evidence = new Map(
    labels.evidence.map((row) => {
      const block = blocks.get(row.sourceId);
      if (
        !block ||
        block.releaseId !== labels.releaseId ||
        block.textSha256 !== row.sha256 ||
        textDigest(block.exactText) !== row.sha256 ||
        block.tableNumber !== row.table ||
        block.rowNumber !== row.row ||
        block.cellNumber !== row.cell
      )
        unavailable();
      return [row.sourceId, { ...row, exactText: block.exactText }] as const;
    }),
  );
  function cited(refs: string[]) {
    if (new Set(refs).size !== refs.length) unavailable();
    return refs.map((ref) => {
      const item = evidence.get(ref);
      if (!item) unavailable();
      return item;
    });
  }
  for (const row of labels.resources) {
    const raw = resources.get(row.resourceId);
    if (
      !raw ||
      raw.releaseId !== labels.releaseId ||
      resourceIdentity(raw) !== row.identitySha256
    )
      unavailable();
    cited(row.evidenceRefs);
  }
  for (const row of labels.uses) {
    const raw = uses.get(row.useId);
    if (
      !raw ||
      raw.releaseId !== labels.releaseId ||
      !resources.has(raw.resourceId) ||
      resourceUseIdentity(raw) !== row.identitySha256 ||
      !row.evidenceRefs.includes(row.sourceId) ||
      !Object.hasOwn(labels.rules, row.rule)
    )
      unavailable();
    cited(row.evidenceRefs);
  }
  return { labels, cited };
}

export function resourceLabelPresentation(catalog: Catalog) {
  const approved =
    catalog.release.id === resourceLabelRelease
      ? validateResourceLabels(catalog, frozen, resourceLabelSha256)
      : null;
  const resourceLabels = new Map(
    approved?.labels.resources.map((row) => [row.resourceId, row]),
  );
  const useLabels = new Map(
    approved?.labels.uses.map((row) => [row.useId, row]),
  );
  const origin = approved
    ? ('added-product-interpretation' as const)
    : ('imported-metadata' as const);
  const version = approved ? resourceLabelVersion : null;
  return {
    status: { origin, version, sha256: approved ? resourceLabelSha256 : null },
    resources: new Map(
      catalog.resources.map((raw) => {
        const label = resourceLabels.get(raw.id);
        const provider = label ? label.provider : raw.sourceName;
        return [
          raw.id,
          {
            effective: {
              type: label?.type ?? raw.type,
              provider,
              sourceFilterKey: label
                ? resourceProviderKey(provider)
                : raw.sourceName,
            },
            interpretation: {
              origin,
              version,
              confidence: label?.confidence ?? null,
              category: label?.category ?? null,
              rationale: label?.rationale ?? null,
              ambiguity: label?.ambiguity ?? false,
              evidence:
                label && approved ? approved.cited(label.evidenceRefs) : [],
            },
          },
        ] as const;
      }),
    ),
    uses: new Map(
      catalog.uses.map((raw) => {
        const label = useLabels.get(raw.id);
        return [
          raw.id,
          {
            effective: {
              requirementMode: label?.requirementMode ?? raw.requirementMode,
            },
            interpretation: {
              origin,
              version,
              sourceId: label?.sourceId ?? null,
              rule: label?.rule ?? null,
              ruleDescription:
                label && approved ? approved.labels.rules[label.rule]! : null,
              choiceGroup: label?.choiceGroup ?? null,
              caveats: label?.caveats ?? [],
              ambiguity: label?.ambiguity ?? false,
              evidence:
                label && approved ? approved.cited(label.evidenceRefs) : [],
            },
          },
        ] as const;
      }),
    ),
  };
}
export type ResourceUsePresentation = NonNullable<
  ReturnType<ReturnType<typeof resourceLabelPresentation>['uses']['get']>
>;
