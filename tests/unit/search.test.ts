import { describe, expect, it } from 'vitest';
import {
  escapeLike,
  normalizeSearch,
  searchQuerySchema,
  searchSnippet,
  searchTokens,
  searchInput,
  searchHref,
  searchHighlights,
  searchResponseSchema,
} from '../../src/domain/search';

describe('literal Unicode curriculum search', () => {
  it('roundtrips repeated filters and paging without losing technical punctuation', () => {
    const query = searchQuerySchema.parse({
      q: 'C++ ČĆ',
      kind: ['lesson', 'exercise'],
      week: ['w04', 'w08'],
      page: 2,
    });
    expect(
      searchQuerySchema.parse(
        searchInput(
          new URL(searchHref(query), 'http://localhost').searchParams,
        ),
      ),
    ).toEqual(query);
    expect(
      searchQuerySchema.safeParse(
        searchInput(new URLSearchParams('__proto__=foreign')),
      ).success,
    ).toBe(false);
    expect(
      searchQuerySchema.safeParse(searchInput(new URLSearchParams('q=a&q=b')))
        .success,
    ).toBe(false);
  });
  it('maps overlapping/decomposed matches back to exact original text', () => {
    const text = 'ČĆ c\u030c JavaScript <b>literal</b>';
    const parts = searchHighlights(text, ['c', 'cc', 'javascript']);
    expect(parts.map((part) => part.text).join('')).toBe(text);
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(
      ['ČĆ', 'c\u030c', 'JavaScript'],
    );
    expect(searchHighlights('😀', [])).toEqual([{ text: '😀', match: false }]);
  });
  it('rejects unsafe result links rather than producing executable markup', () => {
    expect(
      searchResponseSchema.safeParse({
        releaseId: 'release',
        query: {},
        total: 1,
        pageSize: 20,
        results: [
          {
            id: 'one',
            kind: 'guide',
            title: '<script>text</script>',
            href: 'javascript:evil()',
            snippet: '',
            breadcrumbs: [],
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('normalizes Serbian Latin, decomposed accents and English technical terms', () => {
    expect(
      normalizeSearch('ČĆŽŠĐ čćžšđ JavaScript TypeScript Node.js C++ C#'),
    ).toBe('cczsd cczsd javascript typescript node.js c++ c#');
    expect(normalizeSearch('c\u030c s\u030c e\u0301')).toBe('c s e');
  });
  it('requires literal whitespace tokens without interpreting search operators', () => {
    expect(searchTokens('  Čitati  ČITATI C++ OR  ')).toEqual([
      'citati',
      'c++',
      'or',
    ]);
    expect(escapeLike('a%_\\b')).toBe('a\\%\\_\\\\b');
  });
  it.each(['x'.repeat(101), 'a b c d e f g h i'])(
    'rejects an over-budget query',
    (q) => {
      expect(searchQuerySchema.safeParse({ q }).success).toBe(false);
    },
  );
  it('accepts empty guidance, one-character Enter terms and bounded filters', () => {
    expect(searchQuerySchema.parse({})).toEqual({
      q: '',
      page: 1,
      kind: [],
      module: [],
      week: [],
      day: [],
    });
    expect(
      searchQuerySchema.parse({
        q: ' C ',
        page: '2',
        kind: ['lesson', 'guide'],
      }).q,
    ).toBe('C');
  });
  it.each([
    { page: 0 },
    { page: '1 OR 1=1' },
    { page: 1.5 },
    { page: 10001 },
    { kind: ['password'] },
    { releaseId: 'other' },
    { module: Array(9).fill('m01') },
  ])('rejects malformed parameters %j', (input) => {
    expect(searchQuerySchema.safeParse(input).success).toBe(false);
  });
  it('retains original Serbian and plain markup, centering a bounded matching excerpt', () => {
    const text =
      '😀'.repeat(120) +
      ' ČĆŽŠĐ <script>plain text</script> ' +
      'end '.repeat(100);
    const snippet = searchSnippet(text, ['cczsd']);
    expect(snippet).toContain('ČĆŽŠĐ <script>plain text</script>');
    expect(snippet.startsWith('…')).toBe(true);
    expect(Array.from(snippet).length).toBeLessThanOrEqual(182);
    expect(snippet).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
    expect(text).toContain('ČĆŽŠĐ');
  });
});
