import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadArchivedCurriculum } from '../../src/server/content/import.ts';
import { courseNavigation } from '../../src/server/content/navigation.ts';
let input: Parameters<typeof courseNavigation>[0];
const id = (key: string) => `se-26w-v1:${key}`;
const day = (n: number) => `d${String(n).padStart(3, '0')}`;
const route = (n: number, kind: 'lesson' | 'exercise') =>
  `/course/software-engineer/days/${day(n)}/${kind}s/${day(n)}-${kind === 'lesson' ? 'learn' : 'practice'}`;
beforeAll(async () => {
  const plan = await loadArchivedCurriculum(process.cwd());
  input = {
    items: plan.items.map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      parentId: item.parentId ?? null,
      orderIndex: item.orderIndex,
      route: z
        .object({ route: z.string() })
        .parse(JSON.parse(item.metadataJson!)).route,
    })),
    days: plan.days,
    weeks: plan.weeks,
  };
});
describe('source-ordered reading navigation', () => {
  it('traverses every required unit once in both directions across all week and phase boundaries', () => {
    const navigation = courseNavigation(input);
    const expected = Array.from({ length: 182 }, (_, i) => [
      route(i + 1, 'lesson'),
      route(i + 1, 'exercise'),
    ]).flat();
    expect(navigation.unitSequence.map((item) => item.route)).toEqual(expected);
    for (const [position, item] of navigation.unitSequence.entries()) {
      const page = navigation.forItem(item.id)!;
      expect(page.previous?.href).toBe(
        expected[position - 1] ?? '/course/software-engineer/preparation',
      );
      expect(page.next?.href).toBe(
        expected[position + 1] ?? '/course/software-engineer/progress',
      );
    }
    expect(new Set(expected).size).toBe(364);
  });
  it('keeps day navigation separate and exposes explicit first/last boundaries', () => {
    const navigation = courseNavigation(input);
    expect(navigation.daySequence).toHaveLength(182);
    for (let n = 1; n <= 182; n++) {
      const page = navigation.forItem(id(day(n)))!;
      expect(page.mode).toBe('day');
      expect(page.previous?.href ?? null).toBe(
        n === 1 ? null : `/course/software-engineer/days/${day(n - 1)}`,
      );
      expect(page.next?.href ?? null).toBe(
        n === 182 ? null : `/course/software-engineer/days/${day(n + 1)}`,
      );
    }
  });
  it('is independent of database row order and does not mutate its input', () => {
    const before = structuredClone(input);
    const reversed = courseNavigation({
      ...input,
      items: [...input.items].reverse(),
      days: [...input.days].reverse(),
    });
    expect(reversed.unitSequence).toEqual(courseNavigation(input).unitSequence);
    expect(reversed.daySequence).toEqual(courseNavigation(input).daySequence);
    expect(input).toEqual(before);
  });
  it('uses stable IDs and numbered breadcrumbs even when study/exercise or checkpoint titles repeat', () => {
    const navigation = courseNavigation(input);
    const page = navigation.forItem(id('d007-practice'))!;
    expect(page.breadcrumbs.map((item) => item.kind)).toEqual([
      'module',
      'week',
      'day',
      'exercise',
    ]);
    expect(page.current.dayNumber).toBe(7);
    expect(page.current.weekNumber).toBe(1);
    expect(
      navigation.children(id('w01')).map((item) => item.dayNumber),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('does not invent navigation for unknown items or reference guides', () => {
    const navigation = courseNavigation(input);
    expect(navigation.forItem('missing')).toBeNull();
    expect(navigation.forItem(id('guide-appendix-a'))).toMatchObject({
      mode: null,
      previous: null,
      next: null,
    });
  });
  it('rejects missing parents and cycles instead of looping', () => {
    const item = input.items[0]!;
    expect(() =>
      courseNavigation({ ...input, items: [{ ...item, parentId: item.id }] }),
    ).toThrow('cycle');
    expect(() =>
      courseNavigation({ ...input, items: [{ ...item, parentId: 'missing' }] }),
    ).toThrow('parent');
  });
});
