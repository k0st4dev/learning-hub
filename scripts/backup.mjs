import { environment, root } from './environment.mjs';
import { createBackup } from '../src/server/db/backup.ts';
import { AppError } from '../src/server/errors.ts';

try {
  if (process.argv.length !== 2)
    throw new AppError(
      400,
      'BACKUP_ARGUMENTS',
      'Use npm run backup without arguments. APP_DATA_DIR selects the existing installation.',
    );
  const config = environment();
  const result = await createBackup(config.dataDir, root);
  console.log(
    `Verified backup: ${result.directory}\nDatabase: ${result.file}\nSHA-256: ${result.manifest.database.sha256}\nIntegrity, foreign keys and migration history: OK.\nKeep this whole folder with its compatible source repository. Restore remains a separate milestone.`,
  );
} catch (cause) {
  // Database/driver errors can contain private values; never print raw errors.
  console.error(
    cause instanceof AppError
      ? cause.message
      : 'Backup could not complete. Preserve the original data directory; check that setup, source files and storage are available. Any .partial backup is incomplete and must not be used.',
  );
  process.exitCode = 1;
}
