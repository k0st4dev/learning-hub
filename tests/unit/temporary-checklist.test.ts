// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  fireEvent,
  act,
  within,
} from '@testing-library/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TemporaryChecklist } from '../../src/components/temporary-checklist';

const location = vi.hoisted(() => ({ path: '/guide/b' }));
vi.mock('next/navigation', () => ({ usePathname: () => location.path }));
const props = {
  identity: 'student-a/release/b',
  title: 'Git review',
  help: 'Weekly and conditional guidance.',
  sourceHref: '#original',
  items: [
    { id: 'one', text: 'Proveri “git diff”.\n<script>escaped()</script>' },
    { id: 'two', text: 'Pročitaj README.' },
  ],
};
beforeEach(() => {
  location.path = '/guide/b';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('temporary advisory review', () => {
  it('keeps supporting source links and freely revisitable later checks available independently of marks', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const view = render(
      createElement(TemporaryChecklist, {
        ...props,
        links: [
          {
            href: '/course/software-engineer/guide/ai-protocol#original-hints',
            label: 'Original hint ladder',
          },
        ],
      }),
    );
    const guidance = within(
      view.getByRole('navigation', {
        name: 'Related troubleshooting guidance',
      }),
    );
    expect(
      guidance
        .getByRole('link', { name: 'Original hint ladder' })
        .getAttribute('href'),
    ).toBe('/course/software-engineer/guide/ai-protocol#original-hints');
    expect(view.queryByRole('textbox')).toBeNull();
    expect(view.container.querySelector('form')).toBeNull();
    expect(
      view
        .getAllByRole('checkbox')
        .every((box) => !(box as HTMLInputElement).disabled),
    ).toBe(true);
    fireEvent.click(view.getAllByRole('checkbox')[1]!);
    expect((view.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(
      false,
    );
    expect(view.getByRole('status').textContent).toBe(
      'Marks for this review: 1 / 2',
    );
    fireEvent.click(view.getAllByRole('checkbox')[1]!);
    expect(view.getByRole('status').textContent).toBe(
      'Marks for this review: 0 / 2',
    );
    expect(guidance.getByRole('link').getAttribute('href')).toBe(
      '/course/software-engineer/guide/ai-protocol#original-hints',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('reviews one optional concept and clears marks on every label edit without saving or claiming mastery', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const storageSpies = (
      ['getItem', 'setItem', 'removeItem', 'clear'] as const
    ).map((method) => vi.spyOn(Storage.prototype, method));
    const view = render(
      createElement(TemporaryChecklist, { ...props, conceptReview: true }),
    );
    const field = view.getByRole('textbox', {
      name: 'Current concept (optional)',
    }) as HTMLInputElement;
    expect(field.value).toBe('');
    expect(field.required).toBe(false);
    expect(field.maxLength).toBe(120);
    expect(field.autocomplete).toBe('off');
    fireEvent.change(field, {
      target: { value: 'Closures <script>example</script>' },
    });
    for (const box of view.getAllByRole('checkbox')) fireEvent.click(box);
    expect(view.getByRole('status').textContent).toBe(
      'Marks for this review: 2 / 2',
    );
    expect(view.container.querySelector('script')).toBeNull();
    view.rerender(
      createElement(TemporaryChecklist, { ...props, conceptReview: true }),
    );
    expect(field.value).toBe('Closures <script>example</script>');
    expect(view.getByRole('status').textContent).toBe(
      'Marks for this review: 2 / 2',
    );
    fireEvent.change(field, { target: { value: 'Promises' } });
    expect(view.getByRole('status').textContent).toBe(
      'Marks for this review: 0 / 2',
    );
    fireEvent.click(view.getAllByRole('checkbox')[0]!);
    fireEvent.click(view.getByRole('button', { name: 'Clear this review' }));
    expect(field.value).toBe('Promises');
    expect(view.getByRole('status').textContent).toBe(
      'Marks for this review: 0 / 2',
    );
    fireEvent.click(view.getAllByRole('checkbox')[0]!);
    fireEvent.change(field, { target: { value: '' } });
    expect(view.getByRole('status').textContent).toBe(
      'Marks for this review: 0 / 2',
    );
    for (const spy of [fetchSpy, ...storageSpies])
      expect(spy).not.toHaveBeenCalled();
  });

  it('isolates temporary concept labels as well as marks across accounts and browser page lifecycle', () => {
    const view = render(
      createElement(TemporaryChecklist, { ...props, conceptReview: true }),
    );
    const mark = () => {
      fireEvent.change(view.getByRole('textbox'), {
        target: { value: 'Closures' },
      });
      fireEvent.click(view.getAllByRole('checkbox')[0]!);
    };
    const empty = () => {
      expect((view.getByRole('textbox') as HTMLInputElement).value).toBe('');
      expect(view.getByRole('status').textContent).toBe(
        'Marks for this review: 0 / 2',
      );
    };
    for (const identity of ['student-b/release/c', 'student-b/new-release/c']) {
      mark();
      view.rerender(
        createElement(TemporaryChecklist, {
          ...props,
          conceptReview: true,
          identity,
        }),
      );
      empty();
    }
    for (const event of ['pagehide', 'pageshow']) {
      mark();
      act(() => {
        window.dispatchEvent(new Event(event));
      });
      empty();
    }
    mark();
    view.unmount();
    const fresh = render(
      createElement(TemporaryChecklist, { ...props, conceptReview: true }),
    );
    expect((fresh.getByRole('textbox') as HTMLInputElement).value).toBe('');
    expect(fresh.getByRole('status').textContent).toBe(
      'Marks for this review: 0 / 2',
    );
  });

  it('renders exact escaped labels, unchecked controls and a temporary-state notice before hydration', () => {
    const host = new DOMParser().parseFromString(
      renderToStaticMarkup(createElement(TemporaryChecklist, props)),
      'text/html',
    );
    expect(host.querySelectorAll('script')).toHaveLength(0);
    expect(host.querySelector('label span')!.textContent).toBe(
      props.items[0]!.text,
    );
    expect(host.querySelectorAll('input:checked')).toHaveLength(0);
    expect(
      host.querySelector('fieldset')!.getAttribute('aria-describedby'),
    ).toBeTruthy();
    expect(host.body.textContent).toContain(
      'Marks reset when you leave or reload.',
    );
    expect(host.querySelector('[role="status"]')!.textContent).toBe(
      'Marks for this review: 0 / 2',
    );
  });

  it('keeps independent marks, toggles and clear actions without network or browser storage', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const reads = vi.spyOn(Storage.prototype, 'getItem');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const removes = vi.spyOn(Storage.prototype, 'removeItem');
    const clears = vi.spyOn(Storage.prototype, 'clear');
    const view = render(
      createElement(
        'div',
        null,
        createElement(TemporaryChecklist, props),
        createElement(TemporaryChecklist, {
          ...props,
          identity: 'student-b/release/b',
          title: 'Other review',
        }),
      ),
    );
    const first = within(view.getByRole('region', { name: 'Git review' }));
    const other = within(view.getByRole('region', { name: 'Other review' }));
    fireEvent.click(first.getAllByRole('checkbox')[0]!);
    expect(first.getByRole('status').textContent).toBe(
      'Marks for this review: 1 / 2',
    );
    expect(
      other
        .getAllByRole('checkbox')
        .every((box) => !(box as HTMLInputElement).checked),
    ).toBe(true);
    fireEvent.click(first.getAllByRole('checkbox')[1]!);
    fireEvent.click(first.getAllByRole('checkbox')[0]!);
    expect(first.getByRole('status').textContent).toBe(
      'Marks for this review: 1 / 2',
    );
    fireEvent.click(other.getAllByRole('checkbox')[0]!);
    fireEvent.click(first.getByRole('button', { name: 'Clear this review' }));
    expect(first.getByRole('status').textContent).toBe(
      'Marks for this review: 0 / 2',
    );
    expect(other.getByRole('status').textContent).toBe(
      'Marks for this review: 1 / 2',
    );
    const ids = Array.from(view.container.querySelectorAll('[id]')).map(
      (node) => node.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const spy of [fetchSpy, reads, writes, removes, clears])
      expect(spy).not.toHaveBeenCalled();
  });

  it('resets on rendered account/release/guide and route changes while same-page rerenders retain marks', () => {
    const view = render(createElement(TemporaryChecklist, props));
    for (const identity of [
      'student-b/release/b',
      'student-b/new-release/b',
      'student-b/new-release/c',
    ]) {
      fireEvent.click(view.getAllByRole('checkbox')[0]!);
      view.rerender(createElement(TemporaryChecklist, { ...props, identity }));
      expect(
        view
          .getAllByRole('checkbox')
          .every((box) => !(box as HTMLInputElement).checked),
      ).toBe(true);
    }
    fireEvent.click(view.getAllByRole('checkbox')[0]!);
    view.rerender(
      createElement(TemporaryChecklist, {
        ...props,
        identity: 'student-b/new-release/c',
      }),
    );
    expect((view.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(
      true,
    );
    location.path = '/dashboard';
    view.rerender(
      createElement(TemporaryChecklist, {
        ...props,
        identity: 'student-b/new-release/c',
      }),
    );
    location.path = '/guide/b';
    view.rerender(createElement(TemporaryChecklist, props));
    expect(
      view
        .getAllByRole('checkbox')
        .every((box) => !(box as HTMLInputElement).checked),
    ).toBe(true);
  });

  it('clears browser page lifecycle state and starts empty after unmount/remount', () => {
    let view = render(createElement(TemporaryChecklist, props));
    for (const event of ['pagehide', 'pageshow']) {
      fireEvent.click(view.getAllByRole('checkbox')[0]!);
      act(() => {
        window.dispatchEvent(new Event(event));
      });
      expect(view.getByRole('status').textContent).toBe(
        'Marks for this review: 0 / 2',
      );
    }
    fireEvent.click(view.getAllByRole('checkbox')[0]!);
    view.unmount();
    view = render(createElement(TemporaryChecklist, props));
    expect(view.getByRole('status').textContent).toBe(
      'Marks for this review: 0 / 2',
    );
  });
});
