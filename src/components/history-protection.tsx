'use client';
import { useEffect } from 'react';
import { installHistoryProtection } from '@/lib/history-protection';
let installed = false;
export function HistoryProtection() {
  useEffect(() => {
    // Root-level, document-lifetime tracking, including clean pages before an
    // editor is reached. Strict Mode must not install nested history wrappers.
    if (!installed) {
      installHistoryProtection();
      installed = true;
    }
  }, []);
  return null;
}
