// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { DailyHandbookHelp } from '../../src/components/daily-handbook-help';
import { installHistoryProtection } from '../../src/lib/history-protection';

const model = {
  links: [
    {
      key: 'guide-appendix-e' as const,
      href: '/course/software-engineer/guide/appendix-e',
      title: 'Appendix E — šta radiš kada zapneš',
    },
  ],
  unavailable: false,
};
let dispose: (() => void) | undefined;
let leave: ((event: Event) => void) | undefined;
afterEach(() => {
  cleanup();
  dispose?.();
  if (leave) document.removeEventListener('learning:before-leave', leave);
  dispose = undefined;
  leave = undefined;
});

it('is a closed native disclosure with source labels and no learning controls', () => {
  const view = render(createElement(DailyHandbookHelp, model));
  const panel = view.container.querySelector('details')!;
  expect(panel.open).toBe(false);
  expect(panel.querySelector('summary')!.textContent).toBe(
    'Handbook help (optional)',
  );
  const link = panel.querySelector('a')!;
  expect(link.textContent).toBe(model.links[0]!.title);
  expect(link.lang).toBe('sr-Latn');
  expect(link.getAttribute('href')).toBe(model.links[0]!.href);
  expect(link.target).toBe('');
  expect(panel.textContent).toContain(
    'Daily AI restrictions and completion criteria still apply.',
  );
  expect(
    panel.querySelector('form, input, button, [data-study-anchor]'),
  ).toBeNull();
  view.rerender(
    createElement(DailyHandbookHelp, { links: [], unavailable: true }),
  );
  expect(panel.querySelector('nav')).toBeNull();
  expect(panel.textContent).toContain(
    'Some handbook shortcuts are unavailable',
  );
});

it('uses the existing unsaved-exercise cancellation instead of bypassing it', () => {
  const navigate = vi.fn();
  dispose = installHistoryProtection(navigate);
  leave = (event) => event.preventDefault();
  document.addEventListener('learning:before-leave', leave);
  const view = render(createElement(DailyHandbookHelp, model));
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  view.container.querySelector('a')!.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  expect(navigate).not.toHaveBeenCalled();
  expect(view.container.querySelector('details')).not.toBeNull();
});

it.each([false, true])(
  'waits for deferred note protection before navigating: allowed=%s',
  async (allowed) => {
    const navigate = vi.fn();
    dispose = installHistoryProtection(navigate);
    let complete!: (result: boolean) => void;
    leave = (event) => {
      (event as CustomEvent).detail.defer(
        () =>
          new Promise<boolean>((resolve) => {
            complete = resolve;
          }),
      );
    };
    document.addEventListener('learning:before-leave', leave);
    const view = render(createElement(DailyHandbookHelp, model));
    const draft = document.createElement('textarea');
    draft.value = 'Unconfirmed student draft';
    view.container.append(draft);
    fireEvent.click(view.container.querySelector('a')!);
    expect(navigate).not.toHaveBeenCalled();
    expect(draft.value).toBe('Unconfirmed student draft');
    complete(allowed);
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (allowed)
      expect(navigate).toHaveBeenCalledWith(
        new URL(model.links[0]!.href, location.href).href,
      );
    else expect(navigate).not.toHaveBeenCalled();
    expect(draft.value).toBe('Unconfirmed student draft');
  },
);
