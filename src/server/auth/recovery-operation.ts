import path from 'node:path';
import { open, unlink, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { acquireOperationLock } from '../db/operation-lock.ts';
import { openDatabase } from '../db/connection.ts';
import { reviewedMigrations } from '../db/migrations.ts';
import { readConfig } from '../config.ts';
import { passwordSchema } from './passwords.ts';
import { recoveryAccount, recoverPassword } from './recovery.ts';
import { AppError } from '../errors.ts';

export type RecoveryPrompts = {
  signal: AbortSignal;
  ask: (prompt: string, secret?: boolean) => Promise<string>;
};
/** IO is injected for deterministic tests; only the CLI provides terminal IO. */
export async function executeRecovery(
  config: ReturnType<typeof readConfig>,
  root: string,
  prompts: RecoveryPrompts,
  output: (text: string) => void,
) {
  const lease = await acquireOperationLock(
    config.dataDir,
    root,
    'password-recovery',
  );
  let setupFence, store;
  const port = createServer((socket) => socket.destroy());
  try {
    await new Promise<void>((resolve, reject) => {
      port.once('error', () =>
        reject(
          new AppError(
            409,
            'SERVER_RUNNING',
            'Stop the application using the configured local port before recovering a password.',
          ),
        ),
      );
      port.listen(config.port, config.host, resolve);
    });
    setupFence = await open(
      path.join(lease.directory, '.setup.lock'),
      'wx',
      0o600,
    ).catch(() => {
      throw new AppError(
        409,
        'SETUP_RUNNING',
        'Setup is active or its lock remains. Verify it is stopped before password recovery.',
      );
    });
    store = openDatabase(path.join(lease.directory, 'learning.sqlite'));
    const history = store.native
      .prepare('SELECT id,checksum FROM _app_migration ORDER BY id')
      .all() as { id: string; checksum: string }[];
    if (history.length !== reviewedMigrations.length)
      throw new AppError(
        503,
        'SCHEMA_MISMATCH',
        'Use a compatible application and run setup before recovery. Preserve the existing database.',
      );
    for (const [index, migration] of reviewedMigrations.entries()) {
      const sql = await readFile(
        path.join(root, 'drizzle', migration.file),
        'utf8',
      );
      if (
        history[index]!.id !== migration.id ||
        history[index]!.checksum !==
          createHash('sha256').update(sql).digest('hex')
      )
        throw new AppError(
          503,
          'SCHEMA_MISMATCH',
          'Migration history does not match this application. Preserve the database and restore its compatible version before recovery.',
        );
    }
    if (
      store.native.pragma('integrity_check', { simple: true }) !== 'ok' ||
      (store.native.pragma('foreign_key_check') as unknown[]).length
    )
      throw new AppError(
        503,
        'INTEGRITY_FAILED',
        'Database integrity check failed. Preserve your data and restore a verified backup before recovery.',
      );
    output(
      `Local password recovery for the trusted device owner.\nData directory: ${lease.directory}\nThis resets one account and signs out its sessions. Learning records stay saved.\n`,
    );
    const account = recoveryAccount(
      store,
      await prompts.ask('Account email: '),
    );
    const confirmation = await prompts.ask(
      `Selected account: ${account.email}\nType RESET to reset this account: `,
    );
    if (confirmation !== 'RESET')
      throw new AppError(
        400,
        'RECOVERY_CANCELED',
        'Recovery canceled. No password was changed.',
      );
    output(
      'New password: 15–128 characters, at most 512 UTF-8 bytes. Input is hidden; paste is supported. Spaces are preserved.\n',
    );
    const newPassword = passwordSchema.parse(
      await prompts.ask('New password (hidden): ', true),
    );
    await recoverPassword(
      store,
      { email: account.email, expectedStudentId: account.id, newPassword },
      prompts.signal,
    );
    output(
      'Password reset confirmed. All sessions for this account were revoked. Restart the application and sign in with the new password.\n',
    );
    return account;
  } finally {
    store?.native.close();
    try {
      if (setupFence) {
        await setupFence.close();
        await unlink(path.join(lease.directory, '.setup.lock'));
      }
    } finally {
      try {
        if (port.listening)
          await new Promise<void>((resolve) => port.close(() => resolve()));
      } finally {
        await lease.release();
      }
    }
  }
}
