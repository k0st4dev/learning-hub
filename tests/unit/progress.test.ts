import { describe, expect, it } from 'vitest';
import {
  progressScopes,
  requiredProgress,
  unitStatus,
} from '../../src/domain/progress';
import { resolveContinue } from '../../src/domain/resume';
function units() {
  return Array.from({ length: 14 }, (_, index) => ({
    id: 'unit-' + index,
    key: 'unit-' + index,
    kind: index % 2 ? 'exercise' : 'lesson',
    dayId: 'day-' + Math.floor(index / 2),
    dayKey: 'd' + String(Math.floor(index / 2) + 1).padStart(3, '0'),
    dayNumber: Math.floor(index / 2) + 1,
    complete: index < 13,
    started: index === 13,
    completedAt: index < 13 ? 100 + index : null,
  }));
}
describe('canonical required-unit rollups and resume', () => {
  it('floors 13/14 to 92, counts only fully complete days and retains independent unit credit', () => {
    const data = units();
    expect(requiredProgress(data)).toMatchObject({
      completed: 13,
      total: 14,
      percent: 92,
      completedDays: 6,
      totalDays: 7,
      remainingLessons: 0,
      remainingExercises: 1,
      completedAt: null,
    });
    data[13]!.complete = true;
    data[13]!.completedAt = 113;
    expect(requiredProgress(data)).toMatchObject({
      percent: 100,
      completedDays: 7,
      status: 'completed',
      completedAt: 113,
    });
    data[0]!.complete = false;
    data[0]!.completedAt = null;
    expect(requiredProgress(data)).toMatchObject({
      percent: 92,
      completedDays: 6,
      remainingLessons: 1,
      remainingExercises: 0,
      completedAt: null,
    });
    expect(requiredProgress(data.slice(0, 2)).percent).toBe(50);
  });
  it('never turns started or Needs review into completion; empty scopes are not applicable', () => {
    const unit = {
      id: 'a',
      dayId: 'day',
      kind: 'exercise',
      complete: false,
      started: true,
      needsReview: true,
    };
    expect(requiredProgress([unit])).toMatchObject({
      completed: 0,
      percent: 0,
      status: 'started',
      needsReview: 1,
    });
    expect(unitStatus(unit)).toBe('needs_review');
    expect(unitStatus({ ...unit, complete: true })).toBe('completed');
    expect(requiredProgress([])).toMatchObject({
      percent: null,
      status: 'not_applicable',
      completedAt: null,
    });
  });
  it('uses descendant membership, excludes unrelated content and rejects hierarchy cycles', () => {
    const data = units();
    const items = [
      { id: 'phase', parentId: null },
      { id: 'week', parentId: 'phase' },
      ...Array.from({ length: 7 }, (_, index) => ({
        id: 'day-' + index,
        parentId: 'week',
      })),
      ...data.map((unit) => ({ id: unit.id, parentId: unit.dayId })),
      { id: 'guide', parentId: 'phase' },
    ];
    const scopes = progressScopes(data, items);
    expect(requiredProgress(scopes.get('phase')!)).toMatchObject({
      completed: 13,
      total: 14,
    });
    expect(scopes.get('guide')).toBeUndefined();
    expect(scopes.get('day-0')).toHaveLength(2);
    expect(() =>
      progressScopes(data, [
        ...items.filter((item) => item.id !== 'phase'),
        { id: 'phase', parentId: 'week' },
      ]),
    ).toThrow('hierarchy');
  });
  it('honors preparation, active anchors, completed-cursor same-day fallback, gaps and all-complete', () => {
    const data = units().map((unit) => ({ ...unit, complete: false }));
    const state = {
      units: data,
      enrollment: {
        preparationAcknowledgedAt: null as number | null,
        resumeItemId: data[12]!.id as string | null,
        resumeAnchor: 'criterion' as string | null,
      },
    };
    expect(resolveContinue(null).reason).toBe('unenrolled');
    expect(resolveContinue(state).path).toMatch(/preparation$/);
    state.enrollment.preparationAcknowledgedAt = 1;
    expect(resolveContinue(state)).toMatchObject({
      reason: 'active',
      outOfSequence: true,
      target: { id: data[12]!.id },
      recommended: { id: data[0]!.id },
    });
    expect(resolveContinue(state).path).toMatch(/#criterion$/);
    data[12]!.complete = true;
    expect(resolveContinue(state).target?.id).toBe(data[13]!.id);
    data[13]!.complete = true;
    expect(resolveContinue(state).target?.id).toBe(data[0]!.id);
    state.enrollment.resumeItemId = 'removed';
    expect(resolveContinue(state)).toMatchObject({
      fallback: true,
      target: { id: data[0]!.id },
    });
    data.forEach((unit) => (unit.complete = true));
    expect(resolveContinue(state)).toMatchObject({
      reason: 'completed',
      path: '/course/software-engineer/progress',
      target: null,
    });
  });
});
