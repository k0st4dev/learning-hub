'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { StudyContext } from '@/domain/study-context';

export function useSectionResume({
  itemId,
  context,
  completed,
  enabled,
  locked,
  save,
}: {
  itemId: string;
  context?: StudyContext;
  completed: boolean;
  enabled: boolean;
  locked: boolean;
  save: (anchor: string) => Promise<unknown> | undefined;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queued = useRef<string | null>(null);
  const current = useRef<string | null>(null);
  const restored = useRef(false);
  const hasContext = !!context;
  const latest = useRef({ context, completed, enabled, locked, save });
  useEffect(() => {
    latest.current = { context, completed, enabled, locked, save };
  });
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queued.current = null;
  }, []);
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const state = latest.current;
    if (
      !state.enabled ||
      state.completed ||
      state.context?.activeItemId !== itemId
    ) {
      queued.current = null;
      return;
    }
    if (state.locked || !queued.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      const state = latest.current;
      const anchor = queued.current;
      if (
        !anchor ||
        state.locked ||
        state.completed ||
        state.context?.activeItemId !== itemId
      )
        return;
      queued.current = null;
      if (anchor !== state.context.resumeAnchor) void state.save(anchor);
    }, 1000);
  }, [itemId]);
  useEffect(() => {
    schedule();
  }, [context, completed, enabled, locked, schedule]);
  useEffect(() => {
    const context = latest.current.context;
    if (!enabled || !context) return;
    const root = [
      ...document.querySelectorAll<HTMLElement>('[data-learning-unit]'),
    ].find((element) => element.dataset.learningUnit === itemId);
    if (!root) return;
    const elements = () =>
      [...root.querySelectorAll<HTMLElement>('[data-study-anchor]')].filter(
        (element) =>
          latest.current.context?.anchors.includes(
            element.dataset.studyAnchor!,
          ),
      );
    const locate = (anchor: string) =>
      elements().find(
        (element) =>
          element.dataset.studyAnchor === anchor && element.id === anchor,
      );
    const observe = (element?: HTMLElement) => {
      const anchor = element?.dataset.studyAnchor;
      if (!anchor || anchor === current.current) return;
      current.current = anchor;
      queued.current = anchor;
      schedule();
    };
    const moveToHash = () => {
      let anchor: string;
      try {
        anchor = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      const element = locate(anchor);
      if (element) {
        element.scrollIntoView({ block: 'start', behavior: 'instant' });
        element.focus({ preventScroll: true });
        observe(element);
      }
    };
    if (!restored.current) {
      restored.current = true;
      const anchor =
        window.location.hash.slice(1) ||
        (context.activeItemId === itemId ? context.resumeAnchor : null);
      const element = anchor ? locate(anchor) : undefined;
      if (element) {
        current.current = anchor;
        if (anchor !== context.resumeAnchor) {
          queued.current = anchor;
          schedule();
        }
        element.scrollIntoView({ block: 'start', behavior: 'instant' });
        element.focus({ preventScroll: true });
      }
    }
    let frame: number | null = null;
    const scroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const focused = document.activeElement?.closest<HTMLElement>(
          '[data-study-anchor]',
        );
        if (
          focused &&
          root.contains(focused) &&
          latest.current.context?.anchors.includes(focused.dataset.studyAnchor!)
        ) {
          const top = focused.getBoundingClientRect().top;
          // The last section may not fit at the top because the page has ended.
          if (top >= 0 && top < window.innerHeight) {
            observe(focused);
            return;
          }
        }
        const sections = elements();
        const atTop = sections.filter(
          (element) => element.getBoundingClientRect().top <= 120,
        );
        // No section is selected while the learner is still above the content.
        observe(atTop.at(-1));
      });
    };
    const focus = (event: FocusEvent) => {
      const element =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-study-anchor]')
          : null;
      if (
        element &&
        root.contains(element) &&
        latest.current.context?.anchors.includes(element.dataset.studyAnchor!)
      )
        observe(element);
    };
    const click = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || link.target === '_blank') return;
      const url = new URL(link.href, window.location.href);
      if (url.pathname !== location.pathname || url.search !== location.search)
        return;
      let key: string;
      try {
        key = decodeURIComponent(url.hash.slice(1));
      } catch {
        return;
      }
      const element = locate(key);
      if (element) {
        element.focus({ preventScroll: true });
        observe(element);
      }
    };
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    window.addEventListener('hashchange', moveToHash);
    root.addEventListener('focusin', focus);
    root.addEventListener('click', click);
    return () => {
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', scroll);
      window.removeEventListener('hashchange', moveToHash);
      root.removeEventListener('focusin', focus);
      root.removeEventListener('click', click);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [enabled, hasContext, itemId, schedule]);
  useEffect(() => cancel, [cancel]);
  return { cancel, current: () => current.current };
}
