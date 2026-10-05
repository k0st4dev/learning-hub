// @vitest-environment jsdom
import { createElement as h } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { ExerciseEditor } from '../../src/components/exercise-editor';
import { exerciseSubmissionSchema } from '../../src/domain/exercise-requirements';
import { studyContext } from '../../src/domain/study-context';
import { writeApi, RequestError } from '../../src/lib/client-api';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('../../src/lib/client-api', async (original) => ({
  ...(await original<object>()),
  writeApi: vi.fn(),
}));
const api = vi.mocked(writeApi);
const itemId = 'se-26w-v1:d001-practice';
const empty = exerciseSubmissionSchema.parse({
  tasks: [],
  evidence: '',
  selectedScope: '',
  attested: false,
  result: null,
});
let revision: number;
let active: string | null;
let anchor: string;
let complete: boolean;
let submission: typeof empty;
function state() {
  return {
    revision,
    enrollment: { resumeItemId: active, resumeAnchor: anchor },
    units: [
      {
        id: 'lesson',
        key: 'd001-learn',
        kind: 'lesson',
        dayId: 'd001',
        dayKey: 'd001',
        dayNumber: 1,
        complete: false,
      },
      {
        id: itemId,
        key: 'd001-practice',
        kind: 'exercise',
        dayId: 'd001',
        dayKey: 'd001',
        dayNumber: 1,
        complete,
      },
    ],
    items: [{ kind: 'task', stableKey: 'd001-task-01', parentId: itemId }],
    exerciseProgress: [
      {
        exerciseId: itemId,
        status: complete ? 'completed' : 'started',
        submission,
      },
    ],
  };
}
function accept(input: unknown) {
  const data = input as {
    kind: string;
    anchor: string;
    submission?: typeof empty;
  };
  if (data.kind === 'exercise') submission = data.submission!;
  if (
    data.kind === 'exercise' ||
    (data.kind === 'cursor' && (input as { mode: string }).mode === 'anchor')
  )
    anchor = data.anchor;
  revision++;
  return { data: state() };
}
async function mount() {
  render(
    h(
      'div',
      { 'data-learning-unit': itemId },
      h(
        'nav',
        { 'aria-label': 'Lesson sections' },
        h('a', { href: '#criterion' }, 'Completion criterion'),
      ),
      ...['ai', 'criterion', 'tasks', 'd001-task-01'].map((key) =>
        h(
          'div',
          {
            key,
            id: key,
            'data-study-anchor': key,
            tabIndex: -1,
          },
          key,
        ),
      ),
      h(ExerciseEditor, {
        itemId,
        studentId: 'owner',
        tasks: [{ id: 'd001-task-01', text: 'Original task' }],
        requirements: {
          releaseId: 'se-26w-v1',
          exerciseId: 'd001-practice',
          requiresScope: false,
          tasks: [
            {
              id: 'd001-task-01',
              requirement_mode: 'required',
              completion_rule: 'Original criterion',
            },
          ],
        },
        initial: {
          revision,
          completed: complete,
          submission,
          context: studyContext(state(), itemId),
        },
      }),
    ),
  );
  await act(async () => {});
  expect(api).toHaveBeenCalledTimes(1); // Last opened, separate from active anchors.
  api.mockClear();
}
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
function focus(key: string) {
  fireEvent.focusIn(document.getElementById(key)!);
}
beforeEach(() => {
  vi.useFakeTimers();
  revision = 0;
  active = itemId;
  anchor = 'tasks';
  complete = false;
  submission = empty;
  window.history.replaceState(
    null,
    '',
    '/course/software-engineer/days/d001/exercises/d001-practice',
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  api.mockReset();
  api.mockImplementation(async (_url, _method, input) => accept(input));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('acknowledged active section tracking', () => {
  it('tracks section links even when the router changes history without a hashchange event', async () => {
    await mount();
    fireEvent.click(
      screen
        .getByRole('navigation', { name: 'Lesson sections' })
        .querySelector('a')!,
    );
    expect(document.activeElement?.id).toBe('criterion');
    await tick(999);
    expect(api).not.toHaveBeenCalled();
    await tick(1);
    expect(anchor).toBe('criterion');
  });
  it('retains the acknowledged final evidence section when the page cannot scroll it to the top', async () => {
    anchor = 'evidence';
    await mount();
    vi.spyOn(
      screen.getByLabelText('Evidence'),
      'getBoundingClientRect',
    ).mockReturnValue({ top: 400 } as DOMRect);
    fireEvent.scroll(window);
    await tick(2000);
    expect(document.activeElement?.id).toBe('evidence');
    expect(api).not.toHaveBeenCalled();
  });
  it.each([401, 403])(
    'locks section saves after HTTP %i until the original account can retry',
    async (status) => {
      await mount();
      api.mockRejectedValueOnce(
        new RequestError('Sign in to the original account', status),
      );
      focus('ai');
      await tick(1000);
      focus('criterion');
      await tick(2000);
      expect(api).toHaveBeenCalledTimes(1);
      expect(
        screen
          .getByRole('button', { name: 'Save draft' })
          .hasAttribute('disabled'),
      ).toBe(true);
      expect(
        screen.getByRole('button', { name: 'Retry the same save' }),
      ).toBeTruthy();
    },
  );
  it('debounces to exactly one second, keeps only the latest section and preserves unsaved task text', async () => {
    await mount();
    fireEvent.click(screen.getByLabelText('1. Done'));
    focus('ai');
    await tick(700);
    focus('criterion');
    await tick(999);
    expect(api).not.toHaveBeenCalled();
    await tick(1);
    expect(api).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[0]![2]).toMatchObject({
      mode: 'anchor',
      anchor: 'criterion',
      expectedRevision: 1,
      expectedStudentId: 'owner',
    });
    expect((screen.getByLabelText('1. Done') as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByRole('status').textContent).toContain('Unsaved');
    expect(complete).toBe(false);
    expect(submission.tasks).toHaveLength(0);
    focus('criterion');
    await tick(1200);
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('restores the saved source task with keyboard focus and does not overwrite it on mounting', async () => {
    anchor = 'd001-task-01';
    await mount();
    expect(document.activeElement?.id).toBe('d001-task-01');
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    await tick(2000);
    expect(api).not.toHaveBeenCalled();
  });
  it('honors a valid incoming hash and ignores unsupported hashes', async () => {
    window.history.replaceState(null, '', '#criterion');
    await mount();
    expect(document.activeElement?.id).toBe('criterion');
    // Incoming section navigation is acknowledged after the same debounce.
    await tick(2000);
    expect(anchor).toBe('criterion');
    api.mockClear();
    window.history.replaceState(null, '', '#foreign');
    fireEvent(window, new HashChangeEvent('hashchange'));
    await tick(2000);
    expect(api).not.toHaveBeenCalled();
    window.history.replaceState(null, '', '#ai');
    fireEvent(window, new HashChangeEvent('hashchange'));
    await tick(1000);
    expect(anchor).toBe('ai');
  });
  it.each(['reference', 'completed'])(
    'never sends section writes while viewing %s work',
    async (mode) => {
      if (mode === 'reference') active = 'lesson';
      else complete = true;
      await mount();
      focus('ai');
      focus('criterion');
      await tick(2000);
      expect(api).not.toHaveBeenCalled();
      expect(anchor).toBe('tasks');
    },
  );
  it('samples scrolling and immediately saves a confirmed task action without a second delayed write', async () => {
    await mount();
    for (const key of ['ai', 'criterion', 'tasks', 'd001-task-01'])
      vi.spyOn(
        document.getElementById(key)!,
        'getBoundingClientRect',
      ).mockReturnValue({ top: key === 'd001-task-01' ? 80 : -200 } as DOMRect);
    vi.spyOn(
      screen.getByLabelText('Evidence'),
      'getBoundingClientRect',
    ).mockReturnValue({ top: 900 } as DOMRect);
    fireEvent.scroll(window);
    await tick(20);
    fireEvent.click(screen.getByLabelText('1. Done'));
    focus('evidence'); // Scrolling to Save must not erase the last confirmed task action's anchor.
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await act(async () => {});
    expect(api.mock.calls[0]![2]).toMatchObject({
      kind: 'exercise',
      anchor: 'd001-task-01',
    });
    expect(submission.tasks).toHaveLength(1);
    expect(anchor).toBe('d001-task-01');
    await tick(2000);
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('serializes a newer section after a pending acknowledgment using the new revision', async () => {
    await mount();
    let finish!: (value: unknown) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    focus('ai');
    await tick(1000);
    expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Evidence').matches(':disabled')).toBe(false);
    fireEvent.change(screen.getByLabelText('Evidence'), {
      target: { value: 'Draft typed while a section saves' },
    });
    focus('criterion');
    await tick(2000);
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(accept(api.mock.calls[0]![2]));
    });
    await tick(999);
    expect(api).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(api).toHaveBeenCalledTimes(2);
    expect(
      (screen.getByLabelText('Evidence') as HTMLTextAreaElement).value,
    ).toBe('Draft typed while a section saves');
    expect(api.mock.calls[1]![2]).toMatchObject({
      anchor: 'criterion',
      expectedRevision: 2,
    });
  });
  it('locks uncertain saves, retries the identical receipt and keeps the draft', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText('Evidence'), {
      target: { value: 'Unsaved local work' },
    });
    api.mockRejectedValueOnce(new RequestError('Network unavailable', 0));
    focus('ai');
    await tick(1000);
    focus('criterion');
    await tick(2000);
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry the same save' }),
    );
    await act(async () => {});
    expect(api.mock.calls[1]![2]).toEqual(api.mock.calls[0]![2]);
    expect(
      (screen.getByLabelText('Evidence') as HTMLTextAreaElement).value,
    ).toBe('Unsaved local work');
    await tick(2000);
    expect(api).toHaveBeenCalledTimes(2);
  });
  it('requires explicit conflict resolution and never silently resubmits a stale section', async () => {
    await mount();
    revision = 7;
    anchor = 'evidence';
    active = 'lesson';
    api.mockRejectedValueOnce(
      new RequestError('Another tab changed progress', 409, {}, state()),
    );
    focus('ai');
    await tick(1000);
    focus('criterion');
    await tick(2000);
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Keep my draft and use the latest revision',
      }),
    );
    await tick(2000);
    expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/^Reference view\./)).toBeTruthy();
  });
  it('cancels an unacknowledged debounce when the unit page unmounts', async () => {
    await mount();
    focus('ai');
    await tick(999);
    cleanup();
    await tick(1000);
    expect(api).not.toHaveBeenCalled();
    expect(anchor).toBe('tasks');
  });
});
