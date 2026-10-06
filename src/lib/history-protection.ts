const marker = '__learningHistory';
type Position = { documentId: string; index: number };
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function position(value: unknown, documentId: string): Position | null {
  const found = record(value) ? value[marker] : undefined;
  return record(found) &&
    found.documentId === documentId &&
    Number.isSafeInteger(found.index)
    ? { documentId, index: found.index as number }
    : null;
}
function samePage(first: string, second: string) {
  const a = new URL(first);
  const b = new URL(second);
  return (
    a.origin === b.origin && a.pathname === b.pathname && a.search === b.search
  );
}
/** Metadata only: never put student work in history or browser storage. */
export function installHistoryProtection() {
  const history = window.history;
  const push = history.pushState;
  const replace = history.replaceState;
  const documentId = crypto.randomUUID();
  let current = { index: 0, url: location.href };
  let restoring = false;
  let currentState: unknown = history.state;
  const stamp = (data: unknown, index: number) => ({
    ...(record(data) ? data : {}),
    [marker]: { documentId, index },
  });
  // Preserve all of Next's router state; no extra sentinel history entry.
  replace.call(history, stamp(currentState, 0), '', location.href);
  const trackedPush: History['pushState'] = (data: unknown, unused, url) => {
    const index = current.index + 1;
    push.call(history, stamp(data, index), unused, url);
    current = { index, url: location.href };
    currentState = history.state;
  };
  const trackedReplace: History['replaceState'] = (
    data: unknown,
    unused,
    url,
  ) => {
    replace.call(history, stamp(data, current.index), unused, url);
    current.url = location.href;
    currentState = history.state;
  };
  history.pushState = trackedPush;
  history.replaceState = trackedReplace;
  const traverse = (event: PopStateEvent) => {
    const target = position(event.state, documentId);
    const url = location.href;
    if (restoring && target) {
      event.stopImmediatePropagation();
      if (target.index === current.index) restoring = false;
      else history.go(current.index - target.index);
      return;
    }
    if (samePage(current.url, url)) {
      // Native fragment entries bypass pushState and may have a null state.
      current = { index: target?.index ?? current.index + 1, url };
      currentState = stamp(
        record(event.state) ? event.state : currentState,
        current.index,
      );
      if (!target) replace.call(history, currentState, '', url);
      return;
    }
    // Other documents use the existing native beforeunload warning. Every
    // same-document route created since mount has an owned position marker.
    if (!target) return;
    const allowed = document.dispatchEvent(
      new Event('learning:before-leave', { cancelable: true }),
    );
    if (!allowed) {
      event.stopImmediatePropagation();
      restoring = true;
      history.go(current.index - target.index);
      return;
    }
    current = { index: target.index, url };
    currentState = event.state;
  };
  // Capture precedes Next's bubbling popstate handler, so cancellation keeps
  // the current editor mounted while the real history position is restored.
  window.addEventListener('popstate', traverse, true);
  return () => {
    window.removeEventListener('popstate', traverse, true);
    if (history.pushState === trackedPush) history.pushState = push;
    if (history.replaceState === trackedReplace) history.replaceState = replace;
  };
}
