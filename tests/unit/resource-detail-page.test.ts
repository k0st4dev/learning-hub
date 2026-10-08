// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AppError } from '../../src/server/errors';
import type { ResourceLibraryView } from '../../src/domain/resource-library-view';
import Resources from '../../src/app/resources/[[...segments]]/page';

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  detail: vi.fn(),
  library: vi.fn(),
  store: {},
  missing: vi.fn(() => {
    throw new Error('missing page');
  }),
  redirect: vi.fn((url: string) => {
    throw new Error('redirect ' + url);
  }),
}));
vi.mock('../../src/server/content/page', () => ({ publishedPage: mocks.page }));
vi.mock('../../src/server/content/resource-library', () => ({
  readResourceDetail: mocks.detail,
  readResourceLibrary: mocks.library,
}));
vi.mock('../../src/server/db/current', () => ({ getStore: () => mocks.store }));
vi.mock('next/navigation', () => ({
  notFound: mocks.missing,
  redirect: mocks.redirect,
}));
vi.mock('../../src/components/student-shell', () => ({
  StudentShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../src/components/full-curriculum-page', () => ({
  FullCurriculumPage: ({
    learnerTool,
    route,
  }: {
    learnerTool: React.ReactNode;
    route: string;
  }) =>
    createElement(
      'main',
      { 'data-route': route },
      learnerTool,
      createElement('p', {}, 'Original detail retained'),
    ),
}));
vi.mock('../../src/components/search-entry', () => ({
  SearchEntry: () => null,
}));
vi.mock('../../src/components/resource-library-explorer', () => ({
  ResourceLibraryExplorer: () => createElement('div', {}, 'Library controls'),
}));
const resource: ResourceLibraryView['results'][number] = {
  id: 'r1',
  title: 'Original title',
  href: '/resources/res-02',
  descriptionMarkdown: 'Original text',
  originalUrl: null,
  resolvedUrl: null,
  sourceName: 'Original imported name',
  type: 'reference',
  linkOrigin: 'unresolved',
  linkStatus: 'unchecked',
  checkedAt: null,
  effective: {
    type: 'course',
    provider: null,
    sourceFilterKey: 'provider-unspecified',
  },
  interpretation: {
    origin: 'added-product-interpretation',
    version: 'v1',
    ambiguity: true,
    evidence: [
      {
        sourceId: 'p0085',
        exactText: '<script>unsafe</script>',
        sha256: 'hash',
        table: null,
        row: null,
        cell: null,
      },
    ],
    confidence: 'high',
    rationale: 'Added explanation',
    category: 'named-resource',
  },
  uses: [],
  matchingUseIds: [],
  relatedDays: [],
};
function page(segments = ['res-02']) {
  return Resources({
    params: Promise.resolve({ segments }),
    searchParams: Promise.resolve({}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.page.mockResolvedValue({
    student: {
      id: 'owner',
      displayName: 'Student',
      email: 'student@example.test',
    },
    token: 'owned-token',
    catalog: {
      release: { id: 'se-26w-v1' },
      resources: [{ stableKey: 'res-02' }],
    },
  });
  mocks.detail.mockReturnValue({ releaseId: 'se-26w-v1', resource });
});
describe('resource detail page wiring and recovery', () => {
  it('uses a single owned detail read and renders semantic labels, unknown links and escaped source evidence', async () => {
    const document = new DOMParser().parseFromString(
      renderToStaticMarkup(await page()),
      'text/html',
    );
    expect(mocks.page).toHaveBeenCalledWith('/resources/res-02');
    expect(mocks.detail).toHaveBeenCalledExactlyOnceWith(
      mocks.store,
      'owned-token',
      'res-02',
      'owner',
    );
    expect(mocks.library).not.toHaveBeenCalled();
    expect(document.querySelectorAll('article')).toHaveLength(1);
    expect(document.querySelectorAll('li')).toHaveLength(0);
    expect(document.body.textContent).toContain(
      'Course · Provider not specified in manual',
    );
    expect(document.body.textContent).toContain(
      'No direct link supplied in the manual.',
    );
    expect(document.body.textContent).toContain(
      'Imported type label: reference',
    );
    expect(document.body.textContent).toContain('<script>unsafe</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(document.body.textContent).not.toContain('Matches current filters');
  });
  it('keeps the original detail available for unenrolled students and offers Start course', async () => {
    mocks.detail.mockImplementation(() => {
      throw new AppError(404, 'ENROLLMENT_REQUIRED', 'Start');
    });
    const document = new DOMParser().parseFromString(
      renderToStaticMarkup(await page()),
      'text/html',
    );
    expect(document.body.textContent).toContain('Original detail retained');
    expect(document.querySelector('a')!.getAttribute('href')).toBe(
      '/course/software-engineer',
    );
    expect(document.querySelector('article')).toBeNull();
  });
  it('shows an explicit retry without partial labels when the frozen binding is unavailable', async () => {
    mocks.detail.mockImplementation(() => {
      throw new AppError(
        503,
        'RESOURCE_LABELS_UNAVAILABLE',
        'Internal diagnostic',
      );
    });
    const document = new DOMParser().parseFromString(
      renderToStaticMarkup(await page()),
      'text/html',
    );
    expect(document.querySelector('[role=alert]')!.textContent).toContain(
      'added labels are not shown',
    );
    expect(document.querySelector('a')!.getAttribute('href')).toBe(
      '/resources/res-02',
    );
    expect(document.querySelector('article')).toBeNull();
    expect(document.body.textContent).toContain('Original detail retained');
    expect(document.body.textContent).not.toContain('Internal diagnostic');
  });
  it('returns an expired session to login with the exact resource destination', async () => {
    mocks.detail.mockImplementation(() => {
      throw new AppError(401, 'SESSION_REQUIRED', 'Expired');
    });
    await expect(page()).rejects.toThrow('redirect');
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/login?returnTo=%2Fresources%2Fres-02',
    );
  });
  it('does not show labels on account changes or unexpected failures', async () => {
    const error = new AppError(403, 'ACCOUNT_CHANGED', 'Changed');
    mocks.detail.mockImplementation(() => {
      throw error;
    });
    await expect(page()).rejects.toBe(error);
    const unexpected = new Error('database closed');
    mocks.detail.mockImplementation(() => {
      throw unexpected;
    });
    await expect(page()).rejects.toBe(unexpected);
  });
  it('uses missing-page recovery for unknown, nested and missing pinned keys rather than another resource', async () => {
    for (const segments of [['missing'], ['res-02', 'extra']])
      await expect(page(segments)).rejects.toThrow('missing page');
    expect(mocks.detail).not.toHaveBeenCalled();
    mocks.detail.mockImplementation(() => {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Missing');
    });
    await expect(page()).rejects.toThrow('missing page');
  });
  it('rejects unsafe link schemes and a resource projection from another release before rendering labels', async () => {
    mocks.detail.mockReturnValue({ releaseId: 'foreign', resource });
    const foreign = await page();
    expect(() => renderToStaticMarkup(foreign)).toThrow(
      'another course version',
    );
    mocks.detail.mockReturnValue({
      releaseId: 'se-26w-v1',
      resource: { ...resource, originalUrl: 'javascript:alert(1)' },
    });
    const unsafe = await page();
    expect(() => renderToStaticMarkup(unsafe)).toThrow();
  });
});
