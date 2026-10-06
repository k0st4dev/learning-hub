// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ActivityHistory } from '../../src/components/activity-history';
import { ProgressOverview } from '../../src/components/progress-overview';
import { activityLocation, activityTypes } from '../../src/domain/activity';
import { activityText } from '../../src/i18n/activity';
import type { ProgressViewState } from '../../src/domain/progress-presentation';
import type { ActivityPage } from '../../src/server/learning/activity';
const time = Date.UTC(2026, 9, 6, 8);
function fixture(): ProgressViewState {
  return {
    timezone: 'Europe/Ljubljana',
    enrollment: {
      releaseId: 'pinned-v1',
      preparationAcknowledgedAt: 1,
      resumeItemId: 'lesson',
      resumeAnchor: 'study',
      resumeUpdatedAt: time,
      lastOpenedItemId: null,
      lastOpenedAt: null,
    },
    units: [
      {
        id: 'lesson',
        key: 'd001-learn',
        kind: 'lesson',
        anchors: ['study'],
        dayId: 'day',
        dayKey: 'd001',
        dayNumber: 1,
        complete: false,
        started: true,
        completedAt: null,
        updatedAt: time,
        needsReview: false,
        order: 0,
      },
    ],
    items: [
      {
        id: 'overview',
        stableKey: 'overview',
        kind: 'overview',
        title: 'Izvorni kurs',
        parentId: null,
        orderIndex: 0,
      },
      {
        id: 'day',
        stableKey: 'd001',
        kind: 'day',
        title: 'Izvorni dan',
        parentId: null,
        orderIndex: 1,
      },
      {
        id: 'lesson',
        stableKey: 'd001-learn',
        kind: 'lesson',
        title: 'Izvorna lekcija',
        parentId: 'day',
        orderIndex: 0,
      },
    ],
    days: [
      {
        itemId: 'day',
        dayNumber: 1,
        assessmentKind: 'practice',
        completionCriterionMarkdown: 'Kriterijum',
      },
    ],
    weeks: [],
    preparation: [],
  };
}
function page(): ActivityPage {
  return {
    next: null,
    events: activityTypes.map((type, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      type,
      occurredAt: time,
      itemStableKey:
        type.startsWith('course_') || type === 'release_migrated'
          ? null
          : type.startsWith('day_')
            ? 'd001'
            : 'd001-learn',
    })),
  };
}
afterEach(cleanup);
describe('owned activity presentation', () => {
  it('renders every transition label with pinned titles, links and the profile timezone without changing credit', () => {
    const state = fixture();
    const before = structuredClone(state);
    const result = render(
      createElement(ActivityHistory, { state, page: page() }),
    );
    const region = screen.getByRole('region', { name: 'Activity history' });
    for (const type of activityTypes)
      expect(within(region).getByText(activityText.events[type])).toBeTruthy();
    expect(
      within(region)
        .getAllByRole('link', { name: 'Day 1 — Izvorna lekcija' })[0]!
        .getAttribute('href'),
    ).toBe('/course/software-engineer/days/d001/lessons/d001-learn');
    expect(result.container.querySelector('time')!.dateTime).toBe(
      new Date(time).toISOString(),
    );
    expect(result.container.querySelector('time')!.textContent).toContain(
      '10:00',
    );
    expect(
      result.container.querySelector('time')!.parentElement!.textContent,
    ).toContain('Europe/Ljubljana');
    expect(result.container.querySelector('[lang="sr-Latn"]')).toBeTruthy();
    expect(state).toEqual(before);
  });
  it('uses only the supplied release and gives unavailable archived keys no invented link', () => {
    const state = fixture();
    expect(activityLocation(state, 'd001-learn').title).toBe('Izvorna lekcija');
    state.items.find((item) => item.id === 'lesson')!.title = 'Druga verzija';
    expect(activityLocation(state, 'd001-learn').title).toBe('Druga verzija');
    const history = page();
    history.events = [
      { ...history.events[0]!, itemStableKey: 'unavailable-old-item' },
    ];
    render(createElement(ActivityHistory, { state, page: history }));
    expect(screen.getByText('Archived curriculum item')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('offers full history and bounded older/newest navigation without an empty navigation landmark', () => {
    const state = fixture();
    const history = page();
    const view = render(
      createElement(ActivityHistory, { state, page: history, recent: true }),
    );
    expect(
      screen
        .getByRole('link', { name: 'View full Progress history' })
        .getAttribute('href'),
    ).toBe('/course/software-engineer/progress#activity-history');
    history.next = history.events[0]!.id;
    view.rerender(
      createElement(ActivityHistory, { state, page: history, olderPage: true }),
    );
    expect(
      screen.getByRole('link', { name: 'Older activity' }).getAttribute('href'),
    ).toContain('?activity=' + history.next + '#activity-history');
    expect(
      screen.getByRole('link', { name: 'View newest activity' }),
    ).toBeTruthy();
    view.rerender(
      createElement(ActivityHistory, {
        state,
        page: { events: [], next: null },
      }),
    );
    expect(screen.getByText(activityText.empty)).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    view.rerender(
      createElement(ActivityHistory, {
        state,
        page: { events: [], next: null },
        olderPage: true,
      }),
    );
    expect(screen.getByText(activityText.emptyPage)).toBeTruthy();
    view.rerender(createElement(ActivityHistory, { state, page: null }));
    expect(screen.getByRole('alert').textContent).toBe(
      activityText.unavailable,
    );
    expect(
      screen.getByRole('link', { name: 'View newest activity' }),
    ).toBeTruthy();
  });
  it('keeps Dashboard activity after the current scope and before reminders/reference', () => {
    const state = fixture();
    render(
      createElement(ProgressOverview, {
        state,
        view: 'dashboard',
        activity: createElement(ActivityHistory, {
          state,
          page: page(),
          recent: true,
        }),
      }),
    );
    const current = screen.getByRole('region', {
      name: 'Current module, week and day',
    });
    const activity = screen.getByRole('region', { name: 'Recent activity' });
    const reference = screen.getByRole('region', {
      name: 'Study and reference locations',
    });
    expect(
      current.compareDocumentPosition(activity) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      activity.compareDocumentPosition(reference) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
