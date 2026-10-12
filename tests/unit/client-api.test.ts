import { afterEach, expect, it, vi } from 'vitest';
import { RequestError, writeApi } from '../../src/lib/client-api';
afterEach(() => vi.unstubAllGlobals());
it.each([900, -1, '900', undefined])(
  'preserves only valid server retry delays without retaining the submitted password: %j',
  async (retryAfter) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { token: 'csrf-test' } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: 'Too many attempts.', retryAfter },
          }),
          { status: 429 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    let failure: unknown;
    try {
      await writeApi('/api/auth/login', 'POST', {
        email: 'owner@example.test',
        password: 'private synthetic test phrase',
      });
    } catch (cause) {
      failure = cause;
    }
    expect(failure).toBeInstanceOf(RequestError);
    expect((failure as RequestError).retryAfter).toBe(
      retryAfter === 900 ? 900 : undefined,
    );
    expect(JSON.stringify(failure)).not.toContain(
      'private synthetic test phrase',
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);
