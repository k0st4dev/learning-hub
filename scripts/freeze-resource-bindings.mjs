// Developer-only: create one immutable binding version, or reproduce it read-only.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import { loadArchivedCurriculum } from '../src/server/content/import.ts';
import {
  labelDigest,
  resourceUseIdentity,
  resourceLabelVersion,
} from '../src/server/content/resource-label-contract.ts';
import {
  resourceBindingSchema,
  resourceBindingVersion,
  resourceContextIdentity,
} from '../src/server/content/resource-binding-contract.ts';

assert.ok(
  process.argv.length === 3 &&
    ['--write-new', '--check'].includes(process.argv[2]),
);
const root = path.resolve(import.meta.dirname, '..');
const proposal = JSON.parse(
  await readFile(
    path.join(root, 'docs/resource-metadata-proposal.json'),
    'utf8',
  ),
);
const labels = JSON.parse(
  await readFile(
    path.join(
      root,
      'content/interpretations/' + resourceLabelVersion + '.json',
    ),
    'utf8',
  ),
);
const plan = await loadArchivedCurriculum(root);
assert.equal(proposal.status, 'proposal-only-not-runtime');
assert.equal(labelDigest(proposal), labels.proposalSha256);
assert.equal(proposal.releaseId, plan.releaseId);
assert.equal(proposal.manifestSha256, plan.manifestSha256);
const items = new Map(plan.items.map((row) => [row.id, row]));
const resources = new Map(plan.resources.map((row) => [row.id, row]));
const uses = new Map(plan.uses.map((row) => [row.id, row]));
const reviewed = new Map(proposal.uses.map((row) => [row.useId, row]));
const artifact = resourceBindingSchema.parse({
  formatVersion: 1,
  interpretationId: resourceBindingVersion,
  releaseId: plan.releaseId,
  manifestSha256: proposal.manifestSha256,
  wordSha256: proposal.wordSha256,
  proposalSha256: labelDigest(proposal),
  labelInterpretationId: resourceLabelVersion,
  labelSha256: labelDigest(labels),
  corrections: proposal.parentSuggestions.map((row) => {
    const use = uses.get(row.useId);
    const review = reviewed.get(row.useId);
    assert.ok(use && review);
    assert.deepEqual(use, review.raw);
    const targetId = plan.releaseId + ':' + row.proposedParentResourceKey;
    assert.ok(resources.has(targetId));
    const ancestors = [];
    const visited = new Set();
    let id = use.contentItemId;
    while (id) {
      const item = items.get(id);
      assert.ok(item && !visited.has(id));
      visited.add(id);
      ancestors.push({
        itemId: id,
        identitySha256: resourceContextIdentity(item),
      });
      id = item.parentId;
    }
    return {
      useId: use.id,
      identitySha256: resourceUseIdentity(use),
      originalResourceId: use.resourceId,
      effectiveResourceId: targetId,
      sourceId: review.sourceId,
      kind:
        row.proposedParentResourceKey === 'res-01'
          ? 'top-foundations-context'
          : 'fso-week-context',
      reason: row.reason,
      scope: review.scope,
      evidenceRefs: row.evidenceRefs,
      ancestors,
    };
  }),
});
const file = path.join(
  root,
  'content/interpretations',
  resourceBindingVersion + '.json',
);
const rendered = await format(JSON.stringify(artifact), {
  parser: 'json',
  printWidth: 80,
});
if (process.argv[2] === '--check')
  assert.equal(
    await readFile(file, 'utf8'),
    rendered,
    'Frozen bindings differ from reviewed proposal/source',
  );
else {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, rendered, { flag: 'wx' });
}
process.stdout.write(
  JSON.stringify({
    interpretationId: resourceBindingVersion,
    canonicalSha256: labelDigest(artifact),
    corrections: artifact.corrections.length,
    topFoundations: artifact.corrections.filter(
      (row) => row.kind === 'top-foundations-context',
    ).length,
    fullStackOpen: artifact.corrections.filter(
      (row) => row.kind === 'fso-week-context',
    ).length,
  }) + '\n',
);
