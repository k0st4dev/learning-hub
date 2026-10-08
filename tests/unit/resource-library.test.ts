import { describe, expect, it } from 'vitest';
import {
  resourceLibraryHref,
  resourceQueryInput,
  resourceQuerySchema,
  resourceUseMatches,
  resourceTypes,
} from '../../src/domain/resource-library';

describe('resource library query contract', () => {
  it('roundtrips repeated provider/type/scopes/requiredness and twenty-five-result page state', () => {
    const query = resourceQuerySchema.parse({
      q: '  C++ vežbe  ',
      source: ['MDN', 'Original instruction without supplied URL'],
      type: ['documentation', 'reference'],
      module: ['f1'],
      week: ['w01', 'w02'],
      day: ['d001'],
      requirement: ['required', 'optional'],
      page: 3,
    });
    const href = resourceLibraryHref(query);
    expect(href.startsWith('/resources?q=C%2B%2B')).toBe(true);
    expect(
      resourceQuerySchema.parse(
        resourceQueryInput(new URL(href, 'http://localhost').searchParams),
      ),
    ).toEqual(query);
    expect(resourceLibraryHref(resourceQuerySchema.parse({}))).toBe(
      '/resources',
    );
  });
  it('rejects unknown and duplicate scalar URL parameters, including prototype keys', () => {
    for (const text of [
      'q=a&q=b',
      'page=1&page=2',
      'releaseId=foreign',
      'userId=foreign',
      '__proto__=value',
      'kind=resource',
    ])
      expect(
        resourceQuerySchema.safeParse(
          resourceQueryInput(new URLSearchParams(text)),
        ).success,
        text,
      ).toBe(false);
    expect(
      Object.hasOwn(
        resourceQueryInput(new URLSearchParams('__proto__=value')),
        '__proto__',
      ),
    ).toBe(true);
  });
  it('bounds queries, scope values, types and original conditional labels', () => {
    for (const input of [
      { q: 'x'.repeat(101) },
      { q: 'a a a a a a a a a' },
      { page: 0 },
      { page: 10001 },
      { page: 1.5 },
      { source: ['x'.repeat(201)] },
      { source: Array(17).fill('MDN') },
      { day: Array(9).fill('d001') },
      { type: ['script'] },
      { requirement: ['completed'] },
    ])
      expect(resourceQuerySchema.safeParse(input).success).toBe(false);
    expect(
      resourceQuerySchema.parse({
        q: 'C',
        type: [...resourceTypes],
        requirement: ['conditional'],
      }).q,
    ).toBe('C');
  });
  it('requires the same use to satisfy all contextual filters, with OR inside each dimension', () => {
    const use = {
      requirementMode: 'required',
      module: 'f1',
      week: 'w01',
      day: 'd001',
    };
    expect(
      resourceUseMatches(
        resourceQuerySchema.parse({
          week: ['w01', 'w02'],
          requirement: ['required', 'optional'],
        }),
        use,
      ),
    ).toBe(true);
    expect(
      resourceUseMatches(
        resourceQuerySchema.parse({ week: ['w02'], requirement: ['required'] }),
        use,
      ),
    ).toBe(false);
    expect(
      resourceUseMatches(
        resourceQuerySchema.parse({ day: ['d001'], requirement: ['optional'] }),
        use,
      ),
    ).toBe(false);
    expect(
      resourceUseMatches(
        resourceQuerySchema.parse({
          module: ['f1'],
          week: ['w01'],
          day: ['d002'],
        }),
        use,
      ),
    ).toBe(false);
  });
  it('does not fabricate inherited coordinates for handbook and week-only references', () => {
    const use = {
      requirementMode: 'reference',
      module: 'f1',
      week: 'w01',
      day: null,
    };
    expect(
      resourceUseMatches(resourceQuerySchema.parse({ week: ['w01'] }), use),
    ).toBe(true);
    expect(
      resourceUseMatches(resourceQuerySchema.parse({ day: ['d001'] }), use),
    ).toBe(false);
    expect(
      resourceUseMatches(resourceQuerySchema.parse({}), {
        ...use,
        module: null,
        week: null,
      }),
    ).toBe(true);
  });
});
