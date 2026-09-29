import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.ts';

export function openDatabase(filename: string, create = false) {
  const native = new Database(filename, { fileMustExist: !create });
  try {
    native.pragma('foreign_keys = ON');
    native.pragma('journal_mode = WAL');
    native.pragma('synchronous = FULL');
    native.pragma('busy_timeout = 5000');
    return { native, orm: drizzle(native, { schema }) };
  } catch (error) {
    native.close();
    throw error;
  }
}
export type Store = ReturnType<typeof openDatabase>;
export type Orm = Store['orm'];
