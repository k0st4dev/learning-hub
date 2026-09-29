import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConfig, validateRuntime } from '../../src/server/config.ts';
import { allowedLocalRequest } from '../../src/server/request-policy.ts';

describe('local configuration', () => {
  it('resolves persistent data relative to the repository, not the launch directory', () => {
    const root = path.resolve('test-repository');
    expect(readConfig({}, root)).toMatchObject({
      origin: 'http://127.0.0.1:3000',
      host: '127.0.0.1',
      dataDir: path.join(root, 'data'),
    });
  });
  it.each([
    { APP_MODE: 'hosted' },
    { APP_ORIGIN: 'http://0.0.0.0:3000' },
    { APP_ORIGIN: 'http://192.168.1.10:3000' },
    { APP_ORIGIN: 'https://example.com:3000' },
    { APP_ORIGIN: 'http://user:pass@127.0.0.1:3000' },
    { APP_ORIGIN: 'http://127.0.0.1:3000/path' },
    { APP_ORIGIN: 'http://127.0.0.1:3000?debug=1' },
    { PORT: '3001' },
    { PORT: 'NaN' },
    { APP_DATA_DIR: './relative' },
  ])('rejects unsafe or inconsistent values: %j', (env) => {
    expect(() => readConfig({ ...env, NODE_ENV: 'production' })).toThrow();
  });
  it.each(['public', '.next', 'src', 'node_modules'])(
    'keeps data out of %s',
    (directory) => {
      expect(() =>
        readConfig(
          { APP_DATA_DIR: path.resolve(directory, 'private') },
          process.cwd(),
        ),
      ).toThrow();
    },
  );
  it('supports production loopback and explicit matching custom port', () => {
    expect(
      readConfig({
        NODE_ENV: 'production',
        PORT: '3100',
        APP_ORIGIN: 'http://127.0.0.1:3100',
      }).port,
    ).toBe(3100);
  });
  it('checks the documented runtime without imposing NODE_ENV restrictions', () => {
    expect(() => validateRuntime('24.21.0')).not.toThrow();
    expect(() => validateRuntime('18.20.0')).toThrow();
  });
});

describe('local request boundary', () => {
  const origin = 'http://127.0.0.1:3000';
  it.each([
    ['GET', { host: '127.0.0.1:3000' }, true],
    ['POST', { host: '127.0.0.1:3000', origin }, true],
    ['POST', { host: '127.0.0.1:3000' }, false],
    ['GET', { host: 'attacker.example:3000' }, false],
    [
      'POST',
      { host: '127.0.0.1:3000', origin: 'http://attacker.example' },
      false,
    ],
    ['GET', { host: '127.0.0.1:3000', origin: 'null' }, false],
  ] as const)('%s %j -> %s', (method, headers, allowed) => {
    expect(allowedLocalRequest(new Headers(headers), method, origin)).toBe(
      allowed,
    );
  });
});
