// Developer audit only: freeze a new version once, or check it. Never called by setup/import.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import {
  labelDigest,
  resourceIdentity,
  resourceUseIdentity,
  resourceLabelSchema,
  resourceLabelVersion,
} from '../src/server/content/resource-label-contract.ts';

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
assert.equal(proposal.status, 'proposal-only-not-runtime');
const artifact = resourceLabelSchema.parse({
  formatVersion: 1,
  interpretationId: resourceLabelVersion,
  releaseId: proposal.releaseId,
  manifestSha256: proposal.manifestSha256,
  wordSha256: proposal.wordSha256,
  proposalSha256: labelDigest(proposal),
  rules: proposal.rules,
  resources: proposal.resources.map((row) => ({
    resourceId: row.resourceId,
    identitySha256: resourceIdentity(row.raw),
    ...row.proposed,
    evidenceRefs: row.evidenceRefs,
    ambiguity: row.ambiguity,
  })),
  uses: proposal.uses.map((row) => ({
    useId: row.useId,
    identitySha256: resourceUseIdentity(row.raw),
    sourceId: row.sourceId,
    ...row.proposed,
    evidenceRefs: row.evidenceRefs,
    caveats: row.caveats,
    ambiguity: row.ambiguity,
  })),
  evidence: proposal.evidence.map(({ sourceId, sha256, table, row, cell }) => ({
    sourceId,
    sha256,
    table,
    row,
    cell,
  })),
});
const file = path.join(
  root,
  'content/interpretations',
  resourceLabelVersion + '.json',
);
const rendered = await format(JSON.stringify(artifact), {
  parser: 'json',
  printWidth: 80,
});
if (process.argv[2] === '--check') {
  assert.equal(
    await readFile(file, 'utf8'),
    rendered,
    'Frozen labels differ from the reviewed proposal',
  );
} else {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, rendered, { flag: 'wx' }); // Never overwrite a frozen version.
}
process.stdout.write(
  JSON.stringify({
    interpretationId: resourceLabelVersion,
    canonicalSha256: labelDigest(artifact),
    resources: artifact.resources.length,
    uses: artifact.uses.length,
  }) + '\n',
);
