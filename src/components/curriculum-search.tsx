'use client';
import Link from 'next/link';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  searchQuerySchema,
  searchResponseSchema,
  searchInput,
  searchHref,
  searchKinds,
  searchKindLabels,
  searchTokens,
  searchHighlights,
  type SearchQuery,
  type SearchResponse,
  type SearchOptions,
  type SearchBreadcrumb,
} from '@/domain/search';

function Highlight({ text, q }: { text: string; q: string }) {
  return searchHighlights(text, searchTokens(q)).map((part, index) =>
    part.match ? <mark key={index}>{part.text}</mark> : part.text,
  );
}
function resultTitle(title: string, href: string, kind?: string) {
  const day = /\/days\/d(\d+)/.exec(href);
  return day
    ? 'Day ' +
        Number(day[1]) +
        (kind === 'lesson'
          ? ' · Study'
          : kind === 'exercise' || kind === 'task'
            ? ' · Exercise'
            : '') +
        ' — ' +
        title
    : title;
}
type State = {
  query: SearchQuery;
  draft: string;
  data: SearchResponse | null;
  busy: boolean;
  error: string | null;
  code: number;
  nonce: number;
  automatic: boolean;
  focusError: boolean;
};
export function CurriculumSearch({
  studentId,
  releaseId,
  initialInput,
  options,
  recent,
}: {
  studentId: string;
  releaseId?: string;
  initialInput: unknown;
  options: SearchOptions;
  recent: SearchBreadcrumb[];
}) {
  const initial = searchQuerySchema.safeParse(initialInput);
  const initialQuery = initial.success
    ? initial.data
    : searchQuerySchema.parse({});
  const [state, update] = useReducer(
    (current: State, change: Partial<State>) => ({ ...current, ...change }),
    {
      query: initialQuery,
      draft: initialQuery.q,
      data: null,
      busy: initial.success,
      error: initial.success
        ? null
        : 'Check the query, filters and page in this address. Use at most eight words.',
      code: initial.success ? 0 : 400,
      nonce: 0,
      automatic: initial.success,
      focusError: false,
    },
  );
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  }, [state]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const alert = useRef<HTMLDivElement>(null);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    sequence.current++;
  }, []);
  function transition(
    input: SearchQuery,
    mode: 'push' | 'replace',
    automatic = true,
    focusError = false,
  ) {
    cancel();
    const parsed = searchQuerySchema.safeParse(input);
    if (!parsed.success) {
      update({
        data: null,
        busy: false,
        error:
          'Use at most 100 characters, eight words and eight values per scope filter.',
        code: 400,
        focusError,
      });
      return;
    }
    const href = searchHref(parsed.data);
    if (location.pathname + location.search !== href)
      window.history[mode === 'push' ? 'pushState' : 'replaceState'](
        window.history.state,
        '',
        href,
      );
    update({
      query: parsed.data,
      draft: input.q,
      data: null,
      busy: automatic,
      error: null,
      code: 0,
      automatic,
      focusError,
      nonce: current.current.nonce + 1,
    });
  }
  useEffect(() => {
    if (!state.automatic) return;
    const controller = new AbortController();
    request.current = controller;
    const ticket = ++sequence.current;
    update({ busy: true, data: null, error: null, code: 0 });
    void (async () => {
      try {
        const href = searchHref(state.query).replace('/search', '/api/search');
        const response = await fetch(href, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'x-expected-student': studentId },
        });
        const payload = await response.json();
        if (!response.ok)
          throw {
            status: response.status,
            message:
              response.status === 401
                ? 'Your session ended. Sign in again to search.'
                : response.status === 403
                  ? 'The signed-in account changed. Reload search for the current account.'
                  : response.status === 400
                    ? 'Check your query and filters, then search again.'
                    : 'Search is unavailable. Your query is still here. Retry when the application is ready.',
          };
        const data = searchResponseSchema.parse(payload.data);
        if (
          (releaseId && data.releaseId !== releaseId) ||
          searchHref(data.query) !== searchHref(state.query)
        )
          throw {
            status: 403,
            message:
              'Your enrolled course changed. Reload search before continuing.',
          };
        if (sequence.current === ticket && !controller.signal.aborted)
          update({ data, busy: false });
      } catch (cause) {
        if (sequence.current !== ticket || controller.signal.aborted) return;
        const error = cause as { status?: number; message?: string };
        update({
          data: null,
          busy: false,
          code: error.status ?? 503,
          error: error.status
            ? error.message
            : 'Search could not be loaded. Your query is still here. Retry.',
        });
      }
    })();
    return () => controller.abort();
  }, [state.query, state.nonce, state.automatic, releaseId, studentId]);
  useEffect(() => {
    function restore() {
      if (location.pathname !== '/search') return;
      cancel();
      const parsed = searchQuerySchema.safeParse(
        searchInput(new URLSearchParams(location.search)),
      );
      if (parsed.success)
        update({
          query: parsed.data,
          draft: parsed.data.q,
          data: null,
          busy: true,
          error: null,
          code: 0,
          automatic: true,
          focusError: false,
          nonce: current.current.nonce + 1,
        });
      else
        update({
          data: null,
          busy: false,
          automatic: false,
          error: 'Check the query, filters and page in this address.',
          code: 400,
        });
    }
    const visible = () => {
      if (
        document.visibilityState === 'visible' &&
        current.current.draft === current.current.query.q
      )
        restore();
    };
    window.addEventListener('popstate', restore);
    window.addEventListener('pageshow', restore);
    document.addEventListener('visibilitychange', visible);
    // Back can restore an older server snapshot after native query changes.
    if (
      location.pathname + location.search !==
      searchHref(current.current.query)
    )
      restore();
    return () => {
      cancel();
      window.removeEventListener('popstate', restore);
      window.removeEventListener('pageshow', restore);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [cancel]);
  useEffect(() => {
    if (state.error && state.focusError) alert.current?.focus();
  }, [state.error, state.focusError]);
  const clearFilters = () =>
    transition(
      {
        ...state.query,
        q: state.draft,
        kind: [],
        module: [],
        week: [],
        day: [],
        page: 1,
      },
      'push',
    );
  const groups = new Map<
    string,
    { row: SearchResponse['results'][number]; rank: number }[]
  >();
  state.data?.results.forEach((row, index) => {
    const group = groups.get(row.kind) ?? [];
    group.push({ row, rank: (state.query.page - 1) * 20 + index + 1 });
    groups.set(row.kind, group);
  });
  return (
    <div className="search-workspace stack">
      <form
        action="/search"
        method="get"
        role="search"
        className="card stack"
        onSubmit={(event) => {
          event.preventDefault();
          transition(
            { ...state.query, q: state.draft, page: 1 },
            'push',
            true,
            true,
          );
        }}
      >
        <label htmlFor="course-query">Search original curriculum</label>
        <div className="search-query-row">
          <input
            id="course-query"
            name="q"
            type="search"
            maxLength={100}
            value={state.draft}
            aria-describedby={
              state.code === 400 ? 'search-help search-error' : 'search-help'
            }
            aria-invalid={state.code === 400}
            onChange={(event) => {
              const q = event.target.value;
              cancel();
              update({
                draft: q,
                data: null,
                busy: false,
                error: null,
                focusError: false,
              });
              timer.current = setTimeout(
                () =>
                  transition(
                    { ...current.current.query, q, page: 1 },
                    'replace',
                    q.trim().length !== 1,
                  ),
                250,
              );
            }}
          />
          <button className="button primary" type="submit">
            Search
          </button>
        </div>
        <p id="search-help" className="muted">
          Use up to eight words. Every word must match. Serbian accents are
          optional. Type two characters to search automatically, or press Enter
          for a one-character term.
        </p>
        <details className="search-filters">
          <summary>Filter results</summary>
          <fieldset className="section">
            <legend>Content types</legend>
            <div className="search-kind-grid">
              {searchKinds.map((kind) => (
                <label key={kind}>
                  <input
                    type="checkbox"
                    name="kind"
                    value={kind}
                    checked={state.query.kind.includes(kind)}
                    onChange={(event) =>
                      transition(
                        {
                          ...state.query,
                          q: state.draft,
                          kind: event.target.checked
                            ? [...state.query.kind, kind]
                            : state.query.kind.filter(
                                (value) => value !== kind,
                              ),
                          page: 1,
                        },
                        'push',
                      )
                    }
                  />
                  {searchKindLabels[kind]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="search-scope-grid">
            {(['module', 'week', 'day'] as const).map((key) => (
              <label key={key}>
                {key === 'module'
                  ? 'Phases'
                  : key === 'week'
                    ? 'Weeks'
                    : 'Days'}{' '}
                (up to eight)
                <select
                  multiple
                  size={3}
                  name={key}
                  value={state.query[key]}
                  onChange={(event) =>
                    transition(
                      {
                        ...state.query,
                        q: state.draft,
                        [key]: Array.from(
                          event.target.selectedOptions,
                          (option) => option.value,
                        ),
                        page: 1,
                      },
                      'push',
                    )
                  }
                >
                  {options[key].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="muted">
            Filters combine. Hold Ctrl or Command to select several values in a
            list.
          </p>
          <button type="button" className="button" onClick={clearFilters}>
            Clear filters
          </button>
        </details>
      </form>
      <p role="status" aria-live="polite">
        {state.busy
          ? 'Searching…'
          : state.data?.query.q
            ? state.data.total +
              ' results. Page ' +
              state.query.page +
              ' of ' +
              Math.max(1, Math.ceil(state.data.total / 20)) +
              '.'
            : state.draft.trim().length === 1 && !state.data
              ? 'Press Enter to search this one-character term.'
              : ''}
      </p>
      {state.error && (
        <div
          ref={alert}
          id="search-error"
          tabIndex={-1}
          role="alert"
          className="card error-summary stack"
        >
          <p>{state.error}</p>
          {state.code === 401 ? (
            <Link
              href={
                '/login?returnTo=' + encodeURIComponent(searchHref(state.query))
              }
            >
              Sign in again
            </Link>
          ) : state.code === 403 ? (
            <a href={searchHref(state.query)}>Reload for the current account</a>
          ) : (
            state.code !== 400 && (
              <button
                className="button"
                onClick={() =>
                  transition(
                    { ...state.query, q: state.draft },
                    'replace',
                    true,
                    true,
                  )
                }
              >
                Retry search
              </button>
            )
          )}
        </div>
      )}
      <section aria-label="Search results" aria-busy={state.busy}>
        {state.data && !state.data.query.q && (
          <div className="card stack">
            <h2>What would you like to find?</h2>
            <p>
              Try a topic such as Git, a task instruction or a handbook term.
              Your private notes are not searched.
            </p>
            <h3>Recently opened</h3>
            {recent.length ? (
              <ul>
                {recent.map((item) => (
                  <li key={item.href}>
                    <Link prefetch={false} href={item.href} lang="sr-Latn">
                      {resultTitle(item.title, item.href)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent course reference yet.</p>
            )}
            <Link prefetch={false} href="/course/software-engineer">
              Browse the course
            </Link>
          </div>
        )}
        {state.data?.query.q && state.data.total === 0 && (
          <div className="card stack">
            <h2>No matches</h2>
            <p>Try fewer words or remove filters.</p>
            <div className="actions">
              <button
                className="button"
                onClick={() =>
                  transition({ ...state.query, q: '', page: 1 }, 'push')
                }
              >
                Clear query
              </button>
              <button className="button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          </div>
        )}
        {state.data && state.data.total > 0 && (
          <>
            <p className="muted">
              Grouped by content type, ranked within each group.
            </p>
            {[...groups].map(([kind, rows]) => (
              <section className="section" key={kind}>
                <h2>
                  {searchKindLabels[kind as keyof typeof searchKindLabels]}
                </h2>
                <ol className="search-result-list">
                  {rows.map(({ row, rank }) => (
                    <li className="card" key={row.id} value={rank}>
                      <h3>
                        <Link prefetch={false} href={row.href} lang="sr-Latn">
                          <Highlight
                            text={resultTitle(row.title, row.href, row.kind)}
                            q={state.query.q}
                          />
                        </Link>
                      </h3>
                      <nav
                        aria-label={'Location for result ' + rank}
                        className="search-breadcrumbs"
                        lang="sr-Latn"
                      >
                        {row.breadcrumbs.map((crumb, index) => (
                          <span key={index}>
                            {index > 0 && ' → '}
                            <Link prefetch={false} href={crumb.href}>
                              {crumb.title}
                            </Link>
                          </span>
                        ))}
                      </nav>
                      <p lang="sr-Latn">
                        <Highlight text={row.snippet} q={state.query.q} />
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            <nav className="actions section" aria-label="Search pages">
              {state.query.page > 1 && (
                <button
                  className="button"
                  onClick={() =>
                    transition(
                      { ...state.query, page: state.query.page - 1 },
                      'push',
                    )
                  }
                >
                  Previous page
                </button>
              )}
              <span>Page {state.query.page}</span>
              {state.query.page * 20 < state.data.total && (
                <button
                  className="button"
                  onClick={() =>
                    transition(
                      { ...state.query, page: state.query.page + 1 },
                      'push',
                    )
                  }
                >
                  Next page
                </button>
              )}
              {!state.data.results.length && (
                <button
                  className="button"
                  onClick={() =>
                    transition({ ...state.query, page: 1 }, 'push')
                  }
                >
                  First page
                </button>
              )}
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
