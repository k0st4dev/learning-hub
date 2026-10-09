'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Streamed guide content may appear after the browser's initial hash lookup. */
export function HandbookFragmentFocus({
  anchors,
}: {
  anchors: readonly string[];
}) {
  const pathname = usePathname();
  const anchorKey = JSON.stringify(anchors);
  useEffect(() => {
    let anchor: string;
    try {
      anchor = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const knownAnchors: string[] = JSON.parse(anchorKey);
    if (!knownAnchors.includes(anchor)) return;
    const target = document.getElementById(anchor);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }, [pathname, anchorKey]);
  return null;
}
