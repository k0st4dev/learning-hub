'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  scorecardEntries,
  scorecardStateSchema,
  type ScorecardState,
  type ScorecardSubmission,
} from '@/domain/scorecards';
import { RequestError, writeApi } from '@/lib/client-api';
import { deferLearningLeave } from '@/lib/learning-leave';

type Draft = Pick<ScorecardState, 'ratings' | 'evidence'>;
export function scorecardDraft(state: Draft, dimensions: string[]) {
  return JSON.stringify({
    ratings: scorecardEntries(dimensions, state.ratings),
    evidence: scorecardEntries(dimensions, state.evidence),
  });
}
type State = {
  confirmed: ScorecardState;
  draft: Draft;
  checking: boolean;
  pending: boolean;
  error: RequestError | null;
  retry: ScorecardSubmission | null;
  conflict: ScorecardState | null;
};
export function useScorecardSave(
  studentId: string,
  initial: ScorecardState,
  confirmLeave: () => Promise<boolean>,
) {
  const [state, setState] = useState<State>({
    confirmed: initial,
    draft: { ratings: initial.ratings, evidence: initial.evidence },
    checking: true,
    pending: false,
    error: null,
    retry: null,
    conflict: null,
  });
  const current = useRef(state);
  const mounted = useRef(true);
  const flight = useRef<Promise<boolean> | null>(null);
  const update = useCallback((patch: Partial<State>) => {
    current.current = { ...current.current, ...patch };
    if (mounted.current) setState(current.current);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const url = '/api/scorecards/' + initial.periodKey;
  const trusted = useCallback(
    (value: unknown) => {
      const result = scorecardStateSchema.parse(value);
      if (
        result.periodKey !== initial.periodKey ||
        JSON.stringify(result.dimensions) !==
          JSON.stringify(initial.dimensions) ||
        JSON.stringify(result.scale) !== JSON.stringify(initial.scale)
      )
        throw new Error('Unexpected scorecard');
      scorecardDraft(result, initial.dimensions);
      return result;
    },
    [initial.periodKey, initial.dimensions, initial.scale],
  );
  const latest = useCallback(async () => {
    const response = await fetch(
      url + '?expectedStudentId=' + encodeURIComponent(studentId),
      { cache: 'no-store' },
    );
    const result = await response.json();
    if (!response.ok)
      throw new RequestError(
        result.error?.message ?? 'Could not read the saved review.',
        response.status,
      );
    return trusted(result.data);
  }, [url, studentId, trusted]);
  const dirty = useCallback(
    (value: State) =>
      scorecardDraft(value.draft, initial.dimensions) !==
      scorecardDraft(value.confirmed, initial.dimensions),
    [initial.dimensions],
  );
  useEffect(() => {
    let active = true;
    void latest()
      .then((saved) => {
        if (!active || saved.revision <= current.current.confirmed.revision)
          return;
        if (dirty(current.current))
          update({
            conflict: saved,
            error: new RequestError(
              'Saved review changed. Review both versions.',
              409,
            ),
          });
        else
          update({
            confirmed: saved,
            draft: { ratings: saved.ratings, evidence: saved.evidence },
          });
      })
      .catch((cause) => {
        if (active)
          update({
            error:
              cause instanceof RequestError
                ? cause
                : new RequestError(
                    'Could not read the saved review. Your draft is still here.',
                    0,
                  ),
          });
      })
      .finally(() => {
        if (active) update({ checking: false });
      });
    return () => {
      active = false;
    };
  }, [latest, dirty, update]);
  const send = useCallback(
    (payload: ScorecardSubmission, replay = false): Promise<boolean> => {
      if (flight.current) return flight.current;
      update({ pending: true, retry: payload, error: null });
      const operation = (async () => {
        try {
          const result = await writeApi<{ data: unknown }>(url, 'PUT', payload);
          const acknowledgment = trusted(result.data);
          if (
            acknowledgment.revision !== payload.expectedRevision + 1 ||
            scorecardDraft(acknowledgment, initial.dimensions) !==
              scorecardDraft(payload, initial.dimensions)
          )
            throw new Error('Unexpected acknowledgment');
          const saved = replay ? await latest() : acknowledgment;
          if (saved.revision < acknowledgment.revision)
            throw new Error('Outdated state');
          if (
            saved.revision > acknowledgment.revision &&
            scorecardDraft(saved, initial.dimensions) !==
              scorecardDraft(acknowledgment, initial.dimensions)
          ) {
            update({
              retry: null,
              conflict: saved,
              error: new RequestError(
                'Saved review changed after this request. Review both versions.',
                409,
              ),
            });
            return false;
          }
          // Text typed during a save remains in the draft until deliberately saved.
          update({
            confirmed: saved,
            retry: null,
            conflict: null,
            error: null,
          });
          return true;
        } catch (cause) {
          const error =
            cause instanceof RequestError
              ? cause
              : new RequestError(
                  'Could not save. Your draft is still here; retry the same save.',
                  0,
                );
          let conflict: ScorecardState | null = null;
          if (error.status === 409) {
            try {
              conflict = trusted(error.currentState);
            } catch {
              /* Require owned refresh. */
            }
          }
          update({
            error,
            conflict,
            retry: [400, 409, 422].includes(error.status) ? null : payload,
          });
          return false;
        } finally {
          flight.current = null;
          update({ pending: false });
        }
      })();
      flight.current = operation;
      return operation;
    },
    [url, trusted, latest, initial.dimensions, update],
  );
  const save = () => {
    const value = current.current;
    if (
      value.checking ||
      value.pending ||
      value.retry ||
      value.conflict ||
      (value.error && [401, 403].includes(value.error.status))
    )
      return;
    return send({
      periodKey: initial.periodKey,
      mutationId: crypto.randomUUID(),
      expectedStudentId: studentId,
      expectedRevision: value.confirmed.revision,
      ...value.draft,
    });
  };
  const unconfirmed =
    dirty(state) || state.pending || !!state.retry || !!state.conflict;
  useEffect(() => {
    if (!unconfirmed) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const leave = (event: Event) => {
      const prepare = async () => {
        if (flight.current) await flight.current;
        const value = current.current;
        if (!dirty(value) && !value.retry && !value.conflict) return true;
        return confirmLeave();
      };
      if (!deferLearningLeave(event, prepare)) event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('learning:before-leave', leave);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('learning:before-leave', leave);
    };
  }, [unconfirmed, dirty, confirmLeave]);
  return {
    ...state,
    dirty: dirty(state),
    change: (key: string, rating: number | null, evidence?: string) => {
      const value = current.current.draft;
      const ratings = { ...value.ratings };
      const text = { ...value.evidence };
      if (evidence !== undefined) {
        if (evidence === '') delete text[key];
        else text[key] = evidence;
      } else if (rating === null) delete ratings[key];
      else ratings[key] = rating;
      update({ draft: { ratings, evidence: text } });
    },
    save,
    retrySave: () => {
      const payload = current.current.retry;
      if (payload) return send(payload, true);
    },
    review: async () => {
      if (current.current.pending) return;
      update({ pending: true });
      try {
        update({
          conflict: await latest(),
          retry: null,
          error: new RequestError(
            'Review saved values before choosing a version.',
            409,
          ),
        });
      } catch (cause) {
        update({
          error:
            cause instanceof RequestError
              ? cause
              : new RequestError('Could not read the saved review.', 0),
        });
      } finally {
        update({ pending: false });
      }
    },
    resolve: (keep: boolean) => {
      const saved = current.current.conflict;
      if (!saved) return;
      update({
        confirmed: saved,
        conflict: null,
        retry: null,
        error: null,
        ...(keep
          ? {}
          : { draft: { ratings: saved.ratings, evidence: saved.evidence } }),
      });
      if (keep) return save();
    },
  };
}
