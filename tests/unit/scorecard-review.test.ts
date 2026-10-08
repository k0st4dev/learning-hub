// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { validateSource } from '../../src/server/content/source-schema';
import { scorecardReviewMilestones } from '../../src/domain/scorecard-review';
import { ProgressOverview } from '../../src/components/progress-overview';
import type { ProgressViewState } from '../../src/domain/progress-presentation';
import { studyAnchors } from '../../src/domain/study-anchors';
const source = validateSource(
  JSON.parse(
    readFileSync('content/se-26w-v1/source/curriculum-source.json', 'utf8'),
  ),
);
function fixture(weeks: number[] = []): ProgressViewState {
  const item = (
    id: string,
    kind: string,
    parentId: string | null,
    orderIndex: number,
    title = id,
  ) => ({ id, stableKey: id, kind, parentId, orderIndex, title });
  return {
    timezone: 'Europe/Ljubljana',
    preparation: [],
    enrollment: {
      releaseId: source.release_id,
      preparationAcknowledgedAt: 1,
      resumeItemId: null,
      resumeAnchor: null,
      resumeUpdatedAt: null,
      lastOpenedItemId: null,
      lastOpenedAt: null,
    },
    weeks: source.weeks.map((w) => ({ itemId: w.id, weekNumber: w.number })),
    days: source.days.map((d) => ({
      itemId: d.id,
      dayNumber: d.number,
      assessmentKind: d.assessment_kind,
      completionCriterionMarkdown: d.completion_criterion,
    })),
    items: [
      ...source.modules.map((m, i) => item(m.id, 'module', null, i, m.title)),
      ...source.weeks.map((w) =>
        item(w.id, 'week', w.module_id, w.number, w.title),
      ),
      ...source.days.flatMap((d) => [
        item(d.id, 'day', d.week_id, d.number, d.title),
        item(d.lesson_id, 'lesson', d.id, 0),
        item(d.exercise_id, 'exercise', d.id, 1),
      ]),
    ],
    units: source.days.flatMap((d) =>
      ['lesson', 'exercise'].map((kind, order) => ({
        id: kind === 'lesson' ? d.lesson_id : d.exercise_id,
        key: kind === 'lesson' ? d.lesson_id : d.exercise_id,
        kind,
        order,
        dayId: d.id,
        dayKey: d.id,
        dayNumber: d.number,
        anchors: studyAnchors(kind),
        complete: weeks.includes(
          source.weeks.find((w) => w.id === d.week_id)!.number,
        ),
        started: false,
        needsReview: false,
        completedAt: null,
        updatedAt: null,
      })),
    ),
  };
}
afterEach(cleanup);
describe('source scorecard review opportunities', () => {
  it.each([4, 8, 12, 16, 20, 24])(
    'offers a review for completed week %i despite earlier gaps',
    (week) => {
      const state = fixture([week]);
      const before = structuredClone(state);
      expect(scorecardReviewMilestones(state)).toEqual([
        {
          key: 'week:' + week,
          label: 'Week ' + week,
          assessmentId: source.days[week * 7 - 1]!.exercise_id,
        },
      ]);
      expect(state).toEqual(before);
    },
  );
  it('ignores new accounts, other weeks and absent scopes', () => {
    expect(scorecardReviewMilestones(fixture())).toEqual([]);
    expect(scorecardReviewMilestones(fixture([1, 3, 5, 7, 25]))).toEqual([]);
    const state = fixture();
    state.units = [];
    expect(scorecardReviewMilestones(state)).toEqual([]);
  });
  it('requires all confirmed week units and reacts to reopening without removing other opportunities', () => {
    const state = fixture([4, 8]);
    const lesson = state.units.find(
      (u) => u.dayNumber === 22 && u.kind === 'lesson',
    )!;
    lesson.complete = false;
    expect(scorecardReviewMilestones(state).map((r) => r.label)).toEqual([
      'Week 8',
    ]);
    lesson.complete = true;
    const checkpoint = state.units.find(
      (u) => u.dayNumber === 28 && u.kind === 'exercise',
    )!;
    checkpoint.complete = false;
    checkpoint.started = true;
    checkpoint.needsReview = true;
    expect(scorecardReviewMilestones(state).map((r) => r.label)).toEqual([
      'Week 8',
    ]);
    checkpoint.complete = true;
    expect(scorecardReviewMilestones(state).map((r) => r.label)).toEqual([
      'Week 4',
      'Week 8',
    ]);
  });
  it('uses published assessment metadata rather than assuming every seventh day', () => {
    const state = fixture([4]);
    state.days.find((d) => d.dayNumber === 28)!.assessmentKind = 'practice';
    expect(scorecardReviewMilestones(state)).toEqual([]);
  });
  it('requires the final exercise confirmation, allows earlier gaps and removes the prompt on reopening', () => {
    const state = fixture();
    state.units.find(
      (u) => u.dayNumber === 182 && u.kind === 'lesson',
    )!.complete = true;
    const final = state.units.find(
      (u) => u.dayNumber === 182 && u.kind === 'exercise',
    )!;
    final.started = true;
    final.needsReview = true;
    expect(scorecardReviewMilestones(state)).toEqual([]);
    final.complete = true;
    expect(scorecardReviewMilestones(state)).toEqual([
      { key: 'final:' + final.id, label: 'Final exam', assessmentId: final.id },
    ]);
    final.complete = false;
    expect(scorecardReviewMilestones(state)).toEqual([]);
  });
  it('retains all seven opportunities in source order across repeated visits and shuffled weeks', () => {
    const state = fixture(source.weeks.map((w) => w.number));
    state.weeks.reverse();
    expect(scorecardReviewMilestones(state).map((r) => r.label)).toEqual([
      'Week 4',
      'Week 8',
      'Week 12',
      'Week 16',
      'Week 20',
      'Week 24',
      'Final exam',
    ]);
    expect(scorecardReviewMilestones(state)).toEqual(
      scorecardReviewMilestones(state),
    );
  });
  it.each(['dashboard', 'course', 'progress'] as const)(
    'shows the owned current-month link on %s without changing credit',
    (view) => {
      const state = fixture([4]);
      const before = structuredClone(state);
      render(
        createElement(ProgressOverview, {
          state,
          view,
          activity: createElement('p', {}, 'Existing activity'),
        }),
      );
      const reminder = screen.getByRole('region', {
        name: 'Scorecard review reminder',
      });
      expect(within(reminder).getByText('Week 4')).toBeTruthy();
      expect(
        within(reminder)
          .getByRole('link', { name: 'Review this month’s scorecard' })
          .getAttribute('href'),
      ).toBe('/progress/scorecard');
      expect(reminder.textContent).toContain('deliberate revision');
      expect(screen.getByText('14/364 required units · 3%')).toBeTruthy();
      expect(
        screen
          .getByText('Existing activity')
          .compareDocumentPosition(reminder) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(state).toEqual(before);
    },
  );
  it('hides the reminder for a new student', () => {
    render(
      createElement(ProgressOverview, { state: fixture(), view: 'dashboard' }),
    );
    expect(
      screen.queryByRole('region', { name: 'Scorecard review reminder' }),
    ).toBeNull();
  });
});
