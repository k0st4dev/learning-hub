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
import { AuthForm } from '../../src/components/auth-form';
import { RequestError, writeApi } from '../../src/lib/client-api';
const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('../../src/lib/client-api', async (original) => ({
  ...(await original<object>()),
  writeApi: vi.fn(),
}));
const api = vi.mocked(writeApi),
  password = ' Secret with spaces and Unicode čć 😀 ';
beforeEach(() => {
  api.mockReset();
  push.mockReset();
  refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const field = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement;
function mount(mode: 'register' | 'login' = 'login') {
  const rendered = render(
    createElement(AuthForm, { mode, returnTo: '/settings' }),
  );
  fireEvent.change(field('Email'), { target: { value: 'owner@example.test' } });
  fireEvent.change(field('Password'), { target: { value: password } });
  if (mode === 'register') {
    fireEvent.change(field('Display name (optional)'), {
      target: { value: 'Owner' },
    });
    fireEvent.change(field('Confirm password'), {
      target: { value: password },
    });
  }
  return rendered;
}
async function submit() {
  await act(async () => {
    fireEvent.submit(field('Email').closest('form')!);
  });
}
it.each(['login', 'register'] as const)(
  'clears only secrets after failed %s and restores masked fields',
  async (mode) => {
    mount(mode);
    fireEvent.click(screen.getByLabelText('Show password'));
    api.mockRejectedValueOnce(
      new RequestError('Rejected', 400, { password: 'Check password' }),
    );
    await submit();
    expect(field('Email').value).toBe('owner@example.test');
    expect(field('Password').value).toBe('');
    expect(field('Password').type).toBe('password');
    if (mode === 'register') {
      expect(field('Confirm password').value).toBe('');
      expect(field('Display name (optional)').value).toBe('Owner');
    }
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('role')).toBe('alert'),
    );
    expect(push).not.toHaveBeenCalled();
  },
);
it.each(['login', 'register'] as const)(
  'sends exact secrets once, locks controls and clears successful %s',
  async (mode) => {
    mount(mode);
    let finish!: (value: unknown) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await submit();
    expect(field('Email').closest('fieldset')?.disabled).toBe(true);
    fireEvent.submit(field('Email').closest('form')!);
    expect(api).toHaveBeenCalledOnce();
    expect(api.mock.calls[0]![2]).toMatchObject({
      email: 'owner@example.test',
      password,
      ...(mode === 'register'
        ? { confirmation: password }
        : { returnTo: '/settings' }),
    });
    await act(async () => {
      finish({
        data:
          mode === 'register'
            ? { email: 'owner@example.test' }
            : { redirect: '/settings' },
      });
    });
    expect(field('Password').value).toBe('');
    expect(push).toHaveBeenCalledWith(
      mode === 'register'
        ? '/login?registered=1&email=owner%40example.test'
        : '/settings',
    );
  },
);
it('clears pagehide/unmounted secret fields and ignores a late navigation result', async () => {
  const rendered = mount();
  const input = field('Password');
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(input.value).toBe('');
  fireEvent.change(input, { target: { value: password } });
  let finish!: (value: unknown) => void;
  api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await submit();
  rendered.unmount();
  expect(input.value).toBe('');
  await act(async () => {
    finish({ data: { redirect: '/dashboard' } });
  });
  expect(push).not.toHaveBeenCalled();
});
it('shows the password-change login notice without a password value', () => {
  render(createElement(AuthForm, { mode: 'login', passwordChanged: true }));
  expect(screen.getByRole('status').textContent).toContain(
    'All previous sessions were signed out',
  );
  expect(field('Password').value).toBe('');
});
it('shows the server-provided temporary retry delay and clears the failed login password', async () => {
  mount();
  api.mockRejectedValueOnce(
    new RequestError('Too many attempts.', 429, {}, undefined, 900),
  );
  await submit();
  expect(
    screen.getByText(
      'Wait about 900 seconds from this attempt before trying again.',
    ),
  ).toBeTruthy();
  expect(field('Password').value).toBe('');
  expect(field('Email').value).toBe('owner@example.test');
});
