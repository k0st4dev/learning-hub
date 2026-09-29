import path from 'node:path';
import { existsSync } from 'node:fs';
import { readConfig } from '../config.ts';
import { openDatabase, type Store } from './connection.ts';
import { AppError } from '../errors.ts';

const globalStore = globalThis as typeof globalThis & {
  learningStore?: { filename: string; store: Store };
};
export function getStore() {
  const config = readConfig(process.env, process.cwd());
  const filename = path.join(config.dataDir, 'learning.sqlite');
  if (globalStore.learningStore?.filename === filename)
    return globalStore.learningStore.store;
  if (!existsSync(filename))
    throw new AppError(
      503,
      'SETUP_REQUIRED',
      'Run the documented setup command before using accounts.',
    );
  try {
    const store = openDatabase(filename);
    try {
      const ready = store.native
        .prepare('SELECT id FROM _app_migration WHERE id = ?')
        .get('0001');
      if (!ready) throw new Error('Missing schema');
    } catch (error) {
      store.native.close();
      throw error;
    }
    globalStore.learningStore = { filename, store };
    return store;
  } catch {
    throw new AppError(
      503,
      'DATABASE_UNAVAILABLE',
      'Local data could not be opened. Preserve the data directory and follow the recovery instructions.',
    );
  }
}
