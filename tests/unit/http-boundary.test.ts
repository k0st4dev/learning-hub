import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { endpoint, guardRequest, readJson } from '../../src/server/http';
import { createCsrf } from '../../src/server/auth/csrf';
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return {
    ...fs,
    readFileSync: (
      filename: Parameters<typeof fs.readFileSync>[0],
      options?: Parameters<typeof fs.readFileSync>[1],
    ) =>
      String(filename).endsWith('csrf-secret')
        ? 'a'.repeat(64)
        : options === undefined
          ? fs.readFileSync(filename)
          : fs.readFileSync(filename, options),
  };
});
afterEach(() => vi.unstubAllEnvs());
const origin = 'http://127.0.0.1:3000';
const csrf = createCsrf('a'.repeat(64), undefined);
function request(extra: Record<string, string> = {}) {
  return new NextRequest(origin + '/api/auth/register', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      origin,
      cookie: `learning_csrf=${csrf}`,
      'x-csrf-token': csrf,
      ...extra,
    },
  });
}
describe('private HTTP boundary', () => {
  it('requires exact Host, Origin and matching signed CSRF on writes', () => {
    vi.stubEnv('APP_ORIGIN', origin);
    vi.stubEnv('PORT', '3000');
    expect(() => guardRequest(request())).not.toThrow();
    expect(() =>
      guardRequest(request({ origin: 'https://example.test' })),
    ).toThrow('local address');
    expect(() => guardRequest(request({ host: 'attacker.test:3000' }))).toThrow(
      'local address',
    );
    expect(() => guardRequest(request({ 'x-csrf-token': 'forged' }))).toThrow(
      'Refresh',
    );
    expect(() => guardRequest(request({ cookie: '' }))).toThrow('Refresh');
  });
  it('rejects malformed and oversized bodies before service validation', async () => {
    await expect(
      readJson(
        new Request(origin, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      readJson(
        new Request(origin, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'x'.repeat(32769),
        }),
      ),
    ).rejects.toMatchObject({ code: 'BODY_TOO_LARGE' });
  });
  it('never exposes internal error details and disables response caching', async () => {
    const response = await endpoint(() => {
      throw new Error('SQL password_hash secret-token');
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    expect(text).not.toMatch(/password_hash|secret-token|SQL/);
    expect(JSON.parse(text).error.requestId).toBeTruthy();
  });
});
