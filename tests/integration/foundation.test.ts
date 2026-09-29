import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { runProcess } from './run-process.ts';

describe('foundation integration', () => {
  it('uses native SQLite, Drizzle and Argon2id with a disk reopen', async () => {
    const { code, stdout } = await runProcess(['scripts/doctor.mjs']);
    expect(code).toBe(0);
    expect(stdout).toContain('write/reopen/integrity passed');
    expect(stdout).toContain('parameterized query passed');
    expect(stdout).toContain('64 MiB / 3 iterations / p=1 passed');
  });
  it('fails clearly before starting if the configured port is occupied', async () => {
    const server = createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing probe port');
      expect(
        await runProcess(['scripts/run-next.mjs', 'start'], {
          ...process.env,
          PORT: String(address.port),
          APP_ORIGIN: `http://127.0.0.1:${address.port}`,
        }),
      ).toMatchObject({
        code: 1,
        stderr: expect.stringContaining('Cannot listen on'),
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
  });
  it('does not accept a command-line override to bind to the network', async () => {
    expect(
      await runProcess([
        'scripts/run-next.mjs',
        'start',
        '--hostname',
        '0.0.0.0',
      ]),
    ).toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Use npm run dev'),
    });
  });
});
