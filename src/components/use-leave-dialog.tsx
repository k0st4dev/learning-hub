'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

/** Shared explicit discard decision. Native close restores the invoking focus. */
export function useLeaveDialog(title: string, description: string) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const decision = useRef<((allowed: boolean) => void) | null>(null);
  const id = useId();
  const confirm = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        if (decision.current) return resolve(false);
        decision.current = resolve;
        setOpen(true);
      }),
    [],
  );
  const choose = (allowed: boolean) => {
    const resolve = decision.current;
    decision.current = null;
    setOpen(false);
    dialog.current?.close();
    resolve?.(allowed);
  };
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  useEffect(
    () => () => {
      decision.current?.(false);
    },
    [],
  );
  return {
    confirm,
    dialog: (
      <dialog
        ref={dialog}
        aria-labelledby={id + '-title'}
        aria-describedby={id + '-help'}
        className="card note-leave-dialog"
        onCancel={(event) => {
          event.preventDefault();
          choose(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const buttons =
            dialog.current?.querySelectorAll<HTMLButtonElement>('button');
          const first = buttons?.[0];
          const last = buttons?.[1];
          if (!first || !last) return;
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        }}
      >
        <h2 id={id + '-title'}>{title}</h2>
        <p id={id + '-help'}>{description}</p>
        <div className="actions">
          <button
            className="button primary"
            autoFocus
            onClick={() => choose(false)}
          >
            Stay and keep my draft
          </button>
          <button className="button" onClick={() => choose(true)}>
            Leave and discard unconfirmed text
          </button>
        </div>
      </dialog>
    ),
  };
}
