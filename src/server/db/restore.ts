import Database from 'better-sqlite3';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import { z } from 'zod';
import { readConfig } from '../config.ts';
import { AppError } from '../errors.ts';
import { reviewedMigrations } from './migrations.ts';
import { loadArchivedCurriculum } from '../content/import.ts';
import { acquireOperationLock } from './operation-lock.ts';
import { createBackup } from './backup.ts';
import { openDatabase } from './connection.ts';

const sha256 = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const hash = z.string().regex(/^[a-f0-9]{64}$/);

const manifestSchema = z.object({
  formatVersion: z.number(),
  method: z.string(),
  startedAt: z.string(),
  verifiedAt: z.string(),
  database: z.object({
    file: z.string(),
    bytes: z.number(),
    sha256: hash,
  }),
  checks: z.object({
    integrity: z.string(),
    foreignKeys: z.string(),
    migrations: z.string(),
  }),
  migrations: z.array(z.object({ id: z.string(), checksum: hash })),
  releases: z.array(
    z.object({
      id: z.string(),
      course_id: z.string(),
      version: z.string(),
      status: z.enum(['draft', 'published', 'retired']),
      source_filename: z.string(),
      source_sha256: hash,
      manifest_sha256: hash,
    }),
  ),
  sourceArchive: z.object({
    releaseId: z.string(),
    file: z.string(),
    sha256: hash,
  }),
});

async function fileChecksumAndBytes(filename: string) {
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(filename)) {
    bytes += chunk.length;
    digest.update(chunk);
  }
  return { bytes, sha256: digest.digest('hex') };
}

