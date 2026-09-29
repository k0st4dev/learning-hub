import { mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { environment } from './environment.mjs';
import { root } from './environment.mjs';
import { migrate } from '../src/server/db/migrate.ts';
import { openDatabase } from '../src/server/db/connection.ts';
import { seedDay1Fixture } from '../src/server/content/day1-fixture.ts';

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
  }
  console.log(
    `Setup complete. Local URL: ${config.origin}\nData directory: ${config.dataDir}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Setup failed.');
  process.exitCode = 1;
}
