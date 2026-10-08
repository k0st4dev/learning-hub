import { describe, expect, it } from 'vitest';
import {
  escapeLike,
  normalizeSearch,
  searchQuerySchema,
  searchSnippet,
  searchTokens,
} from '../../src/domain/search';

describe('literal Unicode curriculum search', () => {
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
