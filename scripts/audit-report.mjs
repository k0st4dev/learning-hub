import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './environment.mjs';

/** Integration reruns retain historical reports; this never redirects app data. */
export async function writeAuditReport(filename, json) {
  const directory = process.env.APP_AUDIT_REPORT_DIR;
  assert.ok(!directory || directory === 'docs/m6-integration');
  const destination = directory
    ? path.join(root, directory, path.basename(filename))
    : filename;
  const relative = path.relative(path.join(root, 'docs'), destination);
  assert.ok(
    relative && !relative.startsWith('..') && !path.isAbsolute(relative),
  );
  JSON.parse(json);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, json);
}
