// @vitest-environment jsdom
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ScorecardEditor,
  priorScorecardPeriod,
} from '../../src/components/scorecard-editor';
import type {
  ScorecardState,
  ScorecardSubmission,
} from '../../src/domain/scorecards';
import { RequestError, writeApi } from '../../src/lib/client-api';
import { allowLearningLeave } from '../../src/lib/learning-leave';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../../src/lib/client-api', async (original) => ({
  ...(await original<object>()),
  writeApi: vi.fn(),
}));
const source = JSON.parse(
  readFileSync('content/se-26w-v1/source/curriculum-source.json', 'utf8'),
).scorecard as { dimensions: string[]; scale: string[] };
const api = vi.mocked(writeApi);
let saved: ScorecardState;
let previous: ScorecardState;
let read: ReturnType<typeof vi.fn>;
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
async function mount(initial = saved) {
  await act(async () => {
    render(
      createElement(ScorecardEditor, {
        studentId: 'owner',
        timezone: 'Europe/Ljubljana',
        initial,
      }),
    );
  });
}
function rating(key = 'Git') {
  return screen.getByLabelText('Rating — ' + key) as HTMLSelectElement;
}
function evidence(key = 'Git') {
  return screen.getByLabelText('Evidence — ' + key) as HTMLTextAreaElement;
}
function edit(text: string) {
  fireEvent.change(evidence(), { target: { value: text } });
}
async function save() {
  await act(async () => {
    fireEvent.click(screen.getByText('Save review'));
  });
}
function commit(input: ScorecardSubmission) {
  saved = {
    ...saved,
    ratings: input.ratings,
    evidence: input.evidence,
    revision: input.expectedRevision + 1,
    createdAt: saved.createdAt ?? 10,
    updatedAt: 20,
  };
  return { data: saved };
}
beforeEach(() => {
  saved = {
    periodKey: '2026-10',
    dimensions: source.dimensions,
    scale: source.scale,
    ratings: {},
    evidence: {},
    revision: 0,
    createdAt: null,
    updatedAt: null,
  };
  previous = { ...saved, periodKey: '2026-09' };
  push.mockReset();
  api.mockReset();
  api.mockImplementation(async (_url, _method, input) =>
    commit(input as ScorecardSubmission),
  );
  read = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify({ data: url.includes('2026-09') ? previous : saved }),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', read);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('monthly scorecard editor', () => {
  it('shows all fourteen original dimensions and scale labels without silently filling zero or saving on mount/blur', async () => {
    await mount();
    expect(screen.getAllByRole('combobox')).toHaveLength(14);
    expect(screen.getAllByRole('textbox')).toHaveLength(14);
    for (const key of source.dimensions) {
      expect(rating(key).value).toBe('');
      expect(
        within(rating(key))
          .getAllByRole('option')
          .map((e) => e.textContent),
      ).toEqual(['Not assessed', ...source.scale.map((s, i) => i + ' — ' + s)]);
      expect(evidence(key).maxLength).toBe(2000);
    }
    expect(screen.getByText('Not assessed — no review saved')).toBeTruthy();
    edit('<script>plain</script> Ћирилица 😀');
    fireEvent.blur(evidence());
    expect(api).not.toHaveBeenCalled();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('saves zero explicitly, leaves other areas unassessed, then removes a rating and clears evidence', async () => {
    await mount();
    fireEvent.change(rating(), { target: { value: '0' } });
    edit('Exact чћ text');
    await save();
    expect(api.mock.calls[0]![2]).toMatchObject({
      periodKey: '2026-10',
      expectedStudentId: 'owner',
      expectedRevision: 0,
      ratings: { Git: 0 },
      evidence: { Git: 'Exact чћ text' },
    });
    expect(screen.getByText('Saved', { exact: true })).toBeTruthy();
    fireEvent.change(rating(), { target: { value: '' } });
    edit('');
    await save();
    expect(api.mock.calls[1]![2]).toMatchObject({
      expectedRevision: 1,
      ratings: {},
      evidence: {},
    });
  });
  it('refreshes a cached server state and never labels an older snapshot Saved', async () => {
    const cached = { ...saved, revision: 1, evidence: { Git: 'cached' } };
    saved = { ...cached, revision: 3, evidence: { Git: 'newer' } };
    await mount(cached);
    expect(evidence().value).toBe('newer');
    expect(read).toHaveBeenCalledWith(
      '/api/scorecards/2026-10?expectedStudentId=owner',
      { cache: 'no-store' },
    );
  });
  it('retains typing during a pending save and requires a second explicit save', async () => {
    await mount();
    edit('first');
    let acknowledge!: (result: { data: ScorecardState }) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve;
        }),
    );
    await save();
    edit('later typing');
    await act(async () => {
      acknowledge(commit(api.mock.calls[0]![2] as ScorecardSubmission));
    });
    expect(evidence().value).toBe('later typing');
    expect(
      screen.getByText('Unsaved changes — choose Save review'),
    ).toBeTruthy();
    expect(api).toHaveBeenCalledOnce();
    await save();
    expect(api.mock.calls[1]![2]).toMatchObject({
      expectedRevision: 1,
      evidence: { Git: 'later typing' },
    });
  });
  it.each([0, 401, 403, 503])(
    'keeps drafts after %s and retries only the original payload',
    async (status) => {
      api.mockRejectedValueOnce(new RequestError('Not confirmed', status));
      await mount();
      edit('uncertain draft');
      await save();
      const original = api.mock.calls[0]![2];
      edit('later edits');
      expect(evidence().disabled).toBe(false);
      await act(async () => {
        fireEvent.click(screen.getByText('Retry the same review save'));
      });
      expect(api.mock.calls[1]![2]).toEqual(original);
      expect(api).toHaveBeenCalledTimes(2);
      expect(evidence().value).toBe('later edits');
      expect(
        screen.getByText('Unsaved changes — choose Save review'),
      ).toBeTruthy();
    },
  );
  it('checks old retry acknowledgment against latest state without overwriting newer work', async () => {
    api.mockRejectedValueOnce(new RequestError('Uncertain', 503));
    await mount();
    edit('my draft');
    await save();
    api.mockImplementationOnce(async (_url, _method, input) => {
      const ack = commit(input as ScorecardSubmission);
      saved = { ...saved, revision: 3, evidence: { Git: 'other tab' } };
      return ack;
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Retry the same review save'));
    });
    expect(evidence().value).toBe('my draft');
    expect(
      within(
        screen.getByRole('region', { name: 'Latest saved review' }),
      ).getByText('other tab'),
    ).toBeTruthy();
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => {
      fireEvent.click(screen.getByText('Save my draft over this version'));
    });
    expect(api.mock.calls[2]![2]).toMatchObject({
      expectedRevision: 3,
      evidence: { Git: 'my draft' },
    });
  });
  it('uses explicit conflict discard and rejects foreign-month recovery data', async () => {
    await mount();
    edit('draft');
    const latest = { ...saved, revision: 2, evidence: { Git: 'new saved' } };
    api.mockRejectedValueOnce(new RequestError('Conflict', 409, {}, latest));
    await save();
    await act(async () => {
      fireEvent.click(
        screen.getByText('Use saved review and discard my draft'),
      );
    });
    expect(evidence().value).toBe('new saved');
    edit('keep this');
    api.mockRejectedValueOnce(
      new RequestError(
        'Conflict',
        409,
        {},
        { ...latest, periodKey: '2026-08' },
      ),
    );
    await save();
    expect(
      screen.queryByRole('region', { name: 'Latest saved review' }),
    ).toBeNull();
    expect(screen.getByText('Review latest saved review')).toBeTruthy();
  });
  it('compares only confirmed saved months and preserves unassessed versus zero', async () => {
    saved = { ...saved, revision: 1, ratings: { Git: 0 } };
    previous = { ...previous, revision: 1, ratings: { Git: 3 } };
    await mount();
    const comparison = screen.getByRole('region', {
      name: 'Monthly comparison',
    });
    expect(within(comparison).getByText('0 — Ne znam')).toBeTruthy();
    fireEvent.change(rating(), { target: { value: '2' } });
    expect(within(comparison).queryByText('2 — Sam')).toBeNull();
    expect(within(comparison).getAllByText('Not assessed')).toHaveLength(26);
  });
  it('keeps current editing available on comparison failure and allows a focused retry', async () => {
    read.mockImplementation(async (url: string) =>
      url.includes('2026-09')
        ? new Response('{}', { status: 503 })
        : new Response(JSON.stringify({ data: saved })),
    );
    await mount();
    edit('still editable');
    expect(screen.getByText('Retry previous month')).toBeTruthy();
    read.mockImplementation(
      async (url: string) =>
        new Response(
          JSON.stringify({ data: url.includes('2026-09') ? previous : saved }),
        ),
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Retry previous month'));
    });
    expect(evidence().value).toBe('still editable');
    expect(
      screen.getByText(
        'No saved review for the previous month. No comparison is shown.',
      ),
    ).toBeTruthy();
  });
  it('protects unsaved navigation/month changes with a keyboard dialog and never autosaves/discards on cancel', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    await mount();
    edit('keep me');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    let leaving!: Promise<boolean>;
    await act(async () => {
      leaving = allowLearningLeave();
    });
    const modal = screen.getByRole('dialog', {
      name: 'Leave with an unsaved review?',
    });
    await act(async () => {
      fireEvent(
        modal,
        new Event('cancel', { bubbles: true, cancelable: true }),
      );
    });
    expect(await leaving).toBe(false);
    expect(evidence().value).toBe('keep me');
    fireEvent.change(screen.getByLabelText('Review month'), {
      target: { value: '2026-11' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByText('View month').closest('form')!);
    });
    expect(push).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByText('Leave and discard unconfirmed text'));
    });
    expect(push).toHaveBeenCalledWith('/progress/scorecard?period=2026-11');
    expect(api).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });
  it('waits for a pending successful save before allowing clean departure', async () => {
    await mount();
    edit('save');
    let acknowledge!: (result: { data: ScorecardState }) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve;
        }),
    );
    await save();
    let leaving!: Promise<boolean>;
    await act(async () => {
      leaving = allowLearningLeave();
    });
    await act(async () => {
      acknowledge(commit(api.mock.calls[0]![2] as ScorecardSubmission));
    });
    expect(await leaving).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('handles year boundaries and does not compare before the first valid month', () => {
    expect(priorScorecardPeriod('2026-01')).toBe('2025-12');
    expect(priorScorecardPeriod('0001-01')).toBeNull();
    expect(priorScorecardPeriod('2026-10')).toBe('2026-09');
  });
});
