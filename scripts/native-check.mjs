import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { hash, verify, argon2id } from 'argon2';

export async function checkNativeDependencies() {
  const temporary = await mkdtemp(
    path.join(tmpdir(), 'learning-platform-native-'),
  );
  let connection;
  try {
    connection = new Database(path.join(temporary, 'probe.sqlite'));
    connection.pragma('foreign_keys = ON');
    connection.pragma('journal_mode = WAL');
    connection.pragma('synchronous = FULL');
    connection.pragma('busy_timeout = 5000');
    const db = drizzle(connection);
    db.run(
      sql`CREATE TABLE probe (id INTEGER PRIMARY KEY, message TEXT NOT NULL)`,
    );
    db.run(sql`INSERT INTO probe VALUES (1, ${'Persistent native database'})`);
    connection.close();
    connection = new Database(path.join(temporary, 'probe.sqlite'), {
      fileMustExist: true,
    });
    if (
      connection.prepare('SELECT message FROM probe').pluck().get() !==
      'Persistent native database'
    )
      throw new Error('SQLite reopen verification failed.');
    if (connection.pragma('integrity_check', { simple: true }) !== 'ok')
      throw new Error('SQLite integrity check failed.');
    const password = 'Native dependency verification only';
    const encoded = await hash(password, {
      type: argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    if (
      !encoded.startsWith('$argon2id$') ||
      !(await verify(encoded, password)) ||
      (await verify(encoded, 'wrong password'))
    )
      throw new Error('Argon2id verification failed.');
    return {
      sqlite: 'write/reopen/integrity passed',
      drizzle: 'parameterized query passed',
      argon2id: '64 MiB / 3 iterations / p=1 passed',
    };
  } finally {
    if (connection?.open) connection.close();
    // Only remove the unique temporary directory this function created.
    if (
      path.dirname(temporary) !== path.resolve(tmpdir()) ||
      !path.basename(temporary).startsWith('learning-platform-native-')
    )
      throw new Error('Unexpected temporary path');
    await rm(temporary, { recursive: true, force: true });
  }
}
