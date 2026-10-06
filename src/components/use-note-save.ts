'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  noteCharacterLimit,
  noteStateSchema,
  type NoteState,
  type NoteSubmission,
} from '@/domain/notes';
import { RequestError, writeApi } from '@/lib/client-api';
import { deferLearningLeave } from '@/lib/learning-leave';

type EditorState = {
  checking: boolean;
  draft: string;
  confirmed: NoteState;
  pending: boolean;
  error: RequestError | null;
  retry: NoteSubmission | null;
  conflict: NoteState | null;
};
export function useNoteSave(
  studentId: string,
  initial: NoteState,
  confirmLeave: () => Promise<boolean>,
) {
  const [state, setState] = useState<EditorState>({
    checking: true,
    draft: initial.body,
    confirmed: initial,
    pending: false,
    error: null,
    retry: null,
    conflict: null,
  });
  const current = useRef(state);
  const mounted = useRef(true);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const readFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemId = initial.itemId;
  const url = '/api/notes/' + encodeURIComponent(itemId);
  const update = useCallback((patch: Partial<EditorState>) => {
    current.current = { ...current.current, ...patch };
    if (mounted.current) setState(current.current);
  }, []);
  const cancelTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelTimer();
    };
  }, [cancelTimer]);
  const trusted = useCallback(
    (value: unknown) => {
      const next = noteStateSchema.parse(value);
      if (next.itemId !== itemId) throw new Error('Unexpected note item');
      return next;
    },
    [itemId],
  );
  const latest = useCallback(async () => {
    const response = await fetch(
      url + '?expectedStudentId=' + encodeURIComponent(studentId),
      { cache: 'no-store' },
    );
    const value = await response.json();
    if (!response.ok)
      throw new RequestError(
        value.error?.message ?? 'Could not read the saved note.',
        response.status,
      );
    return trusted(value.data);
  }, [url, studentId, trusted]);
  useEffect(() => {
    let active = true;
    readFlight.current = (async () => {
      try {
        const saved = await latest();
        if (!active) return;
        const value = current.current;
        if (
          saved.revision <= value.confirmed.revision ||
          value.pending ||
          value.retry
        )
          return;
        if (value.draft === value.confirmed.body && !value.conflict)
          update({ confirmed: saved, draft: saved.body, error: null });
        else
          update({
            conflict: saved,
            error: new RequestError(
              'The saved note changed. Review both versions.',
              409,
              {},
              saved,
            ),
          });
      } catch (cause) {
        if (active)
          update({
            error:
              cause instanceof RequestError
                ? cause
                : new RequestError(
                    'Could not read the saved note. Your text is still here.',
                    0,
                  ),
          });
      } finally {
        if (active) update({ checking: false });
      }
    })();
    return () => {
      active = false;
    };
  }, [latest, update]);
  const send = useCallback(
    (payload: NoteSubmission, replay = false): Promise<boolean> => {
      if (inFlight.current) return inFlight.current;
      update({ pending: true, error: null, retry: payload });
      const operation = (async () => {
        try {
          const result = await writeApi<{ data: unknown }>(url, 'PUT', payload);
          const acknowledgment = trusted(result.data);
          if (
            acknowledgment.body !== payload.body ||
            acknowledgment.revision !== payload.expectedRevision + 1
          )
            throw new Error('Unexpected note acknowledgment');
          const next = replay ? await latest() : acknowledgment;
          if (next.revision < acknowledgment.revision)
            throw new Error('Outdated note state');
          if (
            next.revision > acknowledgment.revision &&
            next.body !== acknowledgment.body
          ) {
            update({
              retry: null,
              conflict: next,
              error: new RequestError(
                'The saved note changed after this request.',
                409,
                {},
                next,
              ),
            });
            return false;
          }
          // Never replace text typed while a request was in flight.
          update({ confirmed: next, retry: null, conflict: null, error: null });
          return true;
        } catch (cause) {
          const error =
            cause instanceof RequestError
              ? cause
              : new RequestError(
                  'Could not save. Your text is still here; retry the same save.',
                  0,
                );
          let conflict: NoteState | null = null;
          if (error.status === 409) {
            try {
              conflict = trusted(error.currentState);
            } catch {
              /* Explicit owned refresh is required. */
            }
          }
          update({
            error,
            conflict,
            retry: [400, 409, 422].includes(error.status) ? null : payload,
          });
          return false;
        } finally {
          inFlight.current = null;
          update({ pending: false });
        }
      })();
      inFlight.current = operation;
      return operation;
    },
    [url, update, trusted, latest],
  );
  const flush = useCallback(async () => {
    cancelTimer();
    if (readFlight.current) await readFlight.current;
    if (inFlight.current && !(await inFlight.current)) return false;
    while (mounted.current) {
      const value = current.current;
      if (value.retry || value.error || value.conflict) return false;
      if (value.draft === value.confirmed.body) return true;
      if (value.draft.length > noteCharacterLimit) return false;
      if (
        !(await send({
          mutationId: crypto.randomUUID(),
          itemId,
          expectedStudentId: studentId,
          expectedRevision: value.confirmed.revision,
          body: value.draft,
        }))
      )
        return false;
    }
    return false;
  }, [cancelTimer, send, itemId, studentId]);
  useEffect(() => {
    cancelTimer();
    if (
      state.draft !== state.confirmed.body &&
      !state.pending &&
      !state.checking &&
      !state.retry &&
      !state.error &&
      !state.conflict
    )
      timer.current = setTimeout(() => {
        void flush();
      }, 800);
    return cancelTimer;
  }, [state, flush, cancelTimer]);
  useEffect(() => {
    const value = current.current;
    if (
      initial.revision <= value.confirmed.revision ||
      value.pending ||
      value.retry
    )
      return;
    if (value.draft === value.confirmed.body && !value.error && !value.conflict)
      update({ draft: initial.body, confirmed: initial });
    else
      update({
        conflict: initial,
        error: new RequestError(
          'The saved note changed. Review both versions.',
          409,
          {},
          initial,
        ),
      });
  }, [initial, update]);
  const unconfirmed =
    state.draft !== state.confirmed.body ||
    state.pending ||
    !!state.retry ||
    !!state.conflict;
  useEffect(() => {
    if (!unconfirmed) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const leave = (event: Event) => {
      const prepare = async () => {
        if (await flush()) return true;
        return confirmLeave();
      };
      if (!deferLearningLeave(event, prepare)) {
        void flush();
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('learning:before-leave', leave);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('learning:before-leave', leave);
    };
  }, [unconfirmed, flush, confirmLeave]);
  return {
    ...state,
    dirty: state.draft !== state.confirmed.body,
    change: (draft: string) => {
      cancelTimer();
      update({ draft });
    },
    flush,
    save: () => {
      if (current.current.retry || current.current.conflict) return;
      update({ error: null });
      return flush();
    },
    retrySave: async () => {
      const payload = current.current.retry;
      if (payload && (await send(payload, true))) return flush();
      return false;
    },
    resolve: (keep: boolean) => {
      const saved = current.current.conflict;
      if (!saved) return;
      update({
        confirmed: saved,
        conflict: null,
        error: null,
        retry: null,
        ...(keep ? {} : { draft: saved.body }),
      });
      if (keep) return flush();
    },
    reviewSaved: async () => {
      if (current.current.pending) return;
      update({ pending: true });
      try {
        const saved = await latest();
        update({
          conflict: saved,
          error: new RequestError(
            'Review the saved note before choosing a version.',
            409,
            {},
            saved,
          ),
          retry: null,
        });
      } catch (cause) {
        update({
          error:
            cause instanceof RequestError
              ? cause
              : new RequestError(
                  'Could not read the saved note. Your draft is still here.',
                  0,
                ),
        });
      } finally {
        update({ pending: false });
      }
    },
  };
}
