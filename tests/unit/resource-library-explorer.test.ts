// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ResourceLibraryExplorer } from '../../src/components/resource-library-explorer';
import {
  resourceQueryInput,
  resourceQuerySchema,
  resourceLibraryHref,
  type ResourceQuery,
} from '../../src/domain/resource-library';
import {
  resourceLibraryViewSchema,
  type ResourceLibraryView,
} from '../../src/domain/resource-library-view';

const evidence = {
  sourceId: 'p1475',
  exactText: 'Original optional wording <img onerror=evil>',
  sha256: 'hash',
  table: 1,
  row: 2,
  cell: 3,
};
const interpretation = {
  origin: 'added-product-interpretation' as const,
  version: 'se-26w-v1-resource-labels-v1',
  ambiguity: false,
  evidence: [evidence],
};
const row: ResourceLibraryView['results'][number] = {
  id: 'resource1',
  title: 'Odin original <script>evil</script>',
  href: '/resources/res-02',
  descriptionMarkdown: 'Original description <img onerror=evil>',
  originalUrl: 'https://example.test/original',
  resolvedUrl: null,
  sourceName: 'Original Odin title',
  type: 'reference',
  linkOrigin: 'source',
  linkStatus: 'unchecked',
  checkedAt: null,
  effective: {
    type: 'course',
    provider: 'The Odin Project',
    sourceFilterKey: 'provider/The%20Odin%20Project',
  },
  interpretation: {
    ...interpretation,
    confidence: 'high',
    rationale: 'Added explanation',
    category: 'named-resource',
  },
  uses: [
    {
      id: 'use1',
      resourceId: 'resource1',
      binding: {
        originalResourceId: 'resource1',
        effectiveResourceId: 'resource1',
        changed: false,
        originalResource: {
          id: 'resource1',
          title: 'Odin original',
          href: '/resources/res-02',
        },
        effectiveResource: {
          id: 'resource1',
          title: 'Odin original',
          href: '/resources/res-02',
        },
        interpretation: {
          origin: 'imported-metadata',
          version: null,
          sourceId: null,
          kind: null,
          reason: null,
          evidence: [],
        },
      },
      assignedText: 'TOP optional; CS50 assigned.',
      sectionLocator: null,
      requirementMode: 'reference',
      href: '/course/software-engineer/days/d113/lessons/d113-learn',
      title: 'Original lesson',
      day: 'd113',
      dayNumber: 113,
      breadcrumbs: [],
      effective: { requirementMode: 'optional', resourceId: 'resource1' },
      interpretation: {
        ...interpretation,
        sourceId: 'p1475',
        ruleDescription: 'Only TOP is optional.',
        choiceGroup: null,
        caveats: ['Assigned section only.'],
      },
    },
  ],
  originalUses: [],
  matchingUseIds: ['use1'],
  relatedDays: [
    {
      href: '/course/software-engineer/days/d113',
      title: 'Original day',
      dayNumber: 113,
    },
  ],
};
const options = {
  source: [
    { value: 'provider/The%20Odin%20Project', label: 'The Odin Project' },
  ],
  module: [{ value: 'f4', label: 'Original phase' }],
  week: [{ value: 'w17', label: 'Original week' }],
  day: [{ value: 'd113', label: 'Day 113' }],
};
function data(
  query: ResourceQuery,
  extra: Partial<ResourceLibraryView> = {},
): ResourceLibraryView {
  return {
    releaseId: 'se-26w-v1',
    query,
    pageSize: 25,
    total: 1,
    results: [row],
    options,
    ...extra,
  };
}
function response(url: string, extra: Partial<ResourceLibraryView> = {}) {
  const query = resourceQuerySchema.parse(
    resourceQueryInput(new URL(url, 'http://localhost').searchParams),
  );
  return new Response(JSON.stringify({ data: data(query, extra) }), {
    status: 200,
  });
}
let fetcher: ReturnType<typeof vi.fn>;
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
async function advance(ms = 250) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
function mount(input: unknown = {}, extra: Partial<ResourceLibraryView> = {}) {
  const parsed = resourceQuerySchema.safeParse(input);
  window.history.replaceState(
    {},
    '',
    parsed.success ? resourceLibraryHref(parsed.data) : '/resources?q=a&q=b',
  );
  return render(
    createElement(ResourceLibraryExplorer, {
      studentId: 'owner',
      releaseId: 'se-26w-v1',
      initialInput: input,
      initialData: parsed.success ? data(parsed.data, extra) : null,
    }),
  );
}
const field = () =>
  screen.getByRole('searchbox', {
    name: 'Search resources',
  }) as HTMLInputElement;
beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/resources');
  fetcher = vi.fn(async (url: string) => response(url));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('resource library explorer', () => {
  it('server-renders original content and separate labels, then validates the account during hydration', async () => {
    const html = renderToString(
      createElement(ResourceLibraryExplorer, {
        studentId: 'owner',
        releaseId: 'se-26w-v1',
        initialInput: {},
        initialData: data(resourceQuerySchema.parse({})),
      }),
    );
    expect(html).toContain('TOP optional; CS50 assigned.');
    expect(html).toContain('Original metadata and added labels');
    expect(html).toContain('evil&lt;/script&gt;');
    expect(html).not.toContain('<script>evil');
    mount();
    await settle();
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      cache: 'no-store',
      headers: { 'x-expected-student': 'owner' },
    });
    expect(screen.getByRole('status').textContent).toContain(
      '1 resource. Page 1 of 1.',
    );
    const original = screen.getByRole('link', {
      name: 'Open ' + row.title + ' (new tab)',
    });
    expect(original.getAttribute('href')).toBe(row.originalUrl);
    expect(original.getAttribute('target')).toBe('_blank');
    expect(original.getAttribute('rel')).toBe('noopener noreferrer');
    expect(
      screen.getByText(
        'Imported source name: Original Odin title. Imported type label: reference. Link origin: source.',
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(row.uses[0]!.assignedText).length,
    ).toBeGreaterThan(0);
    expect(document.querySelector('img[onerror],script')).toBeNull();
  });
  it('debounces queries, requires Enter for one character and preserves selected filters', async () => {
    mount({ type: ['course'], day: ['d113'] });
    await settle();
    fetcher.mockClear();
    fireEvent.change(field(), { target: { value: 'G' } });
    await advance();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Press Enter');
    fireEvent.submit(field().closest('form')!);
    await settle();
    expect(fetcher.mock.calls[0]![0]).toBe(
      '/api/resources?q=G&type=course&day=d113',
    );
    fetcher.mockClear();
    fireEvent.change(field(), { target: { value: 'Git' } });
    await advance(249);
    expect(fetcher).not.toHaveBeenCalled();
    await advance(1);
    expect(fetcher.mock.calls[0]![0]).toBe(
      '/api/resources?q=Git&type=course&day=d113',
    );
  });
  it('updates combined checkbox/list filters, resets pagination and clears filters without discarding the query', async () => {
    mount({ q: 'Git', page: 2 });
    await settle();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Optional supplement' }),
    );
    await settle();
    expect(location.search).toBe('?q=Git&requirement=optional');
    const list = screen.getByRole('listbox', {
      name: 'Days (up to eight)',
    }) as HTMLSelectElement;
    list.options[0]!.selected = true;
    fireEvent.change(list);
    await settle();
    expect(location.search).toBe('?q=Git&day=d113&requirement=optional');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Course' }));
    await settle();
    expect(location.search).toBe(
      '?q=Git&type=course&day=d113&requirement=optional',
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Clear filters' })[0]!,
    );
    await settle();
    expect(location.search).toBe('?q=Git');
    expect(field().value).toBe('Git');
  });
  it('restores actual browser URL after Back and an older server snapshot', async () => {
    window.history.replaceState(
      {},
      '',
      '/resources?day=d113&requirement=optional&page=2',
    );
    render(
      createElement(ResourceLibraryExplorer, {
        studentId: 'owner',
        releaseId: 'se-26w-v1',
        initialInput: {},
        initialData: data(resourceQuerySchema.parse({})),
      }),
    );
    await settle();
    expect(fetcher.mock.calls.at(-1)![0]).toBe(
      '/api/resources?day=d113&requirement=optional&page=2',
    );
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Optional supplement',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    window.history.replaceState({}, '', '/resources?type=documentation');
    fireEvent(window, new PopStateEvent('popstate'));
    await settle();
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Documentation',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Optional supplement',
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });
  it('paginates 25 results and recovers empty and out-of-range pages', async () => {
    fetcher.mockImplementation(async (url: string) =>
      response(url, { total: 26 }),
    );
    mount();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await settle();
    expect(location.search).toBe('?page=2');
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
    fetcher.mockImplementation(async (url: string) =>
      response(url, { total: 26, results: [] }),
    );
    window.history.replaceState({}, '', '/resources?page=99');
    fireEvent(window, new PopStateEvent('popstate'));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'First page' }));
    await settle();
    expect(location.search).toBe('');
    fetcher.mockImplementation(async (url: string) =>
      response(url, { total: 0, results: [] }),
    );
    fireEvent.change(field(), { target: { value: 'noMatch' } });
    await advance();
    expect(
      screen.getByRole('heading', { name: 'No matching resources' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear query' }));
    await settle();
    expect(field().value).toBe('');
  });
  it('retains filters and focuses recoverable errors after manual apply', async () => {
    mount({ day: ['d113'] });
    await settle();
    fetcher.mockResolvedValue(new Response('{}', { status: 503 }));
    fireEvent.change(field(), { target: { value: 'Git' } });
    fireEvent.submit(field().closest('form')!);
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    expect(location.search).toBe('?q=Git&day=d113');
    expect(field().value).toBe('Git');
    expect(
      within(
        screen.getByRole('region', { name: 'Resource results' }),
      ).queryByRole('link'),
    ).toBeNull();
    fetcher.mockImplementation(async (url: string) => response(url));
    fireEvent.click(screen.getByRole('button', { name: 'Retry resources' }));
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it.each([401, 403, 404])(
    'clears results and provides the correct recovery for status %i',
    async (status) => {
      fetcher.mockResolvedValue(new Response('{}', { status }));
      mount({ q: 'Git' });
      await settle();
      expect(screen.queryByRole('heading', { name: row.title })).toBeNull();
      const link = screen.getByRole('link', {
        name:
          status === 401
            ? 'Sign in again'
            : status === 403
              ? 'Reload for the current account'
              : 'Start the course',
      });
      expect(link.getAttribute('href')).toBe(
        status === 401
          ? '/login?returnTo=%2Fresources%3Fq%3DGit'
          : status === 403
            ? '/resources?q=Git'
            : '/course/software-engineer',
      );
    },
  );
  it('rejects malformed responses, foreign release and mismatched queries', async () => {
    for (const extra of [
      { releaseId: 'foreign' },
      { query: resourceQuerySchema.parse({ q: 'wrong' }) },
      { results: [{ ...row, originalUrl: 'javascript:evil()' }] },
    ]) {
      fetcher.mockImplementation(async (url: string) => response(url, extra));
      const view = mount({ q: 'Git' });
      await settle();
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.queryByRole('heading', { name: row.title })).toBeNull();
      view.unmount();
    }
  });
  it('discards stale replies even when the aborted request resolves later', async () => {
    let late: ((value: Response) => void) | undefined;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          late = resolve;
        }),
    );
    mount();
    await settle();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Documentation' }));
    await settle();
    const latest = location.search;
    await act(async () => {
      late!(
        response('/api/resources', {
          results: [{ ...row, title: 'Stale result' }],
        }),
      );
    });
    expect(screen.queryByText('Stale result')).toBeNull();
    expect(location.search).toBe(latest);
  });
  it('shows invalid initial query recovery without bypassing validation or issuing a request', async () => {
    mount({ q: ['a', 'b'] });
    await settle();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset query and filters' }),
    );
    await settle();
    expect(location.search).toBe('');
    expect(fetcher).toHaveBeenCalled();
  });
  it('retains unresolved references and never invents an external link', async () => {
    fetcher.mockImplementation(async (url: string) =>
      response(url, {
        results: [
          {
            ...row,
            originalUrl: null,
            effective: { ...row.effective, provider: null },
            linkOrigin: 'unresolved',
          },
        ],
      }),
    );
    mount();
    await settle();
    expect(
      screen.getByText('No direct link supplied in the manual.'),
    ).toBeTruthy();
    expect(screen.getByText(/Provider not specified in manual/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /\(new tab\)/ })).toBeNull();
    expect(
      resourceLibraryViewSchema.safeParse(
        data(resourceQuerySchema.parse({}), {
          results: [{ ...row, href: 'https://evil.example' }],
        }),
      ).success,
    ).toBe(false);
  });
  it('cancels queued typing requests when the page unmounts', async () => {
    const view = mount();
    await settle();
    fetcher.mockClear();
    fireEvent.change(field(), { target: { value: 'Git' } });
    view.unmount();
    await advance();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
