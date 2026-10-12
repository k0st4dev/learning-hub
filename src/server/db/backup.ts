import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { readConfig } from '../config.ts';
import { AppError } from '../errors.ts';
import { reviewedMigrations } from './migrations.ts';
import { loadArchivedCurriculum } from '../content/import.ts';

const sha256 = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const releaseSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  version: z.string(),
  status: z.enum(['draft', 'published', 'retired']),
  source_filename: z.string(),
  source_sha256: hash,
  manifest_sha256: hash,
});

async function durableFile(filename: string, bytes: string | Buffer) {
  const file = await open(filename, 'wx', 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}
async function fileDigest(filename: string) {
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(filename)) {
    bytes += chunk.length;
    digest.update(chunk);
  }
  return { bytes, sha256: digest.digest('hex') };
}
function verifyIntegrity(database: Database.Database) {
  if (
    database.pragma('integrity_check', { simple: true }) !== 'ok' ||
    (database.pragma('foreign_key_check') as unknown[]).length
  )
    throw new AppError(
      503,
      'BACKUP_INTEGRITY_FAILED',
      'Backup integrity verification failed. Preserve the original data directory.',
    );
}

/** Online SQLite snapshot. The setup fence excludes supported migration/recovery
 * and other backups, while ordinary server writes remain available. Metadata is
 * read from the completed snapshot, never from a racing live query. */
