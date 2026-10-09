// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { HandbookFragmentFocus } from '../../src/components/handbook-fragment-focus';

vi.mock('next/navigation', () => ({ usePathname: () => '/guide/ai-protocol' }));
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

it('focuses only the known streamed source target and does not replay focus on same-page rerenders', () => {
  window.history.replaceState(null, '', '/guide/ai-protocol#original-hints');
  const scroll = vi.fn();
  const page = () =>
    createElement(
      'div',
      null,
      createElement(
        'h2',
        {
          id: 'original-hints',
          tabIndex: -1,
          ref: (node: HTMLHeadingElement | null) => {
            if (node) node.scrollIntoView = scroll;
          },
        },
        'Hint ladder',
      ),
      createElement('input', { 'aria-label': 'Review input' }),
      createElement(HandbookFragmentFocus, { anchors: ['original-hints'] }),
    );
  const view = render(page());
  expect(document.activeElement).toBe(view.getByRole('heading'));
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: 'start' });
  view.getByRole('textbox').focus();
  view.rerender(page());
  expect(document.activeElement).toBe(view.getByRole('textbox'));
  expect(scroll).toHaveBeenCalledTimes(1);
});

it('ignores unknown, missing and malformed fragments without focusing another element', () => {
  for (const fragment of ['#private-field', '#missing-source', '#%E0%A4%A']) {
    window.history.replaceState(null, '', '/guide/ai-protocol' + fragment);
    const view = render(
      createElement(
        'div',
        null,
        createElement('input', {
          id: 'private-field',
          'aria-label': 'Private input',
        }),
        createElement(HandbookFragmentFocus, {
          anchors: ['original-hints', 'missing-source'],
        }),
      ),
    );
    expect(document.activeElement).not.toBe(view.getByRole('textbox'));
    view.unmount();
  }
});
