'use client';
import Link from 'next/link';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  resourceQueryInput,
  resourceQuerySchema,
  resourceLibraryHref,
  resourceTypes,
  resourceRequirements,
  type ResourceQuery,
} from '@/domain/resource-library';
import {
  resourceLibraryViewSchema,
  resourceTypeLabels,
  resourceRequirementLabels,
  type ResourceLibraryView,
} from '@/domain/resource-library-view';
import { ResourceLibraryCard } from './resource-library-card';

type State = {
  query: ResourceQuery;
  draft: string;
  data: ResourceLibraryView | null;
  busy: boolean;
  error: string | null;
  code: number;
  nonce: number;
  automatic: boolean;
  focusError: boolean;
};
export function ResourceLibraryExplorer({
  studentId,
  releaseId,
  initialInput,
  initialData,
  initialError,
}: {
  studentId: string;
  releaseId: string;
  initialInput: unknown;
  initialData: unknown;
  initialError?: { status: number; message: string };
}) {
  const parsed = resourceQuerySchema.safeParse(initialInput);
  const initialQuery = parsed.success
    ? parsed.data
    : resourceQuerySchema.parse({});
  const initial = resourceLibraryViewSchema.safeParse(initialData);
  const [state, update] = useReducer(
    (current: State, change: Partial<State>) => ({ ...current, ...change }),
    {
      query: initialQuery,
      draft: initialQuery.q,
      data: parsed.success && initial.success ? initial.data : null,
      busy: false,
      error: parsed.success
        ? (initialError?.message ?? null)
        : 'Check the query, filters and page in this address.',
      code: parsed.success ? (initialError?.status ?? 0) : 400,
      nonce: 0,
      automatic: parsed.success,
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
    input: ResourceQuery,
    mode: 'push' | 'replace',
    automatic = true,
    focusError = false,
  ) {
    cancel();
    const next = resourceQuerySchema.safeParse(input);
    if (!next.success) {
      update({
        data: null,
        busy: false,
        error:
          'Use up to 100 characters, eight words, 16 providers and eight values per scope.',
        code: 400,
        focusError,
      });
      return;
    }
    const href = resourceLibraryHref(next.data);
    if (location.pathname + location.search !== href)
      window.history[mode === 'push' ? 'pushState' : 'replaceState'](
        window.history.state,
        '',
        href,
      );
    update({
      query: next.data,
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
        const response = await fetch(
          resourceLibraryHref(state.query).replace(
            '/resources',
            '/api/resources',
          ),
          {
            cache: 'no-store',
            signal: controller.signal,
            headers: { 'x-expected-student': studentId },
          },
        );
        if (!response.ok)
          throw {
            status: response.status,
            message:
              response.status === 401
                ? 'Your session ended. Sign in again to browse resources.'
                : response.status === 403
                  ? 'The signed-in account changed. Reload resources for the current account.'
                  : response.status === 404
                    ? 'Start the course before filtering its resources.'
                    : response.status === 400
                      ? 'Check your query and filters, then apply them again.'
                      : 'Resources are unavailable. Your filters are still here. Retry when the application is ready.',
          };
        const data = resourceLibraryViewSchema.parse(
          (await response.json()).data,
        );
        if (
          data.releaseId !== releaseId ||
          resourceLibraryHref(data.query) !== resourceLibraryHref(state.query)
        )
          throw {
            status: 403,
            message:
              'Your enrolled course changed. Reload resources before continuing.',
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
            : 'Resources could not be loaded. Your filters are still here. Retry.',
        });
      }
    })();
    return () => controller.abort();
  }, [state.query, state.nonce, state.automatic, releaseId, studentId]);
  useEffect(() => {
    function restore() {
      if (location.pathname !== '/resources') return;
      cancel();
      const next = resourceQuerySchema.safeParse(
        resourceQueryInput(new URLSearchParams(location.search)),
      );
      if (next.success)
        update({
          query: next.data,
          draft: next.data.q,
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
    if (
      location.pathname + location.search !==
      resourceLibraryHref(current.current.query)
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
  const options =
    state.data?.options ??
    (initial.success
      ? initial.data.options
      : { source: [], module: [], week: [], day: [] });
  const clearFilters = () =>
    transition(
      {
        ...state.query,
        q: state.draft,
        source: [],
        type: [],
        module: [],
        week: [],
        day: [],
        requirement: [],
        page: 1,
      },
      'push',
    );
  return (
    <section
      className="resource-library search-workspace stack"
      aria-labelledby="resource-library-title"
    >
      <h2 id="resource-library-title">Browse resources</h2>
      <p>
        Find original learning references and instructions. Assignment labels
        apply to specific lessons; they add no course credit. Reviewed
        connections preserve the original resource records and assignment
        wording.
      </p>
      {state.data?.inventory && (
        <p>
          {state.data.inventory.originalResources} original resources ·{' '}
          {state.data.inventory.derivedResources} added resource entries ·{' '}
          {state.data.inventory.derivedMentions} named references. Original
          assignments and named references are kept separate.
        </p>
      )}
      <form
        action="/resources"
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
        <label htmlFor="resource-query">Search resources</label>
        <div className="search-query-row">
          <input
            id="resource-query"
            name="q"
            type="search"
            maxLength={100}
            value={state.draft}
            aria-invalid={state.code === 400}
            aria-describedby={
              state.code === 400
                ? 'resource-search-help resource-error'
                : 'resource-search-help'
            }
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
          <button type="submit" className="button primary">
            Apply filters
          </button>
        </div>
        <p id="resource-search-help" className="muted">
          Use up to eight words. Serbian accents are optional. Type two
          characters to search automatically, or press Enter for one character.
        </p>
        <details className="search-filters" open>
          <summary>Resource filters</summary>
          <div className="search-scope-grid section">
            {(['source', 'module', 'week', 'day'] as const).map((key) => (
              <label key={key}>
                {key === 'source'
                  ? 'Providers (up to 16)'
                  : key === 'module'
                    ? 'Phases (up to eight)'
                    : key === 'week'
                      ? 'Weeks (up to eight)'
                      : 'Days (up to eight)'}
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
                      {key === 'module' && /^f\d+$/.test(option.value)
                        ? 'Phase ' + Number(option.value.slice(1)) + ' — '
                        : key === 'week' && /^w\d+$/.test(option.value)
                          ? 'Week ' + Number(option.value.slice(1)) + ' — '
                          : ''}
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <fieldset className="section">
            <legend>Resource types</legend>
            <div className="search-kind-grid">
              {resourceTypes.map((type) => (
                <label key={type}>
                  <input
                    type="checkbox"
                    name="type"
                    value={type}
                    checked={state.query.type.includes(type)}
                    onChange={(event) =>
                      transition(
                        {
                          ...state.query,
                          q: state.draft,
                          type: event.target.checked
                            ? [...state.query.type, type]
                            : state.query.type.filter(
                                (value) => value !== type,
                              ),
                          page: 1,
                        },
                        'push',
                      )
                    }
                  />
                  {resourceTypeLabels[type]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="section">
            <legend>Assignment labels</legend>
            <div className="search-kind-grid">
              {resourceRequirements.map((requirement) => (
                <label key={requirement}>
                  <input
                    type="checkbox"
                    name="requirement"
                    value={requirement}
                    checked={state.query.requirement.includes(requirement)}
                    onChange={(event) =>
                      transition(
                        {
                          ...state.query,
                          q: state.draft,
                          requirement: event.target.checked
                            ? [...state.query.requirement, requirement]
                            : state.query.requirement.filter(
                                (value) => value !== requirement,
                              ),
                          page: 1,
                        },
                        'push',
                      )
                    }
                  />
                  {resourceRequirementLabels[requirement]}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="muted">
            Filters combine; several values within a filter are alternatives.
            The lesson and assignment label must match the same assignment. Hold
            Ctrl or Command to select several list values.
          </p>
          <button type="button" className="button" onClick={clearFilters}>
            Clear filters
          </button>
        </details>
      </form>
      <p role="status" aria-live="polite">
        {state.busy
          ? 'Loading resources…'
          : state.data
            ? `${state.data.total} ${state.data.total === 1 ? 'resource' : 'resources'}. Page ${state.query.page} of ${Math.max(1, Math.ceil(state.data.total / 25))}.`
            : state.draft.trim().length === 1 && !state.error
              ? 'Press Enter to search this one-character term.'
              : ''}
      </p>
      {state.error && (
        <div
          ref={alert}
          id="resource-error"
          tabIndex={-1}
          role="alert"
          className="card error-summary stack"
        >
          <p>{state.error}</p>
          {state.code === 401 ? (
            <Link
              href={
                '/login?returnTo=' +
                encodeURIComponent(resourceLibraryHref(state.query))
              }
            >
              Sign in again
            </Link>
          ) : state.code === 403 ? (
            <a href={resourceLibraryHref(state.query)}>
              Reload for the current account
            </a>
          ) : state.code === 404 ? (
            <Link href="/course/software-engineer">Start the course</Link>
          ) : state.code !== 400 ? (
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
              Retry resources
            </button>
          ) : (
            <button
              className="button"
              onClick={() =>
                transition(resourceQuerySchema.parse({}), 'replace')
              }
            >
              Reset query and filters
            </button>
          )}
        </div>
      )}
      <section aria-label="Resource results" aria-busy={state.busy}>
        {state.busy && (
          <div className="card">
            <p>Loading matching resources and their lesson contexts…</p>
          </div>
        )}
        {state.data && state.data.total === 0 && (
          <div className="card stack">
            <h3>No matching resources</h3>
            <p>
              Try fewer words or remove filters. The original manual remains
              available below.
            </p>
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
              Sorted by title. Added entries and labels are explained under each
              resource; exact original assignments remain accessible.
            </p>
            <ol className="search-result-list">
              {state.data.results.map((resource, index) => (
                <ResourceLibraryCard
                  key={resource.id}
                  resource={resource}
                  rank={(state.query.page - 1) * 25 + index + 1}
                />
              ))}
            </ol>
            <nav className="actions section" aria-label="Resource pages">
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
              {state.query.page * 25 < state.data.total && (
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
      <a href="#original-resource-manual">Read the original resource manual</a>
    </section>
  );
}