export async function createBackup(dataDir: string, root: string) {
  const directory = await realpath(dataDir);
  readConfig({ APP_DATA_DIR: directory }, root);
  const source = path.join(directory, 'learning.sqlite');
  const sourceInfo = await lstat(source);
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink())
    throw new AppError(
      400,
      'BACKUP_PATH_INVALID',
      'Use a regular existing database file.',
    );
  const lockPath = path.join(directory, '.setup.lock');
  const lock = await open(lockPath, 'wx', 0o600).catch(() => {
    throw new AppError(
      409,
      'BACKUP_BUSY',
      'Setup, recovery or backup is active, or .setup.lock remains. Verify no owning process is active before removing a stale lock.',
    );
  });
  const owner = randomUUID();
  const verifyLockOwner = async () => {
    const saved = JSON.parse(await readFile(lockPath, 'utf8')) as {
      owner?: unknown;
    };
    if (saved.owner !== owner)
      throw new AppError(
        409,
        'LOCK_CHANGED',
        'Backup lock ownership changed. Preserve the lock and inspect the owning process.',
      );
  };
  let database: Database.Database | undefined;
  try {
    await lock.writeFile(
      JSON.stringify({
        owner,
        pid: process.pid,
        operation: 'backup',
        startedAt: Date.now(),
      }),
    );
    await lock.sync();
    // Check resolved storage before creating any snapshot; refuse symlinked
    // destinations, including redirects into public/build/source directories.
    const backups = path.join(directory, 'backups');
    await mkdir(backups, { recursive: true, mode: 0o700 });
    if (
      (await realpath(backups)) !== backups ||
      (await lstat(backups)).isSymbolicLink()
    )
      throw new AppError(
        400,
        'BACKUP_PATH_INVALID',
        'The backups directory must be inside the configured data directory, without a symbolic link.',
      );
    const startedAt = new Date().toISOString();
    const name = `backup-${startedAt.replace(/[:.]/g, '-')}-${randomUUID()}`;
    const pending = path.join(backups, `.${name}.partial`);
    const destination = path.join(backups, name);
    await mkdir(pending, { mode: 0o700 });
    const snapshotFile = path.join(pending, 'learning.sqlite');
    await durableFile(snapshotFile, Buffer.alloc(0));
    database = new Database(source, { readonly: true, fileMustExist: true });
    database.pragma('busy_timeout = 5000');
    await database.backup(snapshotFile);
    database.close();
    database = undefined;

    // Normalize only the new snapshot to a self-contained file without WAL.
    const portable = new Database(snapshotFile, { fileMustExist: true });
    try {
      if (
        portable.pragma('journal_mode = DELETE', { simple: true }) !== 'delete'
      )
        throw new Error('Snapshot journal mode could not be finalized.');
    } finally {
      portable.close();
    }
    const verification = new Database(snapshotFile, {
      readonly: true,
      fileMustExist: true,
    });
    let releases: z.infer<typeof releaseSchema>[];
    let history: { id: string; checksum: string }[];
    try {
      verifyIntegrity(verification);
      history = z
        .array(z.object({ id: z.string(), checksum: hash }))
        .parse(
          verification
            .prepare('SELECT id,checksum FROM _app_migration ORDER BY id')
            .all(),
        );
      const expected = await Promise.all(
        reviewedMigrations.map(async (entry) => ({
          id: entry.id,
          checksum: sha256(
            await readFile(path.join(root, 'drizzle', entry.file)),
          ),
        })),
      );
      if (JSON.stringify(history) !== JSON.stringify(expected))
        throw new AppError(
          503,
          'BACKUP_SCHEMA_MISMATCH',
          'Backup schema does not match this application. Preserve your database and use its compatible application version.',
        );
      releases = z
        .array(releaseSchema)
        .parse(
          verification
            .prepare(
              'SELECT id,course_id,version,status,source_filename,source_sha256,manifest_sha256 FROM course_release ORDER BY id',
            )
            .all(),
        );
    } finally {
      verification.close();
    }
    const plan = await loadArchivedCurriculum(root);
    const official = releases.find((release) => release.id === plan.releaseId);
    if (
      official &&
      (official.manifest_sha256 !== plan.manifestSha256 ||
        official.source_sha256 !== plan.source.source.sha256)
    )
      throw new AppError(
        503,
        'BACKUP_RELEASE_MISMATCH',
        'Installed curriculum differs from its immutable source. Preserve the database and compatible source repository.',
      );
    const sourceManifest = await readFile(
      path.join(root, 'content', plan.releaseId, 'source-manifest.json'),
    );
    await durableFile(
      path.join(pending, 'source-manifest.json'),
      sourceManifest,
    );
    const interpretationNames = [
      'resource-labels',
      'resource-bindings',
      'resource-mentions',
    ] as const;
    const interpretations = await Promise.all(
      interpretationNames.map(async (kind) => {
        const file = `${plan.releaseId}-${kind}-v1.json`;
        return {
          file: `content/interpretations/${file}`,
          sha256: sha256(
            await readFile(path.join(root, 'content/interpretations', file)),
          ),
        };
      }),
    );
    // Flush the completed database before publishing the bundle/manifest.
    const file = await open(snapshotFile, 'r+');
    try {
      await file.sync();
    } finally {
      await file.close();
    }
    const manifest = {
      formatVersion: 1,
      method: 'sqlite-online-backup',
      startedAt,
      verifiedAt: new Date().toISOString(),
      database: {
        file: 'learning.sqlite',
        ...(await fileDigest(snapshotFile)),
      },
      checks: { integrity: 'ok', foreignKeys: 'ok', migrations: 'ok' },
      migrations: history,
      releases,
      sourceArchive: {
        releaseId: plan.releaseId,
        file: 'source-manifest.json',
        sha256: sha256(sourceManifest),
      },
      interpretations,
      application: {
        node: process.versions.node,
        packageLockSha256: sha256(
          await readFile(path.join(root, 'package-lock.json')),
        ),
      },
      sessions:
        'included; must be revoked by the stopped-server restore procedure',
      csrfSecret: 'excluded; restore must create a fresh secret',
    };
    await durableFile(
      path.join(pending, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    await verifyLockOwner();
    await rename(pending, destination);
    return {
      directory: destination,
      file: path.join(destination, 'learning.sqlite'),
      manifest,
    };
  } finally {
    database?.close();
    try {
      await verifyLockOwner();
    } finally {
      await lock.close();
    }
    await unlink(lockPath);
  }
}
