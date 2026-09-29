import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readConfig, validateRuntime } from '../src/server/config.ts';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function environment() {
  validateRuntime();
  process.chdir(root);
  // Load the more specific file first; shell variables retain precedence.
  for (const name of ['.env.local', '.env']) {
    const filename = path.join(root, name);
    if (existsSync(filename)) loadEnvFile(filename);
  }
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  const config = readConfig(process.env, root);
  process.env.APP_MODE = config.mode;
  process.env.APP_ORIGIN = config.origin;
  process.env.APP_DATA_DIR = config.dataDir;
  process.env.PORT = String(config.port);
  return config;
}