async function durableFile(filename: string, bytes: string | Buffer) {
  const file = await open(filename, 'wx', 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}

export type RestorePrompts = {
  signal: AbortSignal;
  ask: (prompt: string) => Promise<string>;
};

export interface RestoreOptions {
  dataDir: string;
  root: string;
  backupPath: string;
  prompts: RestorePrompts;
  output?: (text: string) => void;
}

export async function executeRestore(options: RestoreOptions) {
  await mkdir(options.dataDir, { recursive: true, mode: 0o700 });
  const targetDir = await realpath(options.dataDir);
  const config = readConfig({ APP_DATA_DIR: targetDir }, options.root);
  const targetLstat = await lstat(targetDir);
  if (targetLstat.isSymbolicLink()) {
    throw new AppError(
      400,
      'RESTORE_PATH_INVALID',
      'Target directory cannot be a symbolic link.',
    );
  }

  const resolvedBackupPath = path.resolve(options.backupPath);
  let backupLstat;
  try {
    backupLstat = await lstat(resolvedBackupPath);
  } catch {
    throw new AppError(
      400,
      'RESTORE_BUNDLE_INVALID',
      'Backup path does not exist.',
    );
  }
  if (backupLstat.isSymbolicLink()) {
    throw new AppError(
      400,
      'RESTORE_PATH_INVALID',
      'Backup path cannot be a symbolic link.',
    );
  }

  let bundleDir: string;
  let bundleDbFile: string;
  if (backupLstat.isDirectory()) {
    bundleDir = resolvedBackupPath;
    bundleDbFile = path.join(bundleDir, 'learning.sqlite');
  } else {
    bundleDbFile = resolvedBackupPath;
    bundleDir = path.dirname(resolvedBackupPath);
  }

  if (
    bundleDir.endsWith('.partial') ||
    path.basename(bundleDir).startsWith('.')
  ) {
    throw new AppError(
      400,
      'RESTORE_BUNDLE_INVALID',
      'Incomplete or partial backup directories cannot be restored.',
    );
  }

  const bundleDirLstat = await lstat(bundleDir);
  if (bundleDirLstat.isSymbolicLink()) {
    throw new AppError(
      400,
      'RESTORE_PATH_INVALID',
      'Backup directory cannot be a symbolic link.',
    );
  }

  const manifestFile = path.join(bundleDir, 'manifest.json');
  const sourceManifestFile = path.join(bundleDir, 'source-manifest.json');
  if (
    !existsSync(bundleDbFile) ||
    !existsSync(manifestFile) ||
    !existsSync(sourceManifestFile)
  ) {
    throw new AppError(
      400,
      'RESTORE_BUNDLE_INVALID',
      'Backup bundle is missing learning.sqlite, manifest.json or source-manifest.json.',
    );
  }

  const dbStat = await lstat(bundleDbFile);
  const manifestStat = await lstat(manifestFile);
  const sourceManifestStat = await lstat(sourceManifestFile);
  if (
    dbStat.isSymbolicLink() ||
    manifestStat.isSymbolicLink() ||
    sourceManifestStat.isSymbolicLink()
  ) {
    throw new AppError(
      400,
      'RESTORE_PATH_INVALID',
      'Backup bundle files cannot be symbolic links.',
    );
  }

  let manifestData: unknown;
  try {
    manifestData = JSON.parse(await readFile(manifestFile, 'utf8'));
  } catch {
    throw new AppError(
      400,
      'RESTORE_BUNDLE_INVALID',
      'Backup manifest is not valid JSON.',
    );
  }

  const parsedManifest = manifestSchema.safeParse(manifestData);
  if (!parsedManifest.success) {
    throw new AppError(
      400,
      'RESTORE_BUNDLE_INVALID',
      'Backup manifest structure is invalid.',
    );
  }
  const manifest = parsedManifest.data;

  const computedDigest = await fileChecksumAndBytes(bundleDbFile);
  if (
    computedDigest.bytes !== manifest.database.bytes ||
    computedDigest.sha256 !== manifest.database.sha256
  ) {
    throw new AppError(
      400,
      'RESTORE_BUNDLE_INVALID',
      'Backup database checksum or size does not match manifest.',
    );
  }

  const sourceManifestBytes = await readFile(sourceManifestFile);
  if (sha256(sourceManifestBytes) !== manifest.sourceArchive.sha256) {
    throw new AppError(
      400,
      'RESTORE_BUNDLE_INVALID',
      'Backup source manifest checksum does not match manifest.',
    );
  }

  const bundleDb = new Database(bundleDbFile, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    if (
      bundleDb.pragma('integrity_check', { simple: true }) !== 'ok' ||
      (bundleDb.pragma('foreign_key_check') as unknown[]).length > 0
    ) {
      throw new AppError(
        503,
        'RESTORE_INTEGRITY_FAILED',
        'Backup database integrity or foreign key check failed.',
      );
    }

    const history = z
      .array(z.object({ id: z.string(), checksum: hash }))
      .parse(
        bundleDb
          .prepare('SELECT id,checksum FROM _app_migration ORDER BY id')
          .all(),
      );
    const expectedMigrations = await Promise.all(
      reviewedMigrations.map(async (entry) => ({
        id: entry.id,
        checksum: sha256(
          await readFile(path.join(options.root, 'drizzle', entry.file)),
        ),
      })),
    );
    if (JSON.stringify(history) !== JSON.stringify(expectedMigrations)) {
      throw new AppError(
        503,
        'RESTORE_SCHEMA_MISMATCH',
        'Backup schema does not match this application. Restore using its compatible application version.',
      );
    }

    const releases = z
      .array(
        z.object({
          id: z.string(),
          course_id: z.string(),
          version: z.string(),
          status: z.enum(['draft', 'published', 'retired']),
          source_filename: z.string(),
          source_sha256: hash,
          manifest_sha256: hash,
        }),
      )
      .parse(
        bundleDb
          .prepare(
            'SELECT id,course_id,version,status,source_filename,source_sha256,manifest_sha256 FROM course_release ORDER BY id',
          )
          .all(),
      );
    const plan = await loadArchivedCurriculum(options.root);
    const official = releases.find((r) => r.id === plan.releaseId);
    if (
      official &&
      (official.manifest_sha256 !== plan.manifestSha256 ||
        official.source_sha256 !== plan.source.source.sha256)
    ) {
      throw new AppError(
        503,
        'RESTORE_RELEASE_MISMATCH',
        'Installed curriculum in backup differs from immutable source. Preserve the database and compatible source repository.',
      );
    }
  } finally {
    bundleDb.close();
  }

  const lease = await acquireOperationLock(targetDir, options.root, 'restore');
  let setupFence;
  const portProbe = createServer((sock) => sock.destroy());
  try {
    await new Promise<void>((resolve, reject) => {
      portProbe.once('error', () =>
        reject(
          new AppError(
            409,
            'SERVER_RUNNING',
            'Stop the application using the configured local port before restoring data.',
          ),
        ),
      );
      portProbe.listen(config.port, config.host, resolve);
    });
    await new Promise<void>((resolve) => portProbe.close(() => resolve()));

    const setupLockPath = path.join(lease.directory, '.setup.lock');
    if (existsSync(setupLockPath)) {
      throw new AppError(
        409,
        'SETUP_RUNNING',
        'Setup, recovery or backup is active, or .setup.lock remains. Verify no owning process is active before removing a stale lock.',
      );
    }

    options.output?.(
      `Restore target: ${path.join(lease.directory, 'learning.sqlite')}\n` +
        `Backup bundle: ${bundleDir}\n` +
        `Verified at: ${manifest.verifiedAt}\n` +
        `This operation replaces the target database. All restored sessions will be revoked and a fresh CSRF secret created.\n`,
    );

    const confirmation = await options.prompts.ask(
      'Type RESTORE to confirm replacement of target database: ',
    );
    if (confirmation !== 'RESTORE') {
      throw new AppError(
        400,
        'RESTORE_CANCELED',
        'Restore canceled. Target data was not changed.',
      );
    }

    let safetyBackupPath: string | null = null;
    const targetDbFile = path.join(lease.directory, 'learning.sqlite');
    if (existsSync(targetDbFile) && (await lstat(targetDbFile)).isFile()) {
      try {
        const safetyResult = await createBackup(lease.directory, options.root);
        safetyBackupPath = safetyResult.directory;
        options.output?.(`Safety backup created: ${safetyBackupPath}\n`);
      } catch {
        const backupsDir = path.join(lease.directory, 'backups');
        await mkdir(backupsDir, { recursive: true, mode: 0o700 });
        const emergencyCopy = path.join(
          backupsDir,
          `safety-damaged-${Date.now()}-${randomUUID()}.sqlite`,
        );
        await copyFile(targetDbFile, emergencyCopy);
        safetyBackupPath = emergencyCopy;
        options.output?.(
          `Target database could not be cleanly backed up; preserved damaged database copy: ${emergencyCopy}\n`,
        );
      }
    }

    setupFence = await open(setupLockPath, 'wx', 0o600).catch(() => {
      throw new AppError(
        409,
        'SETUP_RUNNING',
        'Setup, recovery or backup is active, or .setup.lock remains. Verify no owning process is active before removing a stale lock.',
      );
    });

    const stagedDbFile = path.join(
      lease.directory,
      `.learning.sqlite.restore-${randomUUID()}`,
    );
    const stagedSecretFile = path.join(
      lease.directory,
      `.csrf-secret.restore-${randomUUID()}`,
    );
    await copyFile(bundleDbFile, stagedDbFile);
    await chmod(stagedDbFile, 0o600).catch(() => {});

    const stagedDb = new Database(stagedDbFile);
    let revokedCount = 0;
    try {
      stagedDb.pragma('busy_timeout = 5000');
      stagedDb.pragma('foreign_keys = ON');
      const sessionCountResult = stagedDb
        .prepare('SELECT count(*) as count FROM session')
        .get() as { count: number };
      revokedCount = sessionCountResult.count;
      stagedDb.exec('DELETE FROM session');
      if (
        stagedDb.pragma('journal_mode = DELETE', { simple: true }) !== 'delete'
      ) {
        throw new Error(
          'Could not finalize journal mode on restored database.',
        );
      }
      if (stagedDb.pragma('integrity_check', { simple: true }) !== 'ok') {
        throw new Error('Integrity check failed on staged database.');
      }
    } finally {
      stagedDb.close();
    }

    await durableFile(stagedSecretFile, randomBytes(32).toString('hex'));

    const targetDb = path.join(lease.directory, 'learning.sqlite');
    const targetWal = path.join(lease.directory, 'learning.sqlite-wal');
    const targetShm = path.join(lease.directory, 'learning.sqlite-shm');
    const targetSecret = path.join(lease.directory, 'csrf-secret');

    const swapId = randomUUID();
    const prevDb = path.join(
      lease.directory,
      `.learning.sqlite.prev-${swapId}`,
    );
    const prevWal = path.join(
      lease.directory,
      `.learning.sqlite-wal.prev-${swapId}`,
    );
    const prevShm = path.join(
      lease.directory,
      `.learning.sqlite-shm.prev-${swapId}`,
    );
    const prevSecret = path.join(
      lease.directory,
      `.csrf-secret.prev-${swapId}`,
    );

    let movedDb = false,
      movedWal = false,
      movedShm = false,
      movedSecret = false;
    try {
      if (existsSync(targetDb)) {
        await rename(targetDb, prevDb);
        movedDb = true;
      }
      if (existsSync(targetWal)) {
        await rename(targetWal, prevWal);
        movedWal = true;
      }
      if (existsSync(targetShm)) {
        await rename(targetShm, prevShm);
        movedShm = true;
      }
      if (existsSync(targetSecret)) {
        await rename(targetSecret, prevSecret);
        movedSecret = true;
      }

      await rename(stagedDbFile, targetDb);
      await rename(stagedSecretFile, targetSecret);

      const verifyConn = openDatabase(targetDb);
      try {
        if (
          verifyConn.native.pragma('integrity_check', { simple: true }) !== 'ok'
        ) {
          throw new Error('Integrity check failed after database swap.');
        }
        if (
          (verifyConn.native.pragma('foreign_key_check') as unknown[]).length >
          0
        ) {
          throw new Error('Foreign key check failed after database swap.');
        }
        const remainingSessions = (
          verifyConn.native
            .prepare('SELECT count(*) as count FROM session')
            .get() as { count: number }
        ).count;
        if (remainingSessions !== 0) {
          throw new Error('Sessions were not revoked in restored database.');
        }
      } finally {
        verifyConn.native.close();
      }

      if (movedDb) await unlink(prevDb).catch(() => {});
      if (movedWal) await unlink(prevWal).catch(() => {});
      if (movedShm) await unlink(prevShm).catch(() => {});
      if (movedSecret) await unlink(prevSecret).catch(() => {});
    } catch (swapError) {
      if (existsSync(targetDb)) await unlink(targetDb).catch(() => {});
      if (existsSync(targetSecret)) await unlink(targetSecret).catch(() => {});
      if (movedDb) await rename(prevDb, targetDb).catch(() => {});
      if (movedWal) await rename(prevWal, targetWal).catch(() => {});
      if (movedShm) await rename(prevShm, targetShm).catch(() => {});
      if (movedSecret) await rename(prevSecret, targetSecret).catch(() => {});
      await unlink(stagedDbFile).catch(() => {});
      await unlink(stagedSecretFile).catch(() => {});
      throw swapError;
    }

    return {
      directory: lease.directory,
      targetFile: targetDb,
      safetyBackup: safetyBackupPath,
      restoredFrom: bundleDir,
      sessionsRevoked: revokedCount,
    };
  } finally {
    if (setupFence) {
      await setupFence.close();
      await unlink(path.join(lease.directory, '.setup.lock')).catch(() => {});
    }
    if (portProbe.listening) {
      await new Promise<void>((resolve) => portProbe.close(() => resolve()));
    }
    await lease.release();
  }
}
