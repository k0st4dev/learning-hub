import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './environment.mjs';

const allowed = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'CC-BY-4.0',
  '0BSD',
  'BlueOak-1.0.0',
  'Python-2.0',
  'MPL-2.0',
  'Unlicense',
  '(MIT OR CC0-1.0)',
  '(MIT OR Apache-2.0)',
  '(MIT AND Zlib)',
  '(WTFPL OR MIT)',
  '(BSD-2-Clause OR MIT OR Apache-2.0)',
  'LGPL-3.0-or-later',
  'Apache-2.0 AND LGPL-3.0-or-later',
  'Apache-2.0 AND LGPL-3.0-or-later AND MIT',
]);
const lock = JSON.parse(
  await readFile(path.join(root, 'package-lock.json'), 'utf8'),
);
const notices = [];
const inventory = [];
const problems = [];

async function gather(dir, base = dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) await gather(filename, base);
    else if (
      /^(licen[sc]e|notice|copying|copyright)([._-]|$)/i.test(entry.name)
    ) {
      const text = await readFile(filename, 'utf8');
      notices.push({
        path: path.relative(root, filename).replaceAll('\\', '/'),
        sha256: createHash('sha256').update(text).digest('hex'),
        text,
      });
    }
  }
}

for (const [location, pkg] of Object.entries(lock.packages).sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  if (!location) continue;
  if (!allowed.has(pkg.license))
    problems.push(
      `${location}@${pkg.version}: ${pkg.license ?? 'MISSING licence metadata'}`,
    );
  const before = notices.length;
  await gather(path.join(root, location));
  inventory.push({
    location,
    version: pkg.version,
    license: pkg.license ?? null,
    integrity: pkg.integrity ?? null,
    dev: pkg.dev ?? false,
    optional: pkg.optional ?? false,
    noticeFiles: notices
      .slice(before)
      .map(({ path, sha256 }) => ({ path, sha256 })),
  });
}
const report =
  JSON.stringify({ schemaVersion: 1, packages: inventory }, null, 2) + '\n';
const text =
  'THIRD-PARTY NOTICES\n\nVerbatim licence/notice files shipped in installed dependency packages.\nExact versions, integrity hashes and platform-optional packages are recorded in dependency-licenses.json and package-lock.json. Original package notices remain in node_modules.\n\n' +
  notices.map((n) => `===== ${n.path} =====\n\n${n.text}\n`).join('\n');
const dir = path.join(root, 'docs');
await mkdir(dir, { recursive: true });
if (process.argv.includes('--check')) {
  if (
    (await readFile(path.join(dir, 'dependency-licenses.json'), 'utf8')) !==
      report ||
    (await readFile(path.join(dir, 'THIRD_PARTY_NOTICES.txt'), 'utf8')) !== text
  ) {
    problems.push(
      'Licence inventory is stale. Run npm run licenses:generate and review changes.',
    );
  }
} else {
  await writeFile(path.join(dir, 'dependency-licenses.json'), report);
  await writeFile(path.join(dir, 'THIRD_PARTY_NOTICES.txt'), text);
}
console.log(
  `${inventory.length} locked dependencies; ${notices.length} supplied notice files preserved.`,
);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
}
