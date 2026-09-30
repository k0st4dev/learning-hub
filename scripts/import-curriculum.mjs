import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { environment, root } from './environment.mjs';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../src/server/content/import.ts';
import { openDatabase } from '../src/server/db/connection.ts';
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--dry-run'))
  throw new Error('Usage: npm run curriculum:import -- [--dry-run]');
const config = environment();
const plan = await loadArchivedCurriculum(root);
if (args.includes('--dry-run'))
  console.log(
    JSON.stringify(
      { ...plan.report, routes: plan.report.routes.length, dryRun: true },
      null,
      2,
    ),
  );
else {
  const store = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
  try {
    const result = importCurriculum(store, plan.source);
    await writeFile(
      path.join(config.dataDir, 'curriculum-import-report.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    console.log(
      JSON.stringify(
        {
          ...result,
          report: { ...result.report, routes: result.report.routes.length },
        },
        null,
        2,
      ),
    );
  } finally {
    store.native.close();
  }
}
