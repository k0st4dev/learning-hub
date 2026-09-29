import { describe, expect, it } from 'vitest';
import { passwordSchema } from '../../src/server/auth/passwords.ts';
import { safeReturnPath } from '../../src/server/auth/service.ts';
import { createCsrf, verifyCsrf } from '../../src/server/auth/csrf.ts';

describe('password and redirect policy', () => {
  it('counts Unicode code points and preserves spaces', () => {
    expect(passwordSchema.parse('🌲'.repeat(15))).toBe('🌲'.repeat(15));
    expect(passwordSchema.parse('  a meaningful secret phrase  ')).toBe(
      '  a meaningful secret phrase  ',
    );
    expect(passwordSchema.safeParse('🌲'.repeat(14)).success).toBe(false);
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
    expect(passwordSchema.safeParse('123456789987654321').success).toBe(false);
  });
  it.each([
    'https://attacker.example',
    '//attacker.example',
    '/\\attacker.example',
    '/\nattacker.example',
  ])('rejects unsafe return destination %j', (value) =>
    expect(safeReturnPath(value)).toBe('/dashboard'),
  );
  it('preserves a valid study return path', () =>
    expect(safeReturnPath('/course/software-engineer/days/d001#study')).toBe(
      '/course/software-engineer/days/d001#study',
    ));
});
describe('signed CSRF binding', () => {
  const now = 1800000000000;
  const token = createCsrf('server-secret', 'session-token', now);
  it('requires matching cookie, header, session and fresh signature', () => {
    expect(
      verifyCsrf('server-secret', 'session-token', token, token, now),
    ).toBe(true);
    expect(
      verifyCsrf('server-secret', 'other-session', token, token, now),
    ).toBe(false);
    expect(verifyCsrf('other-secret', 'session-token', token, token, now)).toBe(
      false,
    );
    expect(
      verifyCsrf('server-secret', 'session-token', undefined, token, now),
    ).toBe(false);
    expect(verifyCsrf('server-secret', 'session-token', token, null, now)).toBe(
      false,
    );
    expect(
      verifyCsrf('server-secret', 'session-token', token, token, now + 3600001),
    ).toBe(false);
  });
});
