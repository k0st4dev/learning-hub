// Developer-only immutable approved subset; no setup or database mutation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import { loadArchivedCurriculum } from '../src/server/content/import.ts';
import {
  labelDigest,
  resourceIdentity,
  resourceUseIdentity,
  resourceLabelVersion,
} from '../src/server/content/resource-label-contract.ts';
import {
  resourceBindingVersion,
  resourceContextIdentity,
} from '../src/server/content/resource-binding-contract.ts';
import {
  resourceMentionSchema,
  resourceMentionVersion,
  resourceMentionProposalSha256,
} from '../src/server/content/resource-mention-contract.ts';

assert.ok(
  process.argv.length === 3 &&
    ['--write-new', '--check'].includes(process.argv[2]),
);
const root = path.resolve(import.meta.dirname, '..');
const bytes = await readFile(
  path.join(root, 'docs/resource-named-mentions-proposal.json'),
);
assert.equal(
  createHash('sha256').update(bytes).digest('hex'),
  resourceMentionProposalSha256,
);
const proposal = JSON.parse(bytes.toString('utf8'));
const plan = await loadArchivedCurriculum(root);
assert.equal(proposal.status, 'proposal-only-not-runtime');
assert.equal(proposal.releaseId, plan.releaseId);
assert.equal(proposal.manifestSha256, plan.manifestSha256);
assert.equal(proposal.wordSha256, plan.source.source.sha256);
const approved = proposal.mentions.filter(
  (row) => row.reviewDecision === 'recommended-for-separate-approval',
);
assert.equal(approved.length, 13);
assert.ok(approved.every((row) => row.sourceId !== 'p1679'));
const originalResources = new Map(plan.resources.map((row) => [row.id, row]));
const originalUses = new Map(plan.uses.map((row) => [row.id, row]));
const items = new Map(plan.items.map((row) => [row.id, row]));
const readInterpretation = async (version) =>
  JSON.parse(
    await readFile(
      path.join(root, 'content/interpretations/' + version + '.json'),
      'utf8',
    ),
  );
const labels = await readInterpretation(resourceLabelVersion);
const bindings = await readInterpretation(resourceBindingVersion);
const resources = new Map();
const evidenceRefs = new Set();
const mentions = approved.map((row) => {
  const original = originalResources.get(row.resourceId);
  const parent = row.navigation.parentResourceKey
    ? originalResources.get(
        plan.releaseId + ':' + row.navigation.parentResourceKey,
      )
    : null;
  assert.ok(!row.navigation.parentResourceKey || parent);
  const definition = {
    id: row.resourceId,
    stableKey: row.resourceStableKey,
    title: original?.title ?? row.displayName,
    action: original ? 'reuse-existing-resource' : 'derived-resource',
    originalIdentitySha256: original ? resourceIdentity(original) : null,
    type: row.proposed.type,
    provider: row.proposed.provider,
    parent: parent
      ? {
          resourceId: parent.id,
          identitySha256: resourceIdentity(parent),
          originalUrl: parent.originalUrl,
        }
      : null,
  };
  if (resources.has(row.resourceId))
    assert.deepEqual(resources.get(row.resourceId), definition);
  else resources.set(row.resourceId, definition);
  row.evidenceRefs.forEach((ref) => evidenceRefs.add(ref));
  return {
    candidateId: row.candidateId,
    key: row.proposedMentionKey,
    resourceId: row.resourceId,
    displayName: row.displayName,
    sourceId: row.sourceId,
    contentItemId: row.context.id,
    exactInstruction: row.exactInstruction,
    sourceMappingHref: row.context.sourceMappingHref,
    requirementMode: row.proposed.requirementMode,
    choiceGroup: row.proposed.choiceGroup,
    reason: row.reason,
    scope: row.context.scope,
    origins: row.originalUseIds.map((id) => {
      const use = originalUses.get(id);
      assert.ok(
        use &&
          use.contentItemId === row.context.id &&
          use.assignedText === row.exactInstruction,
      );
      return { useId: id, identitySha256: resourceUseIdentity(use) };
    }),
    ancestors: row.context.ancestors.map((ancestor) => {
      const item = items.get(ancestor.id);
      assert.ok(
        item &&
          item.parentId === ancestor.parentId &&
          JSON.parse(item.metadataJson).route === ancestor.route,
      );
      return { itemId: item.id, identitySha256: resourceContextIdentity(item) };
    }),
    evidenceRefs: row.evidenceRefs,
  };
});
const artifact = resourceMentionSchema.parse({
  formatVersion: 1,
  interpretationId: resourceMentionVersion,
  releaseId: plan.releaseId,
  manifestSha256: plan.manifestSha256,
  wordSha256: plan.source.source.sha256,
  proposalSha256: resourceMentionProposalSha256,
  labelInterpretationId: resourceLabelVersion,
  labelSha256: labelDigest(labels),
  bindingInterpretationId: resourceBindingVersion,
  bindingSha256: labelDigest(bindings),
  resources: [...resources.values()],
  mentions,
  evidence: proposal.evidence
    .filter((row) => evidenceRefs.has(row.sourceId))
    .map(({ sourceId, sha256, table, row, cell }) => ({
      sourceId,
      sha256,
      table,
      row,
      cell,
    })),
});
const output = await format(JSON.stringify(artifact), { parser: 'json' });
const file = path.join(
  root,
  'content/interpretations/' + resourceMentionVersion + '.json',
);
if (process.argv[2] === '--check')
  assert.equal(await readFile(file, 'utf8'), output);
else await writeFile(file, output, { flag: 'wx' });
console.log(
  JSON.stringify({
    interpretationId: resourceMentionVersion,
    canonicalSha256: labelDigest(artifact),
    resources: artifact.resources.length,
    derivedResources: artifact.resources.filter(
      (row) => row.action === 'derived-resource',
    ).length,
    approvedMentions: artifact.mentions.length,
    evidenceBlocks: artifact.evidence.length,
  }),
);
