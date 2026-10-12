// @vitest-environment jsdom
import { createElement } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SettingsEditor } from '../../src/components/settings-editor';
import {
  type SettingsState,
  type SettingsSubmission,
} from '../../src/domain/settings';
import { RequestError, writeApi } from '../../src/lib/client-api';
import { allowLearningLeave } from '../../src/lib/learning-leave';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../../src/lib/client-api', async (original) => ({
  ...(await original<object>()),
  writeApi: vi.fn(),
}));
const api = vi.mocked(writeApi);
let saved: SettingsState;
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
beforeEach(() => {
  saved = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'owner@example.test',
    displayName: 'Original',
    timezone: 'UTC',
    theme: 'system',
    revision: 0,
    updatedAt: 1,
  };
  refresh.mockReset();
  api.mockReset();
  api.mockImplementation(async (_url, _method, body) => {
    const input = body as SettingsSubmission;
    saved = {
      ...saved,
      displayName: input.displayName,
      timezone: input.timezone,
      theme: input.theme,
      revision: input.expectedRevision + 1,
      updatedAt: 2,
    };
    return { data: saved };
  });
  read = vi.fn(
    async () => new Response(JSON.stringify({ data: saved }), { status: 200 }),
  );
  vi.stubGlobal('fetch', read);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function mount() {
  render(createElement(SettingsEditor, { initial: saved }));
  await screen.findByText('Saved settings confirmed');
}
function edit(name = 'Changed') {
  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: name },
  });
}
async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  });
}
it('reads owned fresh state, uses explicit saving, and confirms trimmed name and selected theme', async () => {
  await mount();
  expect(read.mock.calls[0]![0]).toContain('expectedStudentId=' + saved.id);
  expect(
    (screen.getByLabelText('Email (read only)') as HTMLInputElement).readOnly,
  ).toBe(true);
  edit(' Changed čć ');
  fireEvent.change(screen.getByLabelText('Theme'), {
    target: { value: 'dark' },
  });
  expect(api).not.toHaveBeenCalled();
  await save();
  expect(saved).toMatchObject({
    displayName: 'Changed čć',
    theme: 'dark',
    revision: 1,
  });
  expect(screen.getByRole('status').textContent).toBe(
    'Saved settings confirmed',
  );
  expect(refresh).toHaveBeenCalledOnce();
});
it('shows inline timezone validation and preserves the draft without sending', async () => {
  await mount();
  edit();
  fireEvent.change(screen.getByLabelText('Timezone'), {
    target: { value: 'Not/AZone' },
  });
  await save();
  expect(screen.getByLabelText('Timezone').getAttribute('aria-invalid')).toBe(
    'true',
  );
  expect(
    (screen.getByLabelText('Display name') as HTMLInputElement).value,
  ).toBe('Changed');
  expect(api).not.toHaveBeenCalled();
});
it('retains an uncertain save identifier and reviews newer state before accepting a replay', async () => {
  await mount();
  edit();
  api.mockRejectedValueOnce(new TypeError('offline'));
  await save();
  const payload = api.mock.calls[0]![2] as SettingsSubmission;
  saved = { ...saved, displayName: 'Another tab', revision: 2 };
  api.mockResolvedValueOnce({
    data: { ...saved, displayName: payload.displayName, revision: 1 },
  });
  await act(async () => {
    fireEvent.click(screen.getByText('Retry the same save'));
  });
  expect(api.mock.calls[1]![2]).toEqual(payload);
  expect(screen.getByText('Another tab')).toBeTruthy();
  expect(
    (screen.getByLabelText('Display name') as HTMLInputElement).value,
  ).toBe('Changed');
  expect(refresh).not.toHaveBeenCalled();
});
it.each([true, false])(
  'requires an explicit conflict choice: keep draft=%s',
  async (keep) => {
    await mount();
    edit();
    saved = { ...saved, displayName: 'Another tab', revision: 3 };
    api.mockRejectedValueOnce(new RequestError('Conflict', 409, {}, saved));
    await save();
    expect(screen.getByText('Latest saved settings')).toBeTruthy();
    await act(async () => {
      fireEvent.click(
        screen.getByText(
          keep
            ? 'Save my draft over this version'
            : 'Use saved settings and discard my draft',
        ),
      );
    });
    expect(
      (screen.getByLabelText('Display name') as HTMLInputElement).value,
    ).toBe(keep ? 'Changed' : 'Another tab');
    expect(api).toHaveBeenCalledTimes(keep ? 2 : 1);
    if (keep)
      expect(api.mock.calls[1]![2]).toMatchObject({ expectedRevision: 3 });
  },
);
it('rejects foreign response data and keeps the original draft', async () => {
  await mount();
  edit();
  api.mockResolvedValueOnce({
    data: {
      ...saved,
      id: '22222222-2222-4222-8222-222222222222',
      displayName: 'Foreign',
      revision: 1,
    },
  });
  await save();
  expect(
    screen.getByText('Sign in to the original account in a new tab'),
  ).toBeTruthy();
  expect(
    (screen.getByLabelText('Display name') as HTMLInputElement).value,
  ).toBe('Changed');
  expect(screen.queryByText('Foreign')).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});
it('protects unsaved navigation and browser close; Stay preserves the draft', async () => {
  await mount();
  edit();
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  let decision!: Promise<boolean>;
  await act(async () => {
    decision = allowLearningLeave();
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Stay and keep my draft' }),
  );
  expect(await decision).toBe(false);
  expect(
    (screen.getByLabelText('Display name') as HTMLInputElement).value,
  ).toBe('Changed');
  await save();
  expect(await allowLearningLeave()).toBe(true);
});
it('locks controls and deduplicates a pending save', async () => {
  await mount();
  edit();
  let finish!: (value: unknown) => void;
  api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(
    screen.getByLabelText('Display name').closest('fieldset')?.disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(api).toHaveBeenCalledOnce();
  await act(async () => {
    finish({ data: { ...saved, displayName: 'Changed', revision: 1 } });
  });
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      'Saved settings confirmed',
    ),
  );
});
