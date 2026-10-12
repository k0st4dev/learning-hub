// @vitest-environment jsdom
import { createElement, Fragment } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PasswordChangeForm } from '../../src/components/password-change-form';
import { SettingsEditor } from '../../src/components/settings-editor';
import { RequestError, writeApi } from '../../src/lib/client-api';
import { allowLearningLeave } from '../../src/lib/learning-leave';
import { type SettingsState } from '../../src/domain/settings';
const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock('../../src/lib/client-api', async (original) => ({
  ...(await original<object>()),
  writeApi: vi.fn(),
}));
const api = vi.mocked(writeApi);
const id = '11111111-1111-4111-8111-111111111111';
const currentPassword = ' Previous private password 😀 ';
const newPassword = ' Next private password čć 😀 ';
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
  api.mockReset();
  api.mockResolvedValue(undefined);
  replace.mockReset();
  refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
function fill(current = currentPassword, next = newPassword) {
  fireEvent.change(field('Current password'), { target: { value: current } });
  fireEvent.change(field('New password'), { target: { value: next } });
}
function mount() {
  return render(
    createElement(PasswordChangeForm, {
      studentId: id,
      email: 'owner@example.test',
    }),
  );
}
async function submit() {
  await act(async () => {
    fireEvent.submit(field('Current password').closest('form')!);
  });
}
it('supports password-manager autocomplete, paste/show and exact spaces/Unicode without a confirmation field', async () => {
  mount();
  expect(field('Current password').autocomplete).toBe('current-password');
  expect(field('New password').autocomplete).toBe('new-password');
  expect(
    field('Current password')
      .closest('form')
      ?.querySelector<HTMLInputElement>('input[name="username"]')?.value,
  ).toBe('owner@example.test');
  expect(screen.queryByLabelText('Confirm password')).toBeNull();
  fill();
  fireEvent.click(screen.getByLabelText('Show passwords'));
  expect(field('New password').type).toBe('text');
  await submit();
  expect(api).toHaveBeenCalledWith('/api/auth/password', 'POST', {
    currentPassword,
    newPassword,
    expectedStudentId: id,
  });
  expect(replace).toHaveBeenCalledWith(
    '/login?returnTo=%2Fsettings&passwordChanged=1',
  );
  expect(refresh).toHaveBeenCalledOnce();
  expect(
    screen.getByText('Password changed. Sign in with your new password.'),
  ).toBeTruthy();
  expect(document.body.textContent).not.toContain(newPassword);
  expect(document.body.textContent).not.toContain(currentPassword);
});
it.each(['short', '😀'.repeat(129), '\u0800'.repeat(200)])(
  'validates code points and UTF-8 bytes locally',
  async (next) => {
    mount();
    fill(currentPassword, next);
    await submit();
    expect(api).not.toHaveBeenCalled();
    expect(field('New password').getAttribute('aria-invalid')).toBe('true');
    expect(field('New password').value).toBe(next);
  },
);
it('clears secrets as soon as sending begins and prevents duplicate submission and navigation while pending', async () => {
  mount();
  fill();
  fireEvent.click(screen.getByLabelText('Show passwords'));
  let finish!: (value: undefined) => void;
  api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await submit();
  expect(field('Current password').value).toBe('');
  expect(field('New password').value).toBe('');
  expect(field('New password').type).toBe('password');
  expect(field('New password').closest('fieldset')?.disabled).toBe(true);
  fireEvent.submit(field('Current password').closest('form')!);
  expect(api).toHaveBeenCalledOnce();
  expect(await allowLearningLeave()).toBe(false);
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  await act(async () => {
    finish(undefined);
  });
});
it('shows server field errors, clears secrets and permits a deliberate corrected attempt', async () => {
  mount();
  fill();
  api.mockRejectedValueOnce(
    new RequestError('Wrong current password', 400, {
      currentPassword: 'Current password is incorrect.',
    }),
  );
  await submit();
  expect(field('Current password').value).toBe('');
  expect(field('New password').value).toBe('');
  expect(field('Current password').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getAllByText('Current password is incorrect.')).toHaveLength(2);
  await waitFor(() =>
    expect(document.activeElement?.getAttribute('role')).toBe('alert'),
  );
  expect(replace).not.toHaveBeenCalled();
  fill();
  await submit();
  expect(api).toHaveBeenCalledTimes(2);
});
it.each([401, 403, 409, 429])(
  'clears submitted secrets and offers safe login/error recovery for %s',
  async (status) => {
    mount();
    fill();
    api.mockRejectedValueOnce(new RequestError('Server rejection', status));
    await submit();
    expect(field('Current password').value).toBe('');
    expect(field('New password').value).toBe('');
    expect(
      screen.getByRole('link', { name: 'Sign in again' }).getAttribute('href'),
    ).toBe('/login?returnTo=%2Fsettings');
    expect(replace).not.toHaveBeenCalled();
  },
);
it.each([
  new TypeError('lost response'),
  new RequestError('Unavailable', 503),
  { data: 'unexpected' },
])('does not replay an uncertain outcome', async (result) => {
  mount();
  fill();
  if (result instanceof Error) api.mockRejectedValueOnce(result);
  else api.mockResolvedValueOnce(result);
  await submit();
  expect(screen.getByText('Result uncertain — sign in to check.')).toBeTruthy();
  expect(
    screen.getByText(
      /If it is rejected as incorrect, try your previous password/,
    ),
  ).toBeTruthy();
  expect(field('New password').value).toBe('');
  expect(
    (
      screen.getByRole('button', {
        name: 'Change password',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.submit(field('Current password').closest('form')!);
  expect(api).toHaveBeenCalledOnce();
  expect(replace).not.toHaveBeenCalled();
});
it('protects entered passwords on navigation, preserves them on Stay and clears them on pagehide', async () => {
  mount();
  fill();
  let decision!: Promise<boolean>;
  await act(async () => {
    decision = allowLearningLeave();
  });
  fireEvent.click(screen.getByText('Stay and keep my draft'));
  expect(await decision).toBe(false);
  expect(field('New password').value).toBe(newPassword);
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(field('Current password').value).toBe('');
  expect(field('New password').value).toBe('');
  expect(await allowLearningLeave()).toBe(true);
  expect(api).not.toHaveBeenCalled();
});
it.each([false, true])(
  'respects unsaved profile changes before revoking the session; consent=%s',
  async (consent) => {
    const initial: SettingsState = {
      id,
      email: 'owner@example.test',
      displayName: 'Original',
      timezone: 'UTC',
      theme: 'system',
      revision: 0,
      updatedAt: 1,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: initial }), { status: 200 }),
      ),
    );
    render(
      createElement(
        Fragment,
        null,
        createElement(SettingsEditor, { initial }),
        createElement(PasswordChangeForm, {
          studentId: id,
          email: 'owner@example.test',
        }),
      ),
    );
    await screen.findByText('Saved settings confirmed');
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Unsaved profile' },
    });
    fill();
    let operation!: Promise<void>;
    await act(async () => {
      operation = (async () => {
        fireEvent.submit(field('Current password').closest('form')!);
      })();
    });
    await operation;
    expect(screen.getByText('Leave with unsaved settings?')).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(
        within(
          screen.getByRole('dialog', { name: 'Leave with unsaved settings?' }),
        ).getByText(
          consent
            ? 'Leave and discard unconfirmed text'
            : 'Stay and keep my draft',
        ),
      );
    });
    expect(api).toHaveBeenCalledTimes(consent ? 1 : 0);
    if (!consent) {
      expect(field('New password').value).toBe(newPassword);
      expect(
        (screen.getByLabelText('Display name') as HTMLInputElement).value,
      ).toBe('Unsaved profile');
    }
  },
);
it('retains confirmed success if navigation fails and clears the old form on unmount', async () => {
  const mounted = mount();
  fill();
  const element = field('Current password');
  replace.mockImplementationOnce(() => {
    throw new Error('navigation failure');
  });
  await submit();
  expect(
    screen.getByRole('link', { name: 'Sign in with your new password' }),
  ).toBeTruthy();
  expect(screen.queryByText('Result uncertain — sign in to check.')).toBeNull();
  mounted.unmount();
  expect(element.value).toBe('');
});
