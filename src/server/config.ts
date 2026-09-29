import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const schema = z.object({
  APP_MODE: z.literal('local').default('local'),
  APP_ORIGIN: z.string().default('http://127.0.0.1:3000'),
  APP_DATA_DIR: z.string().optional(),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info']).default('info'),
});

export function validateRuntime(version = process.versions.node) {
  if (!/^24\.21\.\d+$/.test(version)) {
    throw new Error(
      'Use the tested Node.js 24.21.x runtime (see .node-version).',
    );
  }
}

export function readConfig(
  env: Record<string, string | undefined> = process.env,
  root = repositoryRoot,
) {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid local configuration: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}. See .env.example.`,
    );
  }
  const parsed = result.data;
  let origin: URL;
  try {
    origin = new URL(parsed.APP_ORIGIN);
  } catch {
    throw new Error('APP_ORIGIN must be http://127.0.0.1:<PORT>.');
  }
  if (
    origin.protocol !== 'http:' ||
    origin.hostname !== '127.0.0.1' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.port !== String(parsed.PORT)
  ) {
    throw new Error(
      'Local mode requires APP_ORIGIN=http://127.0.0.1:<PORT>, with matching PORT and no path or credentials.',
    );
  }
  if (
    parsed.APP_DATA_DIR !== undefined &&
    !path.isAbsolute(parsed.APP_DATA_DIR)
  ) {
    throw new Error(
      'APP_DATA_DIR must be an absolute path, or omitted to use the repository data directory.',
    );
  }
  const dataDir = path.resolve(parsed.APP_DATA_DIR ?? path.join(root, 'data'));
  for (const reserved of ['public', '.next', 'src', 'node_modules']) {
    const relative = path.relative(path.join(root, reserved), dataDir);
    if (
      relative === '' ||
      (!relative.startsWith(`..${path.sep}`) &&
        relative !== '..' &&
        !path.isAbsolute(relative))
    ) {
      throw new Error(
        'APP_DATA_DIR must be outside public, build, source and dependency directories.',
      );
    }
  }
  return {
    mode: parsed.APP_MODE,
    origin: origin.origin,
    host: '127.0.0.1',
    port: parsed.PORT,
    dataDir,
    logLevel: parsed.LOG_LEVEL,
  } as const;
}
