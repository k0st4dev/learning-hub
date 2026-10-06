import { registerHooks } from 'node:module';
import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

// Node strips TypeScript in this test child. Match the application's relative
// extensionless .ts imports without altering production resolution or code.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.'))
        throw error;
      return next(specifier + '.ts', context);
    }
  },
});
const directory = path.resolve(process.argv[2]);
if (
  path.dirname(directory) !== path.join(process.cwd(), '.tmp') ||
  !path.basename(directory).startsWith('durable-journey-test-')
)
  throw new Error('Unexpected isolated test directory');
const { openDatabase } = await import('../../src/server/db/connection.ts');
const { mutateLearning } = await import('../../src/server/learning/mutate.ts');
const store = openDatabase(path.join(directory, 'learning.sqlite'));
const input = JSON.parse(
  await readFile(path.join(directory, 'request.json'), 'utf8'),
);
const confirmed = mutateLearning(store, input.token, input.payload);
// This acknowledgement is written only AFTER the actual service committed.
await writeFile(
  path.join(directory, 'acknowledged.partial'),
  JSON.stringify(confirmed),
);
await rename(
  path.join(directory, 'acknowledged.partial'),
  path.join(directory, 'acknowledged.json'),
);
// Deliberately leave SQLite open. The parent kills this owned test process.
setInterval(() => {}, 1000);
