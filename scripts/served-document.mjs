import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
export function servedDocument(
  html,
  counters = { segments: 0, boundaries: 0 },
) {
  const document = new JSDOM(html).window.document;
  // React streams large lists into S:/P: segments. Reproduce only its literal
  // $RS insertion operation; never execute scripts or load external assets.
  // Operation verified against the installed React server renderer.
  for (const script of document.querySelectorAll('script')) {
    for (const [, segmentId, placeholderId] of script.textContent.matchAll(
      /\$RS\("(S:[0-9a-f]+)","(P:[0-9a-f]+)"\)/g,
    )) {
      const segment = document.getElementById(segmentId);
      const placeholder = document.getElementById(placeholderId);
      assert.ok(
        segment?.hidden && placeholder?.parentNode,
        'Missing deferred detail segment',
      );
      segment.remove();
      while (segment.firstChild)
        placeholder.parentNode.insertBefore(segment.firstChild, placeholder);
      placeholder.remove();
      counters.segments++;
    }
  }
  // Complete literal $RC suspense boundaries after synchronous $RS insertions,
  // matching the installed renderer's queued $RV operation without evaluating JS.
  for (const script of document.querySelectorAll('script')) {
    for (const [, placeholderId, segmentId] of script.textContent.matchAll(
      /\$RC\("(B:[0-9a-f]+)","(S:[0-9a-f]+)"\)/g,
    )) {
      const segment = document.getElementById(segmentId);
      const placeholder = document.getElementById(placeholderId);
      assert.ok(segment?.hidden, 'Missing deferred boundary content');
      if (!placeholder) {
        segment.remove();
        continue;
      }
      const parent = placeholder.parentNode;
      const start = placeholder.previousSibling;
      assert.equal(start?.nodeType, 8);
      let current = placeholder;
      let depth = 0;
      while (current) {
        if (current.nodeType === 8) {
          if (['/$', '/&'].includes(current.data)) {
            if (!depth) break;
            depth--;
          } else if (['$', '$?', '$~', '$!', '&'].includes(current.data))
            depth++;
        }
        const next = current.nextSibling;
        current.remove();
        current = next;
      }
      assert.ok(current, 'Missing deferred boundary end');
      segment.remove();
      while (segment.firstChild)
        parent.insertBefore(segment.firstChild, current);
      start.data = '$';
      counters.boundaries++;
    }
  }
  return document;
}
