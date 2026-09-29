import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { environment, root } from './environment.mjs';

const require = createRequire(import.meta.url);
try {
  const mode = process.argv[2];
  if (!['dev', 'build', 'start'].includes(mode) || process.argv.length !== 3) {
    throw new Error(
      'Use npm run dev, npm run build or npm start. Set PORT and APP_ORIGIN together in .env.local.',
    );
  }
  const config = environment();
  if (mode !== 'build') {
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', () =>
        reject(
          new Error(
            `Cannot listen on ${config.origin}. Close the application using that port, or set matching PORT and APP_ORIGIN in .env.local.`,
          ),
        ),
      );
      probe.listen(config.port, config.host, () => probe.close(resolve));
    });
    console.log(
      `Local URL: ${config.origin}\nData directory: ${config.dataDir}`,
    );
  }
  const args =
    mode === 'dev'
      ? [path.join(root, 'scripts/dev-server.mjs')]
      : [require.resolve('next/dist/bin/next'), mode];
  if (mode === 'start')
    args.push('--hostname', config.host, '--port', String(config.port));
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => child.kill(signal));
  child.once('error', () => {
    console.error(
      'Could not start Next.js. Run npm ci with the documented Node version.',
    );
    process.exitCode = 1;
  });
  child.once('exit', (code) => {
    process.exitCode = code ?? 1;
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Startup failed.');
  process.exitCode = 1;
}
