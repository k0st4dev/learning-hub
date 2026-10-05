'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  exerciseSubmissionSchema,
  type ExerciseSubmission,
} from '@/domain/exercise-requirements';
import { RequestError, writeApi } from '@/lib/client-api';
import { exerciseText as t } from '@/i18n/exercise';
import {
  studyContext,
  studyStateSchema,
  type StudyContext,
} from '@/domain/study-context';

export type ConfirmedExercise = {
  revision: number;
  completed: boolean;
  submission: ExerciseSubmission;
  context?: StudyContext;
};
const responseState = z.object({
  revision: z.number().int(),
  exerciseProgress: z.array(
    z.object({
      exerciseId: z.string(),
      status: z.string(),
      submission: exerciseSubmissionSchema.optional(),
    }),
  ),
});
function confirmedFrom(
  value: unknown,
  itemId: string,
  empty: ExerciseSubmission,
  kind: 'lesson' | 'exercise',
  context?: StudyContext,
): ConfirmedExercise {
  const state = responseState.parse(value);
  const nextContext = context
    ? studyContext(studyStateSchema.parse(value), itemId)
    : undefined;
  const progress = state.exerciseProgress.find(
    (item) => item.exerciseId === itemId,
  );
  if (progress && !progress.submission)
    throw new Error('Missing confirmed exercise');
  return {
    revision: state.revision,
    completed:
      kind === 'lesson'
        ? !!nextContext?.lessonComplete
        : progress?.status === 'completed',
    submission: progress?.submission ?? empty,
    ...(nextContext ? { context: nextContext } : {}),
  };
}
type PayloadBase = {
  itemId: string;
  expectedStudentId: string;
  mutationId: string;
  expectedRevision: number;
};
type Payload = PayloadBase &
  (
    | {
        kind: 'exercise';
        completed: boolean;
        submission: ExerciseSubmission;
      }
    | { kind: 'lesson'; completed: boolean }
    | { kind: 'cursor'; mode: 'open' | 'study'; anchor: string }
  );
export function useExerciseSave(
  itemId: string,
  studentId: string,
  initial: ConfirmedExercise,
  empty: ExerciseSubmission,
  kind: 'lesson' | 'exercise' = 'exercise',
  trackOpen = false,
) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(initial);
  const [draft, setDraft] = useState(initial.submission);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const [conflict, setConflict] = useState<ConfirmedExercise | null>(null);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState<{
    payload: Payload;
    preserveDraft: boolean;
  } | null>(null);
  const busy = useRef(false);
  const opened = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(confirmed.submission);
  const locked =
    pending ||
    !!retry ||
    !!conflict ||
    (!!error && [401, 403, 409].includes(error.status));
  useEffect(() => {
    if (!dirty && !pending && !retry) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const leave = (event: Event) => {
      if (!window.confirm(t.leave)) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.button !== 0
      )
        return;
      const next = new URL(anchor.href, window.location.href);
      if (
        next.pathname === location.pathname &&
        next.search === location.search
      )
        return;
      if (!window.confirm(t.leave)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    document.addEventListener('learning:before-leave', leave);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', click, true);
      document.removeEventListener('learning:before-leave', leave);
    };
  }, [dirty, pending, error, retry]);
  const send = useCallback(
    async (payload: Payload, preserveDraft = false) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setError(null);
      setMessage('');
      setRetry({ payload, preserveDraft });
      try {
        const response = await writeApi<{ data: unknown }>(
          payload.kind === 'cursor'
            ? '/api/enrollment/cursor'
            : `/api/progress/${payload.kind === 'lesson' ? 'lessons' : 'exercises'}/${encodeURIComponent(itemId)}`,
          'PUT',
          payload,
        );
        const next = confirmedFrom(
          response.data,
          itemId,
          empty,
          kind,
          initial.context,
        );
        setConfirmed(next);
        if (!preserveDraft) setDraft(next.submission);
        setRetry(null);
        setConflict(null);
        setMessage(t.saved);
        router.refresh();
        return next;
      } catch (cause) {
        const failure =
          cause instanceof RequestError ? cause : new RequestError(t.error, 0);
        if (failure.status === 409) {
          try {
            setConflict(
              confirmedFrom(
                failure.currentState,
                itemId,
                empty,
                kind,
                initial.context,
              ),
            );
          } catch {
            /* Keep the draft locked if no trusted current state was returned. */
          }
          setRetry(null);
        } else if ([400, 422].includes(failure.status)) setRetry(null);
        setError(failure);
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [router, itemId, empty, kind, initial.context],
  );
  useEffect(() => {
    if (!trackOpen || !initial.context || opened.current) return;
    opened.current = true;
    void send(
      {
        kind: 'cursor',
        mode: 'open',
        itemId,
        anchor: kind === 'lesson' ? 'study' : 'tasks',
        expectedStudentId: studentId,
        expectedRevision: initial.revision,
        mutationId: crypto.randomUUID(),
      },
      true,
    );
  }, [trackOpen, initial, itemId, kind, studentId, send]);
  return {
    draft,
    setDraft,
    confirmed,
    dirty,
    pending,
    error,
    conflict,
    locked,
    message,
    save: (completed: boolean, reopen = false) => {
      if (busy.current || locked || (confirmed.completed && !reopen)) return;
      return send(
        {
          ...(kind === 'exercise'
            ? {
                kind: 'exercise' as const,
                submission: reopen ? confirmed.submission : draft,
              }
            : { kind: 'lesson' as const }),
          itemId,
          expectedStudentId: studentId,
          mutationId: crypto.randomUUID(),
          expectedRevision: confirmed.revision,
          completed,
        },
        reopen && dirty,
      );
    },
    saveCursor: (mode: 'open' | 'study') => {
      if (busy.current || locked) return;
      const context = confirmed.context;
      const target = mode === 'study' ? context?.studyTargetId : itemId;
      if (!target) return;
      if (
        mode === 'study' &&
        target !== itemId &&
        dirty &&
        !window.confirm(t.leave)
      )
        return;
      return send(
        {
          kind: 'cursor',
          mode,
          itemId: target,
          anchor: target === context?.lessonId ? 'study' : 'tasks',
          expectedStudentId: studentId,
          expectedRevision: confirmed.revision,
          mutationId: crypto.randomUUID(),
        },
        true,
      ).then((next) => {
        if (
          next &&
          mode === 'study' &&
          target !== itemId &&
          context?.studyTargetPath
        )
          router.push(context.studyTargetPath);
      });
    },
    retry:
      retry && !pending
        ? () => {
            const saved = retry!;
            return send(saved.payload, saved.preserveDraft);
          }
        : null,
    resolve: (keep: boolean) => {
      if (!conflict) return;
      setConfirmed(conflict);
      if (!keep) setDraft(conflict.submission);
      setConflict(null);
      setError(null);
      setMessage('');
    },
  };
}
