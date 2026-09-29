import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only preflight. Does not open SQLite, seed content or execute source files.
const root = fileURLToPath(new URL('../content/se-26w-v1/', import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(root, 'source-manifest.json'), 'utf8'),
);
assert.equal(manifest.formatVersion, 1);
assert.equal(manifest.releaseId, 'se-26w-v1');
assert.equal(manifest.files.length, 10);
const names = manifest.files.map((file) => file.name);
assert.equal(new Set(names).size, names.length, 'Duplicate archived filenames');
assert.deepEqual(
  (await readdir(path.join(root, 'source'))).sort(),
  [...names].sort(),
  'Archive file inventory changed',
);
for (const file of manifest.files) {
  assert.match(
    file.name,
    /^[a-zA-Z0-9_-]+\.(md|html|json|csv|sql|docx)$/,
    'Unsafe filename',
  );
  assert.match(file.sha256, /^[a-f0-9]{64}$/);
  const bytes = await readFile(path.join(root, 'source', file.name));
  assert.equal(bytes.length, file.bytes, `Size changed: ${file.name}`);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    file.sha256,
    `SHA256 changed: ${file.name}`,
  );
}
const source = JSON.parse(
  await readFile(path.join(root, 'source/curriculum-source.json'), 'utf8'),
);
assert.equal(source.release_id, manifest.releaseId);
assert.equal(
  source.source.sha256,
  manifest.files.find((file) => file.name === source.source.filename)?.sha256,
  'Word source does not match structured metadata',
);
const inventory = {
  files: names.length,
  phases: source.modules.length,
  weeks: source.weeks.length,
  days: source.days.length,
  tasks: source.days.reduce((total, day) => total + day.tasks.length, 0),
  preparation: source.preparation.length,
  originalResources: source.resources.length,
  sourceBlocks: source.source_blocks.length,
  mappings: source.source_mapping.length,
};
assert.deepEqual(inventory, {
  files: 10,
  phases: 6,
  weeks: 26,
  days: 182,
  tasks: 548,
  preparation: 7,
  originalResources: 12,
  sourceBlocks: 2365,
  mappings: 2329,
});
console.log(
  JSON.stringify(
    {
      status: 'verified',
      scope:
        'Source archive integrity and inventory only; not import or rendered coverage.',
      ...inventory,
    },
    null,
    2,
  ),
);
