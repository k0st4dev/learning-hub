// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { ProgressOverview } from '../../src/components/progress-overview';
import type { ProgressViewState } from '../../src/domain/progress-presentation';
function fixture(): ProgressViewState {
  const days = [1, 2, 7];
  const units = days.flatMap((day) =>
    ['lesson', 'exercise'].map((kind, index) => ({
      id: `d${day}-${kind}`,
      key: `d${String(day).padStart(3, '0')}-${kind === 'lesson' ? 'learn' : 'practice'}`,
      kind,
      dayId: 'day' + day,
      dayKey: 'd' + String(day).padStart(3, '0'),
      dayNumber: day,
      complete: day === 1,
      started: day !== 2,
      completedAt: day === 1 ? Date.UTC(2026, 9, 5, 10, index) : null,
      updatedAt: day !== 2 ? Date.UTC(2026, 9, 5, 11, index) : null,
      needsReview: day === 7 && kind === 'exercise',
      order: index,
    })),
  );
  return {
    timezone: 'Europe/Ljubljana',
    units,
    enrollment: {
      releaseId: 'se-26w-v1',
      preparationAcknowledgedAt: 1,
      resumeItemId: 'd7-lesson',
      resumeAnchor: 'study',
      resumeUpdatedAt: Date.UTC(2026, 9, 5, 11),
      lastOpenedItemId: 'd1-exercise',
      lastOpenedAt: Date.UTC(2026, 9, 5, 11, 30),
    },
    items: [
      {
        id: 'phase',
        stableKey: 'f1',
        kind: 'module',
        title: 'Prva faza',
        parentId: null,
        orderIndex: 0,
      },
      {
        id: 'week',
        stableKey: 'w01',
        kind: 'week',
        title: 'Prva nedelja',
        parentId: 'phase',
        orderIndex: 0,
      },
      ...days.map((day) => ({
        id: 'day' + day,
        stableKey: 'd' + String(day).padStart(3, '0'),
        kind: 'day',
        title: 'Izvorni dan ' + day,
        parentId: 'week',
        orderIndex: day,
      })),
      ...units.map((unit) => ({
        id: unit.id,
        stableKey: unit.key,
        kind: unit.kind,
        title: 'Original assignment',
        parentId: unit.dayId,
        orderIndex: unit.order,
      })),
      {
        id: 'prep',
        stableKey: 'prep-01',
        kind: 'preparation',
        title: 'Priprema',
        parentId: null,
        orderIndex: 0,
      },
    ],
    days: days.map((day) => ({
      itemId: 'day' + day,
      dayNumber: day,
      assessmentKind: day === 7 ? 'weekly_checkpoint' : 'practice',
      completionCriterionMarkdown: 'Original criterion ' + day,
    })),
    weeks: [{ itemId: 'week', weekNumber: 1 }],
    preparation: [],
  };
}
afterEach(cleanup);
describe('student progress presentation', () => {
  it('distinguishes active later work, recommended earlier work and completed reference visits', () => {
    render(
      createElement(ProgressOverview, { state: fixture(), view: 'dashboard' }),
    );
    const card = screen.getByRole('region', { name: 'Continue learning' });
    expect(within(card).getByText(/Week 1 · Day 7 · Study/)).toBeTruthy();
    expect(within(card).getByText(/Out of sequence/)).toBeTruthy();
    expect(
      within(card)
        .getByRole('link', { name: /Recommended earliest/ })
        .getAttribute('href'),
    ).toContain('/d002/lessons/');
    expect(
      within(
        screen.getByRole('region', { name: 'Study and reference locations' }),
      ).getByRole('link', { name: /Day 1 · Exercise/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole('region', { name: 'Unfinished checkpoint reminder' })
        .textContent,
    ).toContain('Original criterion 7');
    expect(screen.getByRole('link', { name: 'Day 3' })).toBeTruthy();
    expect(screen.getAllByText(/Europe\/Ljubljana/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('region', { name: 'Preparation reminder' }),
    ).toBeTruthy();
  });
  it('filters complete, incomplete and needs-review days without changing records or credit', () => {
    const state = fixture();
    const before = structuredClone(state);
    render(createElement(ProgressOverview, { state, view: 'progress' }));
    const list = screen.getByRole('region', { name: 'Days and required work' });
    expect(within(list).getByText('2 days shown')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Show days'), {
      target: { value: 'completed' },
    });
    expect(within(list).getByText('1 day shown')).toBeTruthy();
    expect(within(list).getByRole('link', { name: /Day 1 —/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Show days'), {
      target: { value: 'needs_review' },
    });
    expect(within(list).getByRole('link', { name: /Day 7 —/ })).toBeTruthy();
    expect(list.textContent).toContain('Needs review');
    fireEvent.change(screen.getByLabelText('Show days'), {
      target: { value: 'all' },
    });
    expect(within(list).getByText('3 days shown')).toBeTruthy();
    expect(state).toEqual(before);
  });
  it('shows preparation priority and zero confirmed work for a new student', () => {
    const state = fixture();
    state.enrollment.preparationAcknowledgedAt = null;
    state.units = state.units.map((unit) => ({
      ...unit,
      complete: false,
      started: false,
      needsReview: false,
      completedAt: null,
      updatedAt: null,
    }));
    render(createElement(ProgressOverview, { state, view: 'dashboard' }));
    expect(
      screen.getByText('Review or explicitly defer preparation before Day 1.'),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Course progress' })).getByText(
        '0/6 required units · 0%',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole('region', { name: 'Unfinished checkpoint reminder' }),
    ).toBeNull();
  });
  it('shows review and Appendix G only after all required units complete; reopening removes that state', () => {
    const state = fixture();
    state.units = state.units.map((unit) => ({
      ...unit,
      complete: true,
      completedAt: Date.UTC(2026, 9, 5, 12),
      needsReview: false,
    }));
    const page = render(
      createElement(ProgressOverview, { state, view: 'progress' }),
    );
    expect(screen.getByText('All required days completed: 3/3.')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Appendix G — next steps' })
        .getAttribute('href'),
    ).toContain('/guide/appendix-g');
    expect(
      within(
        screen.getByRole('region', { name: 'Days and required work' }),
      ).getByText(/No days match/),
    ).toBeTruthy();
    state.units = state.units.map((unit, index) =>
      index === 0 ? { ...unit, complete: false, completedAt: null } : unit,
    );
    page.rerender(createElement(ProgressOverview, { state, view: 'progress' }));
    expect(
      screen.queryByRole('link', { name: 'Appendix G — next steps' }),
    ).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'Course progress' })).getByText(
        '5/6 required units · 83%',
      ),
    ).toBeTruthy();
  });
});
