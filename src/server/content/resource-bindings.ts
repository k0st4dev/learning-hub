import frozen from '../../../content/interpretations/se-26w-v1-resource-bindings-v1.json';
import labelsFrozen from '../../../content/interpretations/se-26w-v1-resource-labels-v1.json';
import type { Catalog } from './read.ts';
import { AppError } from '../errors.ts';
import {
  resourceBindingSchema,
  resourceBindingVersion,
  resourceContextIdentity,
} from './resource-binding-contract.ts';
import {
  labelDigest,
  resourceUseIdentity,
  resourceLabelRelease,
} from './resource-label-contract.ts';
import {
  validateResourceLabels,
  resourceLabelSha256,
} from './resource-labels.ts';

export const resourceBindingSha256 =
  'fefefb7f2926d28487fb472aa12b16a051592be0aeea34c48ec7914713eb1069';
function unavailable(): never {
  throw new AppError(
    503,
    'RESOURCE_BINDINGS_UNAVAILABLE',
    'Reviewed resource connections do not match your curriculum. Verify the application and enrolled release.',
  );
}
export function validateResourceBindings(
  catalog: Catalog,
  input: unknown,
  trustedSha256: string,
) {
  const parsed = resourceBindingSchema.safeParse(input);
  if (!parsed.success || labelDigest(input) !== trustedSha256) unavailable();
  const artifact = parsed.data;
  const base = validateResourceLabels(
    catalog,
    labelsFrozen,
    resourceLabelSha256,
  );
  if (
    artifact.releaseId !== catalog.release.id ||
    artifact.manifestSha256 !== catalog.release.manifestSha256 ||
    artifact.wordSha256 !== catalog.release.sourceSha256 ||
    artifact.labelSha256 !== resourceLabelSha256 ||
    artifact.labelInterpretationId !== base.labels.interpretationId ||
    artifact.proposalSha256 !== base.labels.proposalSha256 ||
    new Set(artifact.corrections.map((row) => row.useId)).size !== 18 ||
    artifact.corrections.filter((row) => row.kind === 'top-foundations-context')
      .length !== 15
  )
    unavailable();
  const uses = new Map(catalog.uses.map((row) => [row.id, row]));
  const resources = new Map(catalog.resources.map((row) => [row.id, row]));
  const items = new Map(catalog.items.map((row) => [row.id, row]));
  const labels = new Map(base.labels.uses.map((row) => [row.useId, row]));
  const validated = new Map(
    artifact.corrections.map((row) => {
      const use = uses.get(row.useId);
      const source = resources.get(row.originalResourceId);
      const target = resources.get(row.effectiveResourceId);
      if (
        !use ||
        !source ||
        !target ||
        use.resourceId !== source.id ||
        source.id === target.id ||
        use.releaseId !== artifact.releaseId ||
        target.releaseId !== artifact.releaseId ||
        resourceUseIdentity(use) !== row.identitySha256 ||
        labels.get(row.useId)?.sourceId !== row.sourceId ||
        !row.evidenceRefs.includes(row.sourceId) ||
        new Set(row.evidenceRefs).size !== row.evidenceRefs.length
      )
        unavailable();
      const ancestors = [];
      const visited = new Set<string>();
      const scope: {
        module: string | null;
        week: string | null;
        day: string | null;
      } = { module: null, week: null, day: null };
      let id: string | null = use.contentItemId;
      while (id) {
        const item = items.get(id);
        if (!item || visited.has(id) || item.releaseId !== artifact.releaseId)
          unavailable();
        visited.add(id);
        ancestors.push({
          itemId: id,
          identitySha256: resourceContextIdentity(item),
        });
        if (
          item.kind === 'module' ||
          item.kind === 'week' ||
          item.kind === 'day'
        )
          scope[item.kind] = item.stableKey;
        id = item.parentId;
      }
      if (
        labelDigest(ancestors) !== labelDigest(row.ancestors) ||
        scope.module !== row.scope.module ||
        scope.week !== row.scope.week ||
        scope.day !== row.scope.day
      )
        unavailable();
      const evidence = base.cited(row.evidenceRefs);
      if (
        !evidence
          .find((block) => block.sourceId === row.sourceId)
          ?.exactText.includes(use.assignedText)
      )
        unavailable();
      if (row.kind === 'top-foundations-context') {
        if (
          source.stableKey !== 'res-02' ||
          target.stableKey !== 'res-01' ||
          !/^w0[1-6]$/.test(scope.week ?? '') ||
          !/\bTOP\b/.test(use.assignedText) ||
          !row.evidenceRefs.includes('p0084') ||
          !row.evidenceRefs.includes('p0087')
        )
          unavailable();
      } else {
        const fsoWeeks: Record<string, string> = {
          p1756: 'w20',
          p1906: 'w22',
          p2131: 'w25',
        };
        if (
          target.stableKey !== 'res-05' ||
          source.stableKey !== 'unresolved-' + row.sourceId ||
          fsoWeeks[row.sourceId] !== scope.week ||
          !row.evidenceRefs.includes('p0025')
        )
          unavailable();
        // Its weekly cited assignment must name the already supplied Full Stack Open parent.
        if (
          !evidence.some(
            (block) =>
              block.sourceId !== row.sourceId &&
              /FSO|Full Stack Open/.test(block.exactText),
          )
        )
          unavailable();
      }
      return [row.useId, { ...row, evidence }] as const;
    }),
  );
  return { artifact, corrections: validated };
}

// A separate read projection for the next integration; existing UI/search do not enable it yet.
export function resourceBindingPresentation(catalog: Catalog) {
  const approved =
    catalog.release.id === resourceLabelRelease
      ? validateResourceBindings(catalog, frozen, resourceBindingSha256)
      : null;
  return {
    status: {
      origin: approved
        ? ('added-product-interpretation' as const)
        : ('imported-metadata' as const),
      version: approved ? resourceBindingVersion : null,
      sha256: approved ? resourceBindingSha256 : null,
      changedUses: approved?.corrections.size ?? 0,
    },
    uses: new Map(
      catalog.uses.map((raw) => {
        const correction = approved?.corrections.get(raw.id);
        return [
          raw.id,
          {
            originalResourceId: raw.resourceId,
            effectiveResourceId:
              correction?.effectiveResourceId ?? raw.resourceId,
            changed: !!correction,
            interpretation: {
              origin: correction
                ? ('added-product-interpretation' as const)
                : ('imported-metadata' as const),
              version: correction ? resourceBindingVersion : null,
              sourceId: correction?.sourceId ?? null,
              kind: correction?.kind ?? null,
              reason: correction?.reason ?? null,
              evidence: correction?.evidence ?? [],
            },
          },
        ] as const;
      }),
    ),
  };
}
