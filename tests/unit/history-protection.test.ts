// @vitest-environment jsdom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { installHistoryProtection } from '../../src/lib/history-protection';

let dispose: () => void;
let request: Mock<() => boolean>;
let router: Mock<(event: PopStateEvent) => void>;
let go: ReturnType<typeof vi.spyOn>;
let leave: (event: Event) => void;
let deferredLeave: ((event: Event) => void) | undefined;
const originalReplace = history.replaceState.bind(history);
function arrive(url: string, state: unknown) {
  originalReplace(state, '', url);
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}
function entries() {
  const first = history.state;
  history.pushState({ __NA: true, tree: 'exercise' }, '', '/exercise');
  const exercise = history.state;
  history.pushState({ __NA: true, tree: 'progress' }, '', '/progress');
  const progress = history.state;
  return { first, exercise, progress };
}
beforeEach(() => {
  deferredLeave = undefined;
  originalReplace({ __NA: true, tree: 'dashboard' }, '', '/dashboard');
  request = vi.fn(() => false);
  leave = (event) => {
    if (!request()) event.preventDefault();
  };
  document.addEventListener('learning:before-leave', leave);
  dispose = installHistoryProtection();
  // Mimic Next's bubble listener. A canceled traversal must never reach it.
  router = vi.fn();
  window.addEventListener('popstate', router);
  go = vi.spyOn(history, 'go').mockImplementation(() => {});
});
afterEach(() => {
  if (deferredLeave)
    document.removeEventListener('learning:before-leave', deferredLeave);
  dispose();
  document.removeEventListener('learning:before-leave', leave);
  window.removeEventListener('popstate', router);
  vi.restoreAllMocks();
});
describe('document-lifetime history protection', () => {
  it('restores Back while awaiting a note flush, then replays only the approved traversal without asking twice', async () => {
    request.mockReturnValue(true);
    let complete!: (allowed: boolean) => void;
    deferredLeave = (event) => {
      (event as CustomEvent).detail.defer(
        () =>
          new Promise<boolean>((resolve) => {
            complete = resolve;
          }),
      );
    };
    document.addEventListener('learning:before-leave', deferredLeave);
    const { exercise, progress } = entries();
    arrive('/exercise', exercise);
    expect(router).not.toHaveBeenCalled();
    expect(go).toHaveBeenLastCalledWith(1);
    complete(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(go).toHaveBeenCalledTimes(1);
    arrive('/progress', progress);
    expect(go).toHaveBeenLastCalledWith(-1);
    arrive('/exercise', exercise);
    expect(router).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
  });
  it('keeps the editor mounted and Forward intact when an asynchronous note flush is canceled', async () => {
    request.mockReturnValue(true);
    let complete!: (allowed: boolean) => void;
    deferredLeave = (event) => {
      (event as CustomEvent).detail.defer(
        () =>
          new Promise<boolean>((resolve) => {
            complete = resolve;
          }),
      );
    };
    document.addEventListener('learning:before-leave', deferredLeave);
    const { exercise, progress } = entries();
    arrive('/exercise', exercise);
    arrive('/progress', progress);
    complete(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledTimes(1);
    document.removeEventListener('learning:before-leave', deferredLeave);
    arrive('/exercise', exercise);
    expect(router).toHaveBeenCalledOnce();
  });
  it('uses one leave event for links, waits for successful notes and ignores same-page/new-tab links', async () => {
    dispose();
    const navigate = vi.fn();
    dispose = installHistoryProtection(navigate);
    request.mockReturnValue(true);
    let complete!: (allowed: boolean) => void;
    deferredLeave = (event) => {
      (event as CustomEvent).detail.defer(
        () =>
          new Promise<boolean>((resolve) => {
            complete = resolve;
          }),
      );
    };
    document.addEventListener('learning:before-leave', deferredLeave);
    const anchor = document.createElement('a');
    anchor.href = '/exercise';
    document.body.append(anchor);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    complete(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(navigate).toHaveBeenCalledWith(anchor.href);
    expect(request).toHaveBeenCalledOnce();
    anchor.target = '_blank';
    anchor.addEventListener('click', (event) => event.preventDefault());
    anchor.click();
    anchor.target = '';
    anchor.href = location.pathname + '#notes';
    anchor.click();
    expect(request).toHaveBeenCalledOnce();
    anchor.remove();
  });
  it('keeps router state and history length; adds no sentinel or draft storage', () => {
    const length = history.length;
    expect(history.state).toMatchObject({ __NA: true, tree: 'dashboard' });
    expect(Object.keys(history.state)).toEqual([
      '__NA',
      'tree',
      '__learningHistory',
    ]);
    history.replaceState(
      { __NA: true, tree: 'refreshed' },
      '',
      '/dashboard?filter=all',
    );
    expect(history.length).toBe(length);
    expect(history.state.tree).toBe('refreshed');
    expect(history.state.__learningHistory.index).toBe(0);
    expect(request).not.toHaveBeenCalled();
  });
  it('cancels Back, restores the actual prior position and keeps Forward available without a second prompt', () => {
    const { exercise, progress } = entries();
    arrive('/exercise', exercise);
    expect(request).toHaveBeenCalledTimes(1);
    expect(router).not.toHaveBeenCalled();
    expect(go).toHaveBeenLastCalledWith(1);
    arrive('/progress', progress);
    expect(request).toHaveBeenCalledTimes(1);
    expect(router).not.toHaveBeenCalled();
    request.mockReturnValue(true);
    arrive('/exercise', exercise);
    expect(router).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('cancels Forward and restores using a negative delta', () => {
    const { exercise, progress } = entries();
    request.mockReturnValue(true);
    arrive('/exercise', exercise);
    request.mockReturnValue(false);
    router.mockClear();
    arrive('/progress', progress);
    expect(router).not.toHaveBeenCalled();
    expect(go).toHaveBeenLastCalledWith(-1);
    arrive('/exercise', exercise);
    expect(router).not.toHaveBeenCalled();
  });
  it('restores multi-entry jumps and absorbs an extra traversal during cancellation', () => {
    const { first, exercise, progress } = entries();
    arrive('/dashboard', first);
    expect(go).toHaveBeenLastCalledWith(2);
    arrive('/exercise', exercise);
    expect(go).toHaveBeenLastCalledWith(1);
    expect(request).toHaveBeenCalledTimes(1);
    arrive('/progress', progress);
    expect(router).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('allows hash/section traversals without losing the next route boundary', () => {
    const first = history.state;
    history.pushState(
      { __NA: true, tree: 'dashboard' },
      '',
      '/dashboard#section',
    );
    const section = history.state;
    arrive('/dashboard', first);
    arrive('/dashboard#section', section);
    expect(request).not.toHaveBeenCalled();
    history.pushState({ __NA: true }, '', '/exercise');
    arrive('/dashboard#section', section);
    expect(request).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenLastCalledWith(1);
  });
  it('stamps native fragment entries while preserving the same-page router tree', () => {
    arrive('/dashboard#main', null);
    expect(request).not.toHaveBeenCalled();
    expect(history.state).toMatchObject({
      __NA: true,
      tree: 'dashboard',
      __learningHistory: { index: 1 },
    });
    const native = history.state;
    history.pushState({ __NA: true }, '', '/exercise');
    arrive('/dashboard#main', native);
    expect(go).toHaveBeenLastCalledWith(1);
  });
  it('lets clean pages traverse normally and distinguishes search changes from section changes', () => {
    const first = history.state;
    history.pushState({ __NA: true }, '', '/dashboard?filter=all');
    request.mockReturnValue(true);
    arrive('/dashboard', first);
    expect(router).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
  });
  it('does not invent a traversal delta for entries belonging to another document', () => {
    arrive('/older-document', {
      __NA: true,
      __learningHistory: { documentId: 'old-document', index: 1 },
    });
    expect(request).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
    expect(router).toHaveBeenCalledTimes(1);
  });
});
