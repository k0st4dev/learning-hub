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
import { CurriculumSearch } from '../../src/components/curriculum-search';
import { SearchEntry } from '../../src/components/search-entry';
import {
  searchInput,
  searchHref,
  searchQuerySchema,
  type SearchResponse,
  type SearchQuery,
} from '../../src/domain/search';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
let fetcher: ReturnType<typeof vi.fn>;
const options = {
  module: [{ value: 'p01', label: 'Original phase' }],
  week: [{ value: 'w04', label: 'Original week' }],
  day: [{ value: 'd028', label: 'Day 28' }],
};
function payload(query: SearchQuery, extra: Partial<SearchResponse> = {}) {
  return {
    releaseId: 'se-26w-v1',
    query,
    total: 0,
    pageSize: 20 as const,
    results: [],
    ...extra,
  };
}
function response(url: string, extra: Partial<SearchResponse> = {}) {
  return new Response(
    JSON.stringify({
      data: payload(
        searchQuerySchema.parse(
          searchInput(new URL(url, 'http://localhost').searchParams),
        ),
        extra,
      ),
    }),
    { status: 200 },
  );
}
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
function mount(
  input: unknown = {},
  recent = [
    { title: 'Saved reference', href: '/course/software-engineer/days/d028' },
  ],
) {
  const parsed = searchQuerySchema.safeParse(input);
  if (parsed.success)
    window.history.replaceState({}, '', searchHref(parsed.data));
  else window.history.replaceState({}, '', '/search?q=a&q=b');
  return render(
    createElement(CurriculumSearch, {
      studentId: 'owner',
      releaseId: 'se-26w-v1',
      initialInput: input,
      options,
      recent,
    }),
  );
}
const field = () =>
  screen.getByRole('searchbox', {
    name: 'Search original curriculum',
  }) as HTMLInputElement;
beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/search');
  fetcher = vi.fn(async (url: string) => response(url));
  vi.stubGlobal('fetch', fetcher);
  router.push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('course search UI', () => {
  it('restores the actual URL when Back mounts an older server snapshot', async () => {
    window.history.replaceState({}, '', '/search?q=Git&page=2');
    render(
      createElement(CurriculumSearch, {
        studentId: 'owner',
        releaseId: 'se-26w-v1',
        initialInput: {},
        options,
        recent: [],
      }),
    );
    await settle();
    expect(field().value).toBe('Git');
    expect(fetcher.mock.calls.at(-1)![0]).toBe('/api/search?q=Git&page=2');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exercises' }));
    await settle();
    expect(location.search).toBe('?q=Git&kind=exercise');
  });
  it('confirms the account before displaying empty guidance and the actual recent reference', async () => {
    mount();
    expect(screen.queryByText('Recently opened')).toBeNull();
    await settle();
    expect(
      screen.getByRole('heading', { name: 'What would you like to find?' }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Day 28 — Saved reference' })
        .getAttribute('href'),
    ).toBe('/course/software-engineer/days/d028');
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      cache: 'no-store',
      headers: { 'x-expected-student': 'owner' },
    });
  });
  it('debounces 250ms, skips automatic one-character queries and submits them with Enter', async () => {
    mount();
    await settle();
    fetcher.mockClear();
    fireEvent.change(field(), { target: { value: 'G' } });
    await advance();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Press Enter');
    fireEvent.submit(field().closest('form')!);
    await settle();
    expect(fetcher.mock.calls[0]![0]).toBe('/api/search?q=G');
    fetcher.mockClear();
    fireEvent.change(field(), { target: { value: 'Git' } });
    await advance(249);
    expect(fetcher).not.toHaveBeenCalled();
    await advance(1);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/search?q=Git');
    expect(location.search).toBe('?q=Git');
  });
  it('renders original text highlights and grouped safe results without interpreting markup', async () => {
    fetcher.mockImplementation(async (url: string) =>
      response(url, {
        total: 2,
        results: [
          {
            id: 'one',
            kind: 'lesson',
            title: '<script>ČĆ JavaScript</script>',
            href: '/course/software-engineer/days/d001/lessons/d001-learn',
            snippet: 'ČĆ <img onerror=evil> original',
            breadcrumbs: [
              { title: 'Original phase', href: '/course/software-engineer' },
            ],
          },
          {
            id: 'two',
            kind: 'task',
            title: 'Task 1',
            href: '/course/software-engineer/days/d002/exercises/d002-practice#d002-task-01',
            snippet: 'ČĆ source task',
            breadcrumbs: [],
          },
        ],
      }),
    );
    const view = mount({ q: 'cc' });
    await settle();
    expect(screen.getByRole('heading', { name: 'Study lessons' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeTruthy();
    expect(view.container.querySelector('script, img')).toBeNull();
    expect(
      [...view.container.querySelectorAll('mark')].map(
        (node) => node.textContent,
      ),
    ).toEqual(['ČĆ', 'ČĆ', 'ČĆ']);
    expect(
      screen
        .getByRole('link', {
          name: 'Day 1 · Study — <script>ČĆ JavaScript</script>',
        })
        .getAttribute('href'),
    ).toContain('/lessons/');
    expect(
      screen.getByRole('navigation', { name: 'Location for result 1' }),
    ).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('2 results');
  });
  it('combines filters in the URL, resets the page and restores controls on Back/Forward', async () => {
    mount({ q: 'Git', page: 2 });
    await settle();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exercises' }));
    await settle();
    expect(location.search).toBe('?q=Git&kind=exercise');
    expect(fetcher.mock.calls.at(-1)![0]).toBe(
      '/api/search?q=Git&kind=exercise',
    );
    window.history.replaceState(
      {},
      '',
      '/search?q=MDN&kind=resource&week=w04&page=2',
    );
    fireEvent(window, new PopStateEvent('popstate'));
    await settle();
    expect(field().value).toBe('MDN');
    expect(
      (screen.getByRole('checkbox', { name: 'Resources' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('listbox', {
          name: 'Weeks (up to eight)',
        }) as HTMLSelectElement
      ).value,
    ).toBe('w04');
    expect(fetcher.mock.calls.at(-1)![0]).toContain('page=2');
  });
  it('provides real pagination and clear actions when no matches remain', async () => {
    fetcher.mockImplementation(async (url: string) =>
      response(url, { total: 23 }),
    );
    mount({ q: 'Git' });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await settle();
    expect(location.search).toBe('?q=Git&page=2');
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeTruthy();
    fetcher.mockImplementation(async (url: string) => response(url));
    fireEvent.change(field(), { target: { value: 'noMatch' } });
    await advance();
    expect(screen.getByRole('heading', { name: 'No matches' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear query' }));
    await settle();
    expect(field().value).toBe('');
    expect(location.search).toBe('');
  });
  it('retains the query and focuses an error after manual submit, then retries successfully', async () => {
    mount();
    await settle();
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ error: {} }), { status: 503 }),
    );
    fireEvent.change(field(), { target: { value: 'JavaScript' } });
    fireEvent.submit(field().closest('form')!);
    await settle();
    const error = screen.getByRole('alert');
    expect(document.activeElement).toBe(error);
    expect(field().value).toBe('JavaScript');
    expect(location.search).toBe('?q=JavaScript');
    fetcher.mockImplementation(async (url: string) => response(url));
    fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field().value).toBe('JavaScript');
  });
  it.each([401, 403])(
    'clears cached results and recent references after auth/account failure %i',
    async (status) => {
      fetcher.mockResolvedValue(new Response('{}', { status }));
      mount({ q: 'Git' });
      await settle();
      expect(screen.queryByText('Recently opened')).toBeNull();
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(
        screen.getByRole('link', {
          name:
            status === 401 ? 'Sign in again' : 'Reload for the current account',
        }),
      ).toBeTruthy();
    },
  );
  it('rejects foreign-release and unsafe result payloads before rendering links', async () => {
    fetcher.mockImplementation(async (url: string) =>
      response(url, { releaseId: 'foreign' }),
    );
    mount({ q: 'Git' });
    await settle();
    expect(screen.getByRole('alert').textContent).toContain(
      'enrolled course changed',
    );
    expect(
      screen.queryByRole('navigation', { name: 'Search pages' }),
    ).toBeNull();
  });
  it('ignores late replies from an aborted query', async () => {
    let oldReply!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          oldReply = resolve;
        }),
    );
    mount({ q: 'old' });
    await settle();
    fireEvent.change(field(), { target: { value: 'new' } });
    await advance();
    await act(async () => {
      oldReply(response('/api/search?q=old', { total: 99 }));
    });
    expect(screen.getByRole('status').textContent).toContain('0 results');
    expect(field().value).toBe('new');
    expect(location.search).toBe('?q=new');
  });
  it('blocks oversized token queries without fetching and can clear all filters', async () => {
    mount({ q: 'Git', kind: ['task'] });
    await settle();
    fetcher.mockClear();
    fireEvent.change(field(), { target: { value: 'a b c d e f g h i' } });
    fireEvent.submit(field().closest('form')!);
    await settle();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('eight words');
    fireEvent.change(field(), { target: { value: 'Git' } });
    await advance();
    fireEvent.click(
      within(screen.getByRole('search')).getByRole('button', {
        name: 'Clear filters',
      }),
    );
    await settle();
    expect(location.search).toBe('?q=Git');
  });
  it('keeps invalid URL parameters for correction rather than searching another scope', async () => {
    mount({ q: ['a', 'b'] });
    await settle();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('address');
  });
  it('routes the Resources form through the existing shared leave guard', async () => {
    render(createElement(SearchEntry));
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search resources' }),
      { target: { value: 'MDN' } },
    );
    const block = (event: Event) => event.preventDefault();
    document.addEventListener('learning:before-leave', block);
    try {
      fireEvent.submit(screen.getByRole('search'));
      await settle();
      expect(router.push).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('learning:before-leave', block);
    }
    fireEvent.submit(screen.getByRole('search'));
    await settle();
    expect(router.push).toHaveBeenCalledWith('/search?q=MDN&kind=resource');
  });
});
