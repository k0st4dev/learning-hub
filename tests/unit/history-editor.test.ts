// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installHistoryProtection } from '../../src/lib/history-protection';
import { useExerciseSave } from '../../src/components/use-exercise-save';
import { RequestError, writeApi } from '../../src/lib/client-api';
import { exerciseSubmissionSchema } from '../../src/domain/exercise-requirements';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../src/lib/client-api', async (original) => ({
  ...(await original<object>()),
  writeApi: vi.fn(),
}));
const api = vi.mocked(writeApi);
const empty = exerciseSubmissionSchema.parse({
  tasks: [],
  evidence: '',
  selectedScope: '',
  attested: false,
  result: null,
});
const itemId = 'se-26w-v1:d002-practice';
const replace = history.replaceState.bind(history);
let dispose: () => void;
let exercise: unknown;
let confirm: ReturnType<typeof vi.spyOn>;
function response(evidence: string) {
  return {
    data: {
      revision: 1,
      exerciseProgress: [
        {
          exerciseId: itemId,
          status: 'started',
          submission: { ...empty, evidence },
        },
      ],
    },
  };
}
beforeEach(() => {
  replace({ __NA: true }, '', '/dashboard');
  dispose = installHistoryProtection();
  history.pushState({ __NA: true }, '', '/exercise');
  exercise = history.state;
  history.pushState({ __NA: true }, '', '/progress');
  // Re-enter exercise cleanly to retain a Forward entry.
  replace(exercise, '', '/exercise');
  window.dispatchEvent(new PopStateEvent('popstate', { state: exercise }));
  confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  vi.spyOn(history, 'go').mockImplementation(() => {});
  api.mockReset();
  api.mockResolvedValue(response('Private draft'));
});
afterEach(() => {
  cleanup();
  dispose();
  vi.restoreAllMocks();
});
function mount() {
  return renderHook(() =>
    useExerciseSave(
      itemId,
      'student-one',
      { revision: 0, completed: false, submission: empty },
      empty,
    ),
  );
}
function forward() {
  const target = {
    ...history.state,
    __learningHistory: { ...history.state.__learningHistory, index: 2 },
  };
  replace(target, '', '/progress');
  window.dispatchEvent(new PopStateEvent('popstate', { state: target }));
}
describe('exercise drafts during history traversal', () => {
  it('keeps a private draft after canceled Forward and permits intentional discard', () => {
    const hook = mount();
    act(() =>
      hook.result.current.setDraft({ ...empty, evidence: 'Private draft' }),
    );
    act(forward);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(history.go).toHaveBeenLastCalledWith(-1);
    expect(hook.result.current.draft.evidence).toBe('Private draft');
    expect(api).not.toHaveBeenCalled();
    replace(exercise, '', '/exercise');
    window.dispatchEvent(new PopStateEvent('popstate', { state: exercise }));
    confirm.mockReturnValue(true);
    act(forward);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(history.go).toHaveBeenCalledTimes(1);
  });
  it('warns while a save is pending, then removes protection after its acknowledged commit', async () => {
    const hook = mount();
    let resolve!: (value: ReturnType<typeof response>) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() =>
      hook.result.current.setDraft({ ...empty, evidence: 'Private draft' }),
    );
    let saving: ReturnType<typeof hook.result.current.save>;
    act(() => {
      saving = hook.result.current.save(false);
    });
    act(forward);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(hook.result.current.draft.evidence).toBe('Private draft');
    replace(exercise, '', '/exercise');
    window.dispatchEvent(new PopStateEvent('popstate', { state: exercise }));
    await act(async () => {
      resolve(response('Private draft'));
      await saving;
    });
    expect(hook.result.current.dirty).toBe(false);
    act(forward);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  it.each([0, 403, 409, 422])(
    'retains unsaved input and warns after a %i save failure',
    async (status) => {
      const hook = mount();
      api.mockRejectedValueOnce(
        new RequestError(
          'Save failed',
          status,
          {},
          response('Other saved version').data,
        ),
      );
      act(() =>
        hook.result.current.setDraft({ ...empty, evidence: 'Private draft' }),
      );
      await act(async () => {
        await hook.result.current.save(false);
      });
      await waitFor(() =>
        expect(hook.result.current.error?.status).toBe(status),
      );
      act(forward);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(hook.result.current.draft.evidence).toBe('Private draft');
      expect(api).toHaveBeenCalledTimes(1);
      if (status === 403) expect(hook.result.current.locked).toBe(true);
      if (status === 409)
        expect(hook.result.current.conflict?.submission.evidence).toBe(
          'Other saved version',
        );
    },
  );
  it('does not warn for a clean form or for same-page section history with a dirty form', () => {
    const hook = mount();
    act(() => {
      history.pushState({ __NA: true }, '', '/exercise#evidence');
      hook.result.current.setDraft({ ...empty, evidence: 'Private draft' });
    });
    replace(exercise, '', '/exercise');
    act(() =>
      window.dispatchEvent(new PopStateEvent('popstate', { state: exercise })),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(hook.result.current.draft.evidence).toBe('Private draft');
    act(() => hook.result.current.setDraft(empty));
    act(forward);
    expect(confirm).not.toHaveBeenCalled();
  });
});
