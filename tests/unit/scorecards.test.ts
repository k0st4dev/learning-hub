import { describe, expect, it } from 'vitest';
import {
  scorecardPeriod,
  scorecardPeriodSchema,
  scorecardEntries,
} from '../../src/domain/scorecards';

describe('student calendar month', () => {
  it.each([
    ['UTC', '2026-10-01T00:30:00Z', '2026-10'],
    ['America/Los_Angeles', '2026-10-01T00:30:00Z', '2026-09'],
    ['Pacific/Kiritimati', '2026-12-31T12:30:00Z', '2027-01'],
    ['Europe/Ljubljana', '2026-03-31T22:30:00Z', '2026-04'],
    ['America/New_York', '2026-11-01T05:30:00Z', '2026-11'],
    ['America/New_York', '2026-11-01T06:30:00Z', '2026-11'],
  ])('uses %s at %s', (timezone, instant, period) => {
    expect(scorecardPeriod(timezone, Date.parse(instant))).toBe(period);
  });
  it('rejects invalid timezone/date instead of silently using server time', () => {
    expect(() => scorecardPeriod('Invalid/Zone')).toThrow();
    expect(() => scorecardPeriod('UTC', NaN)).toThrow();
  });
  it.each(['0000-01', '2026-00', '2026-13', '2026-1', '26-01', '../2026-01'])(
    'rejects malformed month %s',
    (period) => {
      expect(scorecardPeriodSchema.safeParse(period).success).toBe(false);
    },
  );
  it('preserves zero and plain text, omits unassessed keys and uses source order', () => {
    expect(scorecardEntries(['A', 'B', 'C'], { C: 3, A: 0 })).toEqual({
      A: 0,
      C: 3,
    });
    expect(
      Object.keys(scorecardEntries(['A', 'B'], { B: 'b', A: 'a' })),
    ).toEqual(['A', 'B']);
    expect(() => scorecardEntries(['A'], { foreign: 0 })).toThrow();
  });
});
