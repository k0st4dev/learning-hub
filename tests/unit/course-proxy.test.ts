import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../../src/proxy';
import { courseAvailability } from '../../src/server/content/availability';
import { AppError } from '../../src/server/errors';
vi.mock('../../src/server/db/current', () => ({ getStore: () => ({}) }));
vi.mock('../../src/server/content/availability', async (original) => ({
  ...(await original<typeof import('../../src/server/content/availability')>()),
  courseAvailability: vi.fn(() => null),
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(courseAvailability).mockReturnValue(null);
});
const request = (path = '/course/software-engineer/days/unknown') =>
  new NextRequest(`http://127.0.0.1:3000${path}`, {
    headers: { host: '127.0.0.1:3000', 'x-course-issue': 'setup' },
  });
describe('course status before streaming', () => {
  it.each([
    ['missing', 404],
    ['setup', 503],
    ['unpublished', 503],
    ['unavailable', 503],
  ] as const)(
    'returns %s as HTTP %s with private recovery headers',
    (issue, status) => {
      vi.mocked(courseAvailability).mockReturnValue(issue);
      const response = proxy(request());
      expect(response.status).toBe(status);
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'http://127.0.0.1:3000/course-state',
      );
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-security-policy')).toContain(
        "frame-ancestors 'none'",
      );
      expect(response.headers.get('x-middleware-request-x-course-issue')).toBe(
        issue,
      );
      expect(response.headers.get('retry-after')).toBe(
        status === 503 ? '5' : null,
      );
    },
  );
  it('removes forged state headers and never intercepts mutations or unrelated pages', () => {
    for (const path of ['/course-state', '/login', '/api/progress/lesson/x']) {
      const response = proxy(request(path));
      expect(
        response.headers.get('x-middleware-request-x-course-issue'),
      ).toBeNull();
    }
    expect(courseAvailability).not.toHaveBeenCalled();
    proxy(
      new NextRequest('http://127.0.0.1:3000/course/software-engineer', {
        method: 'POST',
        headers: { host: '127.0.0.1:3000' },
      }),
    );
    expect(courseAvailability).not.toHaveBeenCalled();
  });
  it('classifies unavailable database failures without exposing their details', () => {
    vi.mocked(courseAvailability).mockImplementation(() => {
      throw new Error('SQL secret');
    });
    expect(
      proxy(request()).headers.get('x-middleware-request-x-course-issue'),
    ).toBe('unavailable');
    vi.mocked(courseAvailability).mockImplementation(() => {
      throw new AppError(503, 'SETUP_REQUIRED', 'private path');
    });
    expect(
      proxy(request()).headers.get('x-middleware-request-x-course-issue'),
    ).toBe('setup');
  });
});
