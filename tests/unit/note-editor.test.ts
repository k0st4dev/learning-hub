// @vitest-environment jsdom
import { createElement } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from '../../src/components/note-editor';
import { type NoteState, type NoteSubmission } from '../../src/domain/notes';
import { RequestError, writeApi } from '../../src/lib/client-api';
import { allowLearningLeave } from '../../src/lib/learning-leave';

vi.mock('../../src/lib/client-api', async (original) => ({
  ...(await original<object>()),
  writeApi: vi.fn(),
}));
const api = vi.mocked(writeApi);
// jsdom has no native dialog implementation; real focus/Escape are checked in the browser.
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  },
  close: {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  },
});
const itemId = 'se-26w-v1:d001';
let saved: NoteState;
let confirm: ReturnType<typeof vi.spyOn>;
let read: ReturnType<typeof vi.fn>;
function mount(initial = saved) {
  return render(
    createElement(NoteEditor, { studentId: 'owner', initial, kind: 'day' }),
  );
}
function field() {
  return screen.getByLabelText('My note') as HTMLTextAreaElement;
}
function edit(body: string) {
  fireEvent.change(field(), { target: { value: body } });
}
async function blur() {
  await act(async () => {
    fireEvent.blur(field());
  });
}
function commit(input: NoteSubmission) {
  saved = {
    itemId,
    body: input.body,
    revision: input.expectedRevision + 1,
    createdAt: saved.createdAt ?? 10,
    updatedAt: 20,
  };
  return { data: saved, revision: saved.revision };
}
beforeEach(() => {
  vi.useFakeTimers();
  saved = { itemId, body: '', revision: 0, createdAt: null, updatedAt: null };
  api.mockReset();
  api.mockImplementation(async (_url, _method, input) =>
    commit(input as NoteSubmission),
  );
  read = vi.fn(
    async () => new Response(JSON.stringify({ data: saved }), { status: 200 }),
  );
  vi.stubGlobal('fetch', read);
  confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('private note editor', () => {
  it('refreshes a cached Back/Forward server snapshot from the owned no-store read before displaying Saved', async () => {
    const cached = {
      ...saved,
      body: 'cached old body',
      revision: 1,
      createdAt: 10,
      updatedAt: 10,
    };
    saved = {
      ...cached,
      body: 'newer confirmed body',
      revision: 3,
      updatedAt: 20,
    };
    await act(async () => {
      mount(cached);
    });
    expect(field().value).toBe(saved.body);
    expect(screen.getByRole('status').textContent).toBe('Saved');
    expect(api).not.toHaveBeenCalled();
  });
  it('keeps typing that began before the initial read finishes and requires review of a newer saved note', async () => {
    let resolve!: (response: Response) => void;
    read.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    mount();
    edit('typed during read');
    const newer = {
      ...saved,
      body: 'another tab confirmed',
      revision: 2,
      createdAt: 10,
      updatedAt: 20,
    };
    await act(async () => {
      resolve(new Response(JSON.stringify({ data: newer }), { status: 200 }));
    });
    expect(field().value).toBe('typed during read');
    expect(
      (screen.getByLabelText('Latest saved note') as HTMLTextAreaElement).value,
    ).toBe(newer.body);
    expect(api).not.toHaveBeenCalled();
  });
  it('does not write on mount; preserves exact plain text and renders HTML inertly', async () => {
    saved = {
      ...saved,
      body: '<script>private</script>\n čćžšđ Ћирилица 😀 ',
      revision: 1,
      createdAt: 10,
      updatedAt: 20,
    };
    await act(async () => {
      mount();
    });
    expect(field().value).toBe(saved.body);
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Saved');
    expect(api).not.toHaveBeenCalled();
    expect(field().maxLength).toBe(20000);
  });
  it('debounces for exactly 800 ms after the last edit and shows Saved only after acknowledgment', async () => {
    mount();
    edit('first');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    edit(' čćžšđ\nsecond ');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(799);
    });
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Unsaved');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(api).toHaveBeenCalledOnce();
    expect(saved.body).toBe(' čćžšđ\nsecond ');
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });
  it('flushes on blur with the note revision/account guard and saves cleared text', async () => {
    saved = {
      ...saved,
      body: 'old note',
      revision: 8,
      createdAt: 10,
      updatedAt: 10,
    };
    mount();
    edit('');
    await blur();
    expect(api.mock.calls[0]?.slice(0, 2)).toEqual([
      '/api/notes/se-26w-v1%3Ad001',
      'PUT',
    ]);
    expect(api.mock.calls[0]?.[2]).toMatchObject({
      itemId,
      expectedRevision: 8,
      expectedStudentId: 'owner',
      body: '',
    });
    expect(saved).toMatchObject({ revision: 9, body: '' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(api).toHaveBeenCalledOnce();
  });
  it('retains new typing during a pending save and serializes the next draft against the acknowledged revision', async () => {
    let acknowledge!: (value: ReturnType<typeof commit>) => void;
    api.mockImplementationOnce(
      (_url, _method, input) =>
        new Promise((resolve) => {
          acknowledge = () => resolve(commit(input as NoteSubmission));
        }),
    );
    mount();
    edit('first draft');
    await blur();
    expect(screen.getByRole('status').textContent).toBe('Saving…');
    edit('newer typing');
    expect(field().disabled).toBe(false);
    await act(async () => {
      acknowledge(commit(api.mock.calls[0]![2] as NoteSubmission));
    });
    expect(field().value).toBe('newer typing');
    expect(api).toHaveBeenCalledTimes(2);
    expect(api.mock.calls[1]![2]).toMatchObject({
      body: 'newer typing',
      expectedRevision: 1,
    });
    expect(saved.body).toBe('newer typing');
  });
  it.each([401, 403, 503, 0])(
    'keeps a failed draft editable after status %i and retries the exact request before saving later typing',
    async (status) => {
      api.mockRejectedValueOnce(new RequestError('Save failed', status));
      mount();
      edit('original request');
      await blur();
      const original = api.mock.calls[0]![2];
      expect(field().value).toBe('original request');
      expect(screen.getByRole('status').textContent).toBe('Could not save');
      edit('typed after failure');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(api).toHaveBeenCalledOnce();
      await act(async () => {
        fireEvent.click(screen.getByText('Retry the same note save'));
      });
      expect(api.mock.calls[1]![2]).toEqual(original);
      expect(api.mock.calls[2]![2]).toMatchObject({
        body: 'typed after failure',
        expectedRevision: 1,
      });
      expect(field().value).toBe('typed after failure');
      expect(read).toHaveBeenCalledWith(
        '/api/notes/se-26w-v1%3Ad001?expectedStudentId=owner',
        { cache: 'no-store' },
      );
      expect(screen.getByRole('status').textContent).toBe('Saved');
    },
  );
  it('reconciles an older exact receipt with the latest saved note without silently overwriting another tab', async () => {
    api.mockRejectedValueOnce(
      new RequestError('Uncertain acknowledgment', 503),
    );
    mount();
    edit('my draft');
    await blur();
    api.mockImplementationOnce(async (_url, _method, input) => {
      const acknowledgment = commit(input as NoteSubmission);
      saved = { ...saved, body: 'newer tab text', revision: 3 };
      return acknowledgment;
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Retry the same note save'));
    });
    expect(field().value).toBe('my draft');
    expect(
      (screen.getByLabelText('Latest saved note') as HTMLTextAreaElement).value,
    ).toBe('newer tab text');
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => {
      fireEvent.click(screen.getByText('Save my draft over this version'));
    });
    expect(api.mock.calls[2]![2]).toMatchObject({
      expectedRevision: 3,
      body: 'my draft',
    });
    expect(saved.revision).toBe(4);
  });
  it('offers explicit conflict review/discard; malformed foreign-item state is never trusted', async () => {
    const latest = {
      ...saved,
      revision: 2,
      body: 'saved by another tab',
      createdAt: 10,
      updatedAt: 20,
    };
    api.mockRejectedValueOnce(new RequestError('Conflict', 409, {}, latest));
    mount();
    edit('local draft');
    await blur();
    expect(field().value).toBe('local draft');
    fireEvent.click(screen.getByText('Use saved note and discard my draft'));
    expect(field().value).toBe(latest.body);
    expect(screen.getByRole('status').textContent).toBe('Saved');
    expect(api).toHaveBeenCalledOnce();
    api.mockRejectedValueOnce(
      new RequestError('Conflict', 409, {}, { ...latest, itemId: 'foreign' }),
    );
    edit('keep me');
    await blur();
    expect(screen.queryByLabelText('Latest saved note')).toBeNull();
    expect(screen.getByText('Review latest saved note')).toBeTruthy();
  });
  it('flushes intentional navigation without a prompt after success; failed flush cancellation retains the draft', async () => {
    mount();
    edit('save before leaving');
    let allowed = false;
    await act(async () => {
      allowed = await allowLearningLeave();
    });
    expect(allowed).toBe(true);
    expect(saved.body).toBe('save before leaving');
    expect(confirm).not.toHaveBeenCalled();
    api.mockRejectedValueOnce(new RequestError('Offline', 503));
    edit('unsaved draft');
    let leaving!: Promise<boolean>;
    await act(async () => {
      leaving = allowLearningLeave();
    });
    expect(
      screen.getByRole('dialog', { name: 'Leave with an unsaved note?' }),
    ).toBeTruthy();
    expect(document.querySelector('button dialog')).toBeNull();
    const stay = screen.getByText('Stay and keep my draft');
    const discard = screen.getByText('Leave and discard unconfirmed text');
    discard.focus();
    fireEvent.keyDown(discard, { key: 'Tab' });
    expect(document.activeElement).toBe(stay);
    fireEvent.keyDown(stay, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(discard);
    await act(async () => {
      fireEvent.click(screen.getByText('Stay and keep my draft'));
      allowed = await leaving;
    });
    expect(allowed).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(field().value).toBe('unsaved draft');
    await act(async () => {
      leaving = allowLearningLeave();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Leave and discard unconfirmed text'));
      allowed = await leaving;
    });
    expect(allowed).toBe(true);
    expect(api).toHaveBeenCalledTimes(2);
  });
  it('warns on native unload while pending/dirty, removes the warning after save and does not write browser storage', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    edit('draft');
    const first = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    await blur();
    const second = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
    expect(local).not.toHaveBeenCalled();
  });
});
