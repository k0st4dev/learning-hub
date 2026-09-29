import { mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { environment } from './environment.mjs';

try {
  const config = environment();
  const { checkNativeDependencies } = await import('./native-check.mjs');
  console.log(await checkNativeDependencies());
  await mkdir(config.dataDir, { recursive: true });
  const probe = path.join(config.dataDir, `.write-check-${randomUUID()}`);
  const file = await open(probe, 'wx', 0o600);
  await file.close();
  await unlink(probe);
  console.log(
    `Foundation checks passed. Local URL: ${config.origin}\nData directory: ${config.dataDir}\nM0 development preview: account schema and curriculum import arrive in subsequent milestones. No student database was created or modified.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Setup failed.');
  process.exitCode = 1;
}
