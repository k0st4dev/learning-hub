// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { createElement } from 'react';
import { StudentNavigation } from '../../src/components/student-navigation';
const state = vi.hoisted(() => ({ path: '/dashboard' }));
vi.mock('next/navigation', () => ({
  usePathname: () => state.path,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
let wide = false;
let resize: (() => void) | undefined;
beforeEach(() => {
  state.path = '/dashboard';
  wide = false;
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return wide;
    },
    addEventListener: (_: string, callback: () => void) => {
      resize = callback;
    },
    removeEventListener: vi.fn(),
  }));
  // jsdom has no native modal implementation; real Tab containment is checked in browser.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      if (this.open) {
        this.open = false;
        this.dispatchEvent(new Event('close'));
      }
    },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const menu = () => screen.getByRole('button', { name: 'Menu', exact: true });
const dialog = () => screen.getByRole('dialog', { name: 'Student navigation' });
describe('mobile student navigation', () => {
  it('wraps keyboard focus at both ends of the modal', () => {
    render(
      createElement(StudentNavigation, { name: 'Student', fullCourse: true }),
    );
    fireEvent.click(menu());
    const first = within(dialog()).getByRole('button', { name: 'Close menu' });
    const last = within(dialog()).getByRole('button', { name: 'Sign out' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
  it('uses the desktop destinations and current-page marker inside the drawer', () => {
    render(
      createElement(StudentNavigation, { name: 'Student', fullCourse: true }),
    );
    const desktop = within(
      screen.getByRole('navigation', { name: 'Student', exact: true }),
    )
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    fireEvent.click(menu());
    const mobile = within(dialog()).getByRole('navigation');
    expect(
      within(mobile)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(desktop);
    expect(
      within(mobile)
        .getByRole('link', { name: 'Dashboard' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });
  it('restores focus and scrolling after explicit close or Escape cancellation', () => {
    render(
      createElement(StudentNavigation, { name: 'Student', fullCourse: true }),
    );
    document.body.style.overflow = 'auto';
    for (const cancel of [false, true]) {
      fireEvent.click(menu());
      expect(menu().getAttribute('aria-expanded')).toBe('true');
      expect(document.body.style.overflow).toBe('hidden');
      if (cancel)
        fireEvent(dialog(), new Event('cancel', { cancelable: true }));
      else
        fireEvent.click(
          within(dialog()).getByRole('button', { name: 'Close menu' }),
        );
      expect(menu().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(menu());
      expect(document.body.style.overflow).toBe('auto');
    }
    document.body.style.overflow = '';
  });
  it('closes after a navigation choice and on path changes', () => {
    const view = render(
      createElement(StudentNavigation, { name: 'Student', fullCourse: true }),
    );
    fireEvent.click(menu());
    const destination = within(dialog()).getByRole('link', {
      name: 'Dashboard',
    });
    destination.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(destination);
    expect(menu().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(menu());
    state.path = '/resources';
    view.rerender(
      createElement(StudentNavigation, { name: 'Student', fullCourse: true }),
    );
    expect(menu().getAttribute('aria-expanded')).toBe('false');
  });
  it('closes when resizing to desktop and unlocks scrolling on unmount', () => {
    const view = render(
      createElement(StudentNavigation, { name: 'Student', fullCourse: true }),
    );
    fireEvent.click(menu());
    wide = true;
    act(() => resize?.());
    expect(menu().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement?.getAttribute('href')).toBe('/dashboard');
    wide = false;
    fireEvent.click(menu());
    view.unmount();
    expect(document.body.style.overflow).toBe('');
  });
  it('links to the existing outline and keeps unsupported fixture resources out', () => {
    const view = render(
      createElement(StudentNavigation, { name: 'Student', fullCourse: true }),
    );
    fireEvent.click(menu());
    expect(
      within(dialog())
        .getByRole('link', { name: 'Course outline' })
        .getAttribute('href'),
    ).toBe('/course/software-engineer#course-outline');
    view.rerender(
      createElement(StudentNavigation, { name: 'Student', fullCourse: false }),
    );
    expect(
      within(dialog()).queryByRole('link', { name: 'Course outline' }),
    ).toBeNull();
    expect(
      within(dialog()).queryByRole('link', {
        name: 'Resources and original references',
      }),
    ).toBeNull();
  });
});
