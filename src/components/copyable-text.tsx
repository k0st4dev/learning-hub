'use client';

import { useRef, useState } from 'react';
import { en } from '@/i18n/en';

export function CopyableText({
  id,
  label,
  text,
}: {
  id: string;
  label: string;
  text: string;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const pending = useRef(false);
  const [status, setStatus] = useState<
    'idle' | 'pending' | 'copied' | 'failed' | 'selected'
  >('idle');

  async function copy() {
    if (pending.current) return;
    pending.current = true;
    setStatus('pending');
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    } finally {
      pending.current = false;
    }
  }

  return (
    <div className="copyable-text stack">
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <p id={id + '-help'} className="muted">
          {en.handbook.manualCopy}
        </p>
        <textarea
          ref={field}
          id={id}
          value={text}
          readOnly
          wrap="off"
          rows={16}
          lang="sr-Latn"
          spellCheck={false}
          aria-describedby={id + '-help'}
        />
      </div>
      <div className="actions">
        <button
          type="button"
          onClick={() => void copy()}
          disabled={status === 'pending'}
        >
          {status === 'pending' ? en.handbook.copying : en.handbook.copy}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            field.current?.focus();
            field.current?.select();
            // Do not announce success or alter a pending clipboard result.
            if (!pending.current) setStatus('selected');
          }}
        >
          {en.handbook.select}
        </button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true">
        {status === 'idle' ? en.handbook.ready : en.handbook[status]}
      </p>
    </div>
  );
}
