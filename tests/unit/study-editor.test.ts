// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StudyEditor } from '../../src/components/study-editor';
import { studyContext } from '../../src/domain/study-context';
import { exerciseSubmissionSchema } from '../../src/domain/exercise-requirements';
import { writeApi, RequestError } from '../../src/lib/client-api';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('../../src/lib/client-api', async (original) => ({
  ...(await original<object>()),
  writeApi: vi.fn(),
}));
const api = vi.mocked(writeApi);
const lessonId = 'se-26w-v1:d001-learn';
const exerciseId = 'se-26w-v1:d001-practice';
const empty = exerciseSubmissionSchema.parse({
  tasks: [],
  evidence: '',
  selectedScope: '',
  attested: false,
  result: null,
});
let revision: number;
let units: {
  id: string;
  key: string;
  kind: string;
  dayId: string;
  dayKey: string;
  dayNumber: number;
  complete: boolean;
}[];
let active: string | null;
function state() {
  return {
    revision,
    units: units.map((unit) => ({ ...unit })),
    enrollment: { resumeItemId: active },
    exerciseProgress: [],
  };
}
function mount(complete = false, dayOverview = false) {
  units[0]!.complete = complete;
  return render(
    createElement(StudyEditor, {
      itemId: lessonId,
      studentId: 'owner',
      dayOverview,
      initial: {
        revision,
        completed: complete,
        submission: empty,
        context: studyContext(state(), lessonId),
      },
    }),
  );
}
beforeEach(() => {
  revision = 0;
  active = null;
  units = [
    {
      id: lessonId,
      key: 'd001-learn',
      kind: 'lesson',
      dayId: 'd001',
      dayKey: 'd001',
      dayNumber: 1,
      complete: false,
    },
    {
      id: exerciseId,
      key: 'd001-practice',
      kind: 'exercise',
      dayId: 'd001',
      dayKey: 'd001',
      dayNumber: 1,
      complete: false,
    },
    {
      id: 'se-26w-v1:d002-learn',
      key: 'd002-learn',
      kind: 'lesson',
      dayId: 'd002',
      dayKey: 'd002',
      dayNumber: 2,
      complete: false,
    },
  ];
  api.mockReset();
  api.mockImplementation(async (_url, _method, input) => {
    const data = input as {
      kind: string;
      itemId: string;
      mode?: string;
      completed?: boolean;
    };
    if (data.kind === 'lesson') {
      units.find((unit) => unit.id === data.itemId)!.complete =
        !!data.completed;
      active = data.itemId;
    }
    if (data.kind === 'cursor' && data.mode === 'study') active = data.itemId;
    revision++;
    return { data: state() };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('explicit full-course study actions', () => {
  it('records reference opening once and awards no completion until confirmed', async () => {
    mount();
    await screen.findByText('Saved on this computer.');
    expect(api).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[0]![2]).toMatchObject({
      kind: 'cursor',
      mode: 'open',
      expectedStudentId: 'owner',
      expectedRevision: 0,
    });
    expect(
      screen.getByText('0/2 required units in this day · 0%'),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark study complete' }),
    );
    await screen.findByRole('link', { name: 'Continue to exercise' });
    expect(api.mock.calls[1]![2]).toMatchObject({
      kind: 'lesson',
      completed: true,
      expectedRevision: 1,
      expectedStudentId: 'owner',
    });
    expect(
      screen.getByText('1/2 required units in this day · 50%'),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Continue to exercise' })
        .getAttribute('href'),
    ).toContain('/exercises/d001-practice');
    expect(units[1]!.complete).toBe(false);
  });
  it('requires confirmation to reopen and retains exercise credit', async () => {
    units[1]!.complete = true;
    active = units[2]!.id;
    mount(true);
    await screen.findByText('Saved on this computer.');
    expect(active).toBe(units[2]!.id);
    fireEvent.click(
      screen.getByRole('button', { name: 'Reopen study lesson' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Reopen study lesson' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reopen' }));
    await screen.findByRole('button', { name: 'Mark study complete' });
    expect(units[1]!.complete).toBe(true);
    expect(api.mock.calls[1]![2]).toMatchObject({
      kind: 'lesson',
      completed: false,
    });
  });
  it('retries an uncertain completion with the identical receipt and does not show premature credit', async () => {
    mount();
    await screen.findByText('Saved on this computer.');
    api.mockRejectedValueOnce(new RequestError('Network unavailable', 0));
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark study complete' }),
    );
    await screen.findByRole('alert');
    expect(
      screen.queryByRole('link', { name: 'Continue to exercise' }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry the same save' }),
    );
    await screen.findByRole('link', { name: 'Continue to exercise' });
    expect(api.mock.calls[2]![2]).toEqual(api.mock.calls[1]![2]);
  });
  it('resolves a stale lesson from confirmed state instead of silently resubmitting', async () => {
    mount();
    await screen.findByText('Saved on this computer.');
    units[0]!.complete = true;
    revision = 7;
    api.mockRejectedValueOnce(
      new RequestError('Another tab changed progress', 409, {}, state()),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark study complete' }),
    );
    const alert = await screen.findByRole('alert');
    expect(document.activeElement).toBe(alert);
    fireEvent.click(
      screen.getByRole('button', { name: 'Use latest confirmed progress' }),
    );
    expect(api).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole('button', { name: 'Reopen study lesson' }),
    ).toBeTruthy();
  });
  it('keeps reference browsing separate from explicit study selection', async () => {
    active = units[2]!.id;
    mount();
    await screen.findByText('Saved on this computer.');
    expect(active).toBe(units[2]!.id);
    fireEvent.click(screen.getByRole('button', { name: 'Open reference' }));
    await waitFor(() => expect(revision).toBe(2));
    expect(active).toBe(units[2]!.id);
    fireEvent.click(screen.getByRole('button', { name: 'Study this day' }));
    await screen.findByText('This unit is your active study location.');
    expect(api.mock.calls[2]![2]).toMatchObject({
      kind: 'cursor',
      mode: 'study',
      itemId: lessonId,
    });
    expect(units[0]!.complete).toBe(false);
  });
  it('does not write merely by visiting the day overview and prevents duplicate completion clicks', async () => {
    mount(false, true);
    expect(api).not.toHaveBeenCalled();
    let resolve!: (value: unknown) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark study complete' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Mark study complete' }),
    );
    expect(api).toHaveBeenCalledTimes(1);
    units[0]!.complete = true;
    revision++;
    resolve({ data: state() });
    await screen.findByRole('link', { name: 'Continue to exercise' });
  });
});
