// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { CourseState } from '../../src/components/course-state';
import { WorkspaceLoading } from '../../src/components/workspace-loading';
afterEach(cleanup);
describe('accessible route recovery', () => {
  it.each(['missing', 'setup', 'unpublished', 'unavailable'] as const)(
    'shows safe recovery for %s',
    (issue) => {
      const retry = vi.fn();
      render(createElement(CourseState, { issue, retry }));
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(
        screen
          .getByRole('link', { name: 'Back to course' })
          .getAttribute('href'),
      ).toBe('/course/software-engineer');
      expect(
        screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href'),
      ).toBe('/dashboard');
      if (issue === 'missing') expect(screen.queryByRole('button')).toBeNull();
      else {
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(retry).toHaveBeenCalledOnce();
      }
      expect(document.body.textContent).not.toMatch(
        /SQL|password_hash|stack trace/,
      );
    },
  );
  it('announces loading without fake content or progress', () => {
    render(createElement(WorkspaceLoading));
    expect(screen.getByRole('status').textContent).toBe(
      'Loading your local workspace…',
    );
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(
      document
        .querySelector('.workspace-skeleton')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(document.body.textContent).not.toMatch(/%|Completed|Day 1/);
  });
});
