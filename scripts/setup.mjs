import { mkdir, open, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { environment } from './environment.mjs';
import { root } from './environment.mjs';
import { migrate } from '../src/server/db/migrate.ts';
import { openDatabase } from '../src/server/db/connection.ts';
import { seedDay1Fixture } from '../src/server/content/day1-fixture.ts';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../src/server/content/import.ts';

try {
  const config = environment();
  const { checkNativeDependencies } = await import('./native-check.mjs');
  console.log(await checkNativeDependencies());
  await mkdir(config.dataDir, { recursive: true });
  const probe = path.join(config.dataDir, `.write-check-${randomUUID()}`);
  const file = await open(probe, 'wx', 0o600);
  await file.close();
  await unlink(probe);
  console.log(await migrate(config.dataDir, root));
  if (process.env.APP_DEVELOPMENT_FIXTURE === 'day1') {
    const store = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
    try {
      await seedDay1Fixture(store.orm, root, config.dataDir);
    } finally {
      store.native.close();
    }
    console.log(
      'Isolated Day 1 development fixture ready. It is not the complete published course.',
    );
  } else {
    const plan = await loadArchivedCurriculum(root);
    const store = openDatabase(path.join(config.dataDir, 'learning.sqlite'));
    try {
      const result = importCurriculum(store, plan.source);
      await writeFile(
        path.join(config.dataDir, 'curriculum-import-report.json'),
        JSON.stringify(result, null, 2) + '\n',
      );
      console.log(
        `Complete curriculum ${result.imported ? 'imported' : 'already present'}: 182 days, 548 task lines, 364 required units.`,
      );
    } finally {
      store.native.close();
    }
  }
  console.log(
    `Setup complete. Local URL: ${config.origin}\nData directory: ${config.dataDir}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Setup failed.');
  process.exitCode = 1;
}
