'use client';
import { useEffect } from 'react';
import { installHistoryProtection } from '@/lib/history-protection';
import { useRouter } from 'next/navigation';
let installed = false;
export function HistoryProtection() {
  const router = useRouter();
  useEffect(() => {
    // Root-level, document-lifetime tracking, including clean pages before an
    // editor is reached. Strict Mode must not install nested history wrappers.
    if (!installed) {
      installHistoryProtection((url) => {
        const next = new URL(url, location.href);
        if (next.origin === location.origin)
          router.push(next.pathname + next.search + next.hash);
        else location.assign(url);
      });
      installed = true;
    }
  }, [router]);
  return null;
}
