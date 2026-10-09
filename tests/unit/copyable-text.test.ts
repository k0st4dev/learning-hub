// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { CopyableText } from '../../src/components/copyable-text';

const text =
  '# Problem\n\n## Šta sam naučio\n<script>unsafe()</script>\nTime: O(?)\n';
const props = { id: 'template', label: 'Original Markdown', text };
const previousClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard',
);
function clipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
}
afterEach(() => {
  cleanup();
  if (previousClipboard)
    Object.defineProperty(navigator, 'clipboard', previousClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('copyable source text', () => {
  it('keeps independent pending, failure and copy states for multiple plain-text prompts', async () => {
    let rejectFirst!: (error: Error) => void;
    const writeText = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValue(undefined);
    clipboard({ writeText });
    const firstText = 'Socratic: “Učim [tema].”\n';
    const secondText =
      'Reviewer: “Ne prepisuj kod; <script>escaped()</script>.”';
    render(
      createElement(
        'div',
        null,
        createElement(CopyableText, {
          id: 'first',
          label: 'First prompt',
          text: firstText,
          format: 'plain-text',
        }),
        createElement(CopyableText, {
          id: 'second',
          label: 'Second prompt',
          text: secondText,
          format: 'plain-text',
        }),
      ),
    );
    const first = within(screen.getByRole('group', { name: 'First prompt' }));
    const second = within(screen.getByRole('group', { name: 'Second prompt' }));
    const field = second.getByRole('textbox') as HTMLTextAreaElement;
    expect(field.wrap).toBe('soft');
    expect(field.rows).toBe(4);
    expect(field.value).toBe(secondText);
    expect(document.querySelector('script')).toBeNull();
    fireEvent.click(first.getByRole('button', { name: 'Copy template' }));
    await act(async () => {
      fireEvent.click(second.getByRole('button', { name: 'Copy template' }));
    });
    expect(first.getByRole('status').textContent).toBe('Copying…');
    expect(second.getByRole('status').textContent).toBe('Template copied.');
    expect(writeText.mock.calls).toEqual([[firstText], [secondText]]);
    await act(async () => {
      rejectFirst(new Error('Permission denied'));
    });
    expect(first.getByRole('status').textContent).toContain(
      'Automatic copy failed.',
    );
    expect(second.getByRole('status').textContent).toBe('Template copied.');
    fireEvent.click(first.getByRole('button', { name: 'Select template' }));
    expect(document.activeElement).toBe(first.getByRole('textbox'));
    expect(
      (first.getByRole('textbox') as HTMLTextAreaElement).selectionEnd,
    ).toBe(firstText.length);
    expect(second.getByRole('status').textContent).toBe('Template copied.');
  });
  it('keeps exact selectable read-only text and escaped server fallback before JavaScript', () => {
    const html = renderToString(createElement(CopyableText, props));
    expect(html).not.toContain('<script>unsafe()');
    const host = document.createElement('div');
    host.innerHTML = html;
    expect(host.querySelector('textarea')!.value).toBe(text);
    render(createElement(CopyableText, props));
    const field = screen.getByRole('textbox', {
      name: props.label,
    }) as HTMLTextAreaElement;
    expect(field.readOnly).toBe(true);
    expect(field.wrap).toBe('off');
    expect(field.getAttribute('aria-describedby')).toBe('template-help');
    expect(screen.getByRole('status').textContent).toBe('Ready to copy.');
    expect(document.querySelector('script')).toBeNull();
  });

  it('announces success only after clipboard acknowledgement and prevents duplicate pending writes', async () => {
    let acknowledge!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
    );
    clipboard({ writeText });
    render(createElement(CopyableText, props));
    const copy = screen.getByRole('button', {
      name: 'Copy template',
    }) as HTMLButtonElement;
    fireEvent.click(copy);
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(text);
    expect(copy.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Copying…');
    fireEvent.click(screen.getByRole('button', { name: 'Select template' }));
    expect(screen.getByRole('status').textContent).toBe('Copying…');
    await act(async () => {
      acknowledge();
    });
    expect(screen.getByRole('status').textContent).toBe('Template copied.');
    expect(copy.disabled).toBe(false);
  });

  it('preserves source text and selectable keyboard fallback after rejection, then retries', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error('Permission denied'))
      .mockResolvedValue(undefined);
    clipboard({ writeText });
    render(createElement(CopyableText, props));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy template' }));
    });
    expect(screen.getByRole('status').textContent).toContain(
      'Automatic copy failed.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select template' }));
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(text.length);
    expect(field.value).toBe(text);
    expect(screen.getByRole('status').textContent).toContain(
      'Press Ctrl+C or Command+C',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy template' }));
    });
    expect(writeText).toHaveBeenNthCalledWith(2, text);
    expect(screen.getByRole('status').textContent).toBe('Template copied.');
  });

  it.each([undefined, {}])(
    'exposes manual fallback when clipboard support is unavailable: %s',
    async (value) => {
      clipboard(value);
      render(createElement(CopyableText, props));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy template' }));
      });
      expect(screen.getByRole('status').textContent).toContain(
        'Automatic copy failed.',
      );
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        text,
      );
      expect(
        (
          screen.getByRole('button', {
            name: 'Copy template',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    },
  );
});
