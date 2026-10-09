import frozen from '../../../content/interpretations/se-26w-v1-resource-mentions-v1.json' with { type: 'json' };
import type { Catalog } from './read.ts';
import { AppError } from '../errors.ts';
import {
  resourceMentionSchema,
  resourceMentionVersion,
} from './resource-mention-contract.ts';
import {
  labelDigest,
  resourceIdentity,
  resourceUseIdentity,
  textDigest,
  resourceLabelRelease,
} from './resource-label-contract.ts';
import { resourceContextIdentity } from './resource-binding-contract.ts';
import {
  resourceLabelPresentation,
  resourceLabelSha256,
} from './resource-labels.ts';
import {
  resourceBindingPresentation,
  resourceBindingSha256,
} from './resource-bindings.ts';
import { courseNavigation } from './navigation.ts';

export const resourceMentionSha256 =
  '5ec53b8b5b532cf0c7295692a1ebe1d88af157e87eb5fdf8325b71615f98d779';
function unavailable(): never {
  throw new AppError(
    503,
    'RESOURCE_MENTIONS_UNAVAILABLE',
    'Reviewed named resources do not match your curriculum. Verify the application and enrolled release.',
  );
}

// The fixed application pin is intentionally not caller-selectable.
export function validateResourceMentions(catalog: Catalog, input: unknown) {
  const parsed = resourceMentionSchema.safeParse(input);
  if (!parsed.success || labelDigest(input) !== resourceMentionSha256)
    unavailable();
  const artifact = parsed.data;
  const labels = resourceLabelPresentation(catalog);
  const bindings = resourceBindingPresentation(catalog);
  if (
    catalog.release.status !== 'published' ||
    artifact.releaseId !== catalog.release.id ||
    artifact.manifestSha256 !== catalog.release.manifestSha256 ||
    artifact.wordSha256 !== catalog.release.sourceSha256 ||
    artifact.labelSha256 !== resourceLabelSha256 ||
    artifact.labelInterpretationId !== labels.status.version ||
    artifact.bindingSha256 !== resourceBindingSha256 ||
    artifact.bindingInterpretationId !== bindings.status.version
  )
    unavailable();
  const originals = new Map(catalog.resources.map((row) => [row.id, row]));
  const uses = new Map(catalog.uses.map((row) => [row.id, row]));
  const items = new Map(catalog.items.map((row) => [row.id, row]));
  const blocks = new Map(catalog.blocks.map((row) => [row.sourceLocator, row]));
  const definitions = new Map(artifact.resources.map((row) => [row.id, row]));
  if (
    items.size !== catalog.items.length ||
    definitions.size !== 12 ||
    new Set(artifact.resources.map((row) => row.stableKey)).size !== 12 ||
    artifact.resources.filter((row) => row.action === 'derived-resource')
      .length !== 10 ||
    new Set(artifact.mentions.map((row) => row.key)).size !== 13 ||
    new Set(artifact.mentions.map((row) => row.candidateId)).size !== 13 ||
    new Set(artifact.mentions.map((row) => row.resourceId)).size !== 12 ||
    new Set(artifact.evidence.map((row) => row.sourceId)).size !== 18
  )
    unavailable();
  for (const definition of definitions.values()) {
    const original = originals.get(definition.id);
    if (definition.id !== artifact.releaseId + ':' + definition.stableKey)
      unavailable();
    if (definition.action === 'reuse-existing-resource') {
      if (
        !original ||
        resourceIdentity(original) !== definition.originalIdentitySha256 ||
        original.title !== definition.title ||
        labels.resources.get(original.id)!.effective.type !== definition.type ||
        labels.resources.get(original.id)!.effective.provider !==
          definition.provider
      )
        unavailable();
    } else if (
      original ||
      catalog.resources.some((row) => row.stableKey === definition.stableKey) ||
      !definition.stableKey.startsWith('named-') ||
      definition.originalIdentitySha256 !== null
    )
      unavailable();
    if (definition.parent) {
      const parent = originals.get(definition.parent.resourceId);
      if (
        !parent ||
        resourceIdentity(parent) !== definition.parent.identitySha256 ||
        parent.originalUrl !== definition.parent.originalUrl
      )
        unavailable();
    }
  }
  const evidence = new Map(
    artifact.evidence.map((proof) => {
      const block = blocks.get(proof.sourceId);
      if (
        !block ||
        block.releaseId !== artifact.releaseId ||
        block.textSha256 !== proof.sha256 ||
        textDigest(block.exactText) !== proof.sha256 ||
        block.tableNumber !== proof.table ||
        block.rowNumber !== proof.row ||
        block.cellNumber !== proof.cell
      )
        unavailable();
      return [
        proof.sourceId,
        {
          sourceId: proof.sourceId,
          exactText: block.exactText,
          sha256: proof.sha256,
          table: proof.table,
          row: proof.row,
          cell: proof.cell,
        },
      ] as const;
    }),
  );
  const navigation = courseNavigation(catalog);
  const cited = new Set<string>();
  const mentions = artifact.mentions.map((row) => {
    const item = items.get(row.contentItemId);
    const definition = definitions.get(row.resourceId);
    const block = blocks.get(row.sourceId);
    if (
      !item ||
      !definition ||
      !block ||
      row.sourceId === 'p1679' ||
      !['lesson', 'week'].includes(item.kind) ||
      row.origins.length !==
        new Set(row.origins.map((origin) => origin.useId)).size ||
      new Set(row.evidenceRefs).size !== row.evidenceRefs.length ||
      !row.evidenceRefs.includes(row.sourceId) ||
      !block.exactText.includes(row.exactInstruction) ||
      row.key !==
        'named-' +
          row.sourceId +
          '-' +
          definition.stableKey.replace(/^named-/, '') ||
      !catalog.mappings.some(
        (mapping) =>
          mapping.sourceBlockId === block.id &&
          mapping.contentItemId === item.id &&
          mapping.websiteLocation === row.sourceMappingHref,
      )
    )
      unavailable();
    const sourceOrigins = [...uses.values()].filter(
      (use) =>
        labels.uses.get(use.id)?.interpretation.sourceId === row.sourceId,
    );
    if (
      sourceOrigins.length !== row.origins.length ||
      row.origins.some((origin) => {
        const use = uses.get(origin.useId);
        return (
          !use ||
          use.contentItemId !== item.id ||
          use.assignedText !== row.exactInstruction ||
          resourceUseIdentity(use) !== origin.identitySha256 ||
          !sourceOrigins.includes(use)
        );
      })
    )
      unavailable();
    const ancestors = [];
    const visited = new Set<string>();
    const scope = {
      module: null as string | null,
      week: null as string | null,
      day: null as string | null,
    };
    let current: Catalog['items'][number] | undefined = item;
    while (current) {
      if (visited.has(current.id)) unavailable();
      visited.add(current.id);
      ancestors.push({
        itemId: current.id,
        identitySha256: resourceContextIdentity(current),
      });
      if (
        current.kind === 'module' ||
        current.kind === 'week' ||
        current.kind === 'day'
      )
        scope[current.kind] = current.stableKey;
      if (current.parentId && !items.has(current.parentId)) unavailable();
      current = current.parentId ? items.get(current.parentId) : undefined;
    }
    if (
      labelDigest(ancestors) !== labelDigest(row.ancestors) ||
      labelDigest(scope) !== labelDigest(row.scope) ||
      (item.kind === 'week' &&
        (row.requirementMode !== 'reference' || row.scope.day !== null)) ||
      (row.requirementMode === 'conditional'
        ? row.choiceGroup !== 'choice:' + row.sourceId
        : row.choiceGroup !== null)
    )
      unavailable();
    const page = navigation.forItem(item.id);
    if (!page || row.sourceMappingHref.split('#')[0] !== page.current.route)
      unavailable();
    const proof = row.evidenceRefs.map((ref) => {
      cited.add(ref);
      const value = evidence.get(ref);
      if (!value) unavailable();
      return value;
    });
    return {
      ...row,
      origin: 'added-product-interpretation' as const,
      href: page.current.route,
      title: page.current.title,
      dayNumber: page.current.dayNumber,
      breadcrumbs: page.breadcrumbs.map((crumb) => ({
        title: crumb.title,
        href: crumb.route,
      })),
      evidence: proof,
    };
  });
  if (cited.size !== evidence.size) unavailable();
  return { artifact, mentions };
}

export function resourceMentionPresentation(catalog: Catalog) {
  if (catalog.release.id !== resourceLabelRelease)
    return {
      status: {
        origin: 'imported-metadata' as const,
        version: null,
        sha256: null,
        approvedMentions: 0,
      },
      resources: [],
      mentions: [],
    };
  const validated = validateResourceMentions(catalog, frozen);
  return {
    status: {
      origin: 'added-product-interpretation' as const,
      version: resourceMentionVersion,
      sha256: resourceMentionSha256,
      approvedMentions: 13,
    },
    resources: validated.artifact.resources,
    mentions: validated.mentions,
  };
}
