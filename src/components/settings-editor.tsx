'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  settingsStateSchema,
  settingsSubmissionSchema,
  type SettingsState,
  type SettingsSubmission,
} from '@/domain/settings';
import { RequestError, writeApi } from '@/lib/client-api';
import { deferLearningLeave } from '@/lib/learning-leave';
import { useLeaveDialog } from './use-leave-dialog';

type Draft = Pick<SettingsState, 'displayName' | 'timezone' | 'theme'>;
const fields = (state: Draft): Draft => ({
  displayName: state.displayName,
  timezone: state.timezone,
  theme: state.theme,
});
const same = (a: Draft, b: Draft) =>
  a.displayName === b.displayName &&
  a.timezone === b.timezone &&
  a.theme === b.theme;
export function SettingsEditor({ initial }: { initial: SettingsState }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(initial);
  const [draft, setDraft] = useState<Draft>(fields(initial));
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<RequestError | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState<SettingsSubmission | null>(null);
  const [conflict, setConflict] = useState<SettingsState | null>(null);
  const mounted = useRef(true);
  const locked = useRef(true);
  const live = useRef({ draft, confirmed, retry, conflict });
  useEffect(() => {
    live.current = { draft, confirmed, retry, conflict };
  }, [draft, confirmed, retry, conflict]);
  const leave = useLeaveDialog(
    'Leave with unsaved settings?',
    'Stay to save or copy your changes. Leaving discards unconfirmed settings.',
  );
  const trusted = useCallback(
    (value: unknown) => {
      const result = settingsStateSchema.parse(value);
      if (result.id !== initial.id)
        throw new RequestError(
          'The signed-in account changed. Your draft is still here.',
          403,
        );
      return result;
    },
    [initial.id],
  );
  const latest = useCallback(async () => {
    const response = await fetch(
      '/api/settings?expectedStudentId=' + encodeURIComponent(initial.id),
      { cache: 'no-store' },
    );
    const value = await response.json();
    if (!response.ok)
      throw new RequestError(
        value.error?.message ?? 'Could not read saved settings.',
        response.status,
      );
    return trusted(value.data);
  }, [initial.id, trusted]);
  const failed = (cause: unknown) =>
    cause instanceof RequestError
      ? cause
      : new RequestError(
          'The change was not confirmed. Your draft is still here.',
          0,
        );
  useEffect(() => {
    let active = true;
    mounted.current = true;
    void latest()
      .then((saved) => {
        if (!active) return;
        setConfirmed(saved);
        setDraft(fields(saved));
      })
      .catch((cause) => {
        if (active) setError(failed(cause));
      })
      .finally(() => {
        if (active) {
          locked.current = false;
          setBusy(false);
        }
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [latest]);
  const dirty = !same(draft, confirmed);
  useEffect(() => {
    const unconfirmed = () =>
      !same(live.current.draft, live.current.confirmed) ||
      !!live.current.retry ||
      !!live.current.conflict ||
      locked.current;
    const unload = (event: BeforeUnloadEvent) => {
      if (unconfirmed()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const navigate = (event: Event) => {
      if (unconfirmed() && !deferLearningLeave(event, leave.confirm))
        event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('learning:before-leave', navigate);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('learning:before-leave', navigate);
    };
  }, [leave.confirm]);
  async function send(payload: SettingsSubmission, replay = false) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setRetry(payload);
    try {
      const result = await writeApi<{ data: unknown }>(
        '/api/settings',
        'PUT',
        payload,
      );
      const ack = trusted(result.data);
      if (
        !same(ack, payload) ||
        ![payload.expectedRevision, payload.expectedRevision + 1].includes(
          ack.revision,
        )
      )
        throw new Error('Invalid acknowledgment');
      const saved = replay ? await latest() : ack;
      if (saved.revision < ack.revision) throw new Error('Outdated state');
      if (!mounted.current) return;
      setRetry(null);
      if (!same(saved, ack)) {
        setConflict(saved);
        setError(
          new RequestError(
            'Settings changed after this save. Review both versions.',
            409,
          ),
        );
      } else {
        setConfirmed(saved);
        setDraft(fields(saved));
        setConflict(null);
        setErrors({});
        router.refresh();
      }
    } catch (cause) {
      if (!mounted.current) return;
      const failure = failed(cause);
      setError(failure);
      setErrors(failure.fieldErrors);
      if ([400, 409, 422].includes(failure.status)) setRetry(null);
      if (failure.status === 409) {
        try {
          setConflict(trusted(failure.currentState));
        } catch {
          /* Require an owned refresh. */
        }
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function save(base = confirmed) {
    const parsed = settingsSubmissionSchema.safeParse({
      ...draft,
      expectedStudentId: initial.id,
      expectedRevision: base.revision,
      mutationId: crypto.randomUUID(),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      setError(new RequestError('Check the highlighted settings.', 400));
      return;
    }
    setErrors({});
    void send(parsed.data);
  }
  async function review() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const saved = await latest();
      if (mounted.current) {
        setConflict(saved);
        setRetry(null);
        setError(
          new RequestError('Review the saved version before choosing.', 409),
        );
      }
    } catch (cause) {
      if (mounted.current) setError(failed(cause));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="card stack" aria-labelledby="profile-title">
      <h2 id="profile-title">Your profile</h2>
      <form
        className="stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !retry && !conflict) save();
        }}
      >
        <fieldset className="stack settings-fields" disabled={busy}>
          <legend>Profile and appearance</legend>
          <label htmlFor="settings-email">Email (read only)</label>
          <input
            id="settings-email"
            type="email"
            value={confirmed.email}
            readOnly
          />
          <label htmlFor="settings-name">Display name</label>
          <input
            id="settings-name"
            autoComplete="nickname"
            maxLength={80}
            value={draft.displayName}
            aria-invalid={!!errors.displayName}
            aria-describedby={
              errors.displayName ? 'settings-name-error' : undefined
            }
            onChange={(event) =>
              setDraft({ ...draft, displayName: event.target.value })
            }
          />
          {errors.displayName && (
            <p className="field-error" id="settings-name-error">
              {errors.displayName}
            </p>
          )}
          <label htmlFor="settings-timezone">Timezone</label>
          <input
            id="settings-timezone"
            list="settings-timezones"
            value={draft.timezone}
            aria-invalid={!!errors.timezone}
            aria-describedby="settings-timezone-help settings-timezone-error"
            onChange={(event) =>
              setDraft({ ...draft, timezone: event.target.value })
            }
          />
          <datalist id="settings-timezones">
            <option value="UTC" />
            <option value="Europe/Ljubljana" />
            <option value="Europe/Belgrade" />
            <option value="America/New_York" />
            <option value="Asia/Tokyo" />
          </datalist>
          <p id="settings-timezone-help">
            Use an IANA timezone, for example Europe/Ljubljana. This controls
            displayed dates and the current review month.
          </p>
          <p className="field-error" id="settings-timezone-error">
            {errors.timezone}
          </p>
          <label htmlFor="settings-theme">Theme</label>
          <select
            id="settings-theme"
            value={draft.theme}
            onChange={(event) =>
              setDraft({
                ...draft,
                theme: event.target.value as Draft['theme'],
              })
            }
          >
            <option value="system">Follow system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <p>
            Appearance changes after saving. Follow system uses your computer’s
            color preference.
          </p>
        </fieldset>
        <p role="status">
          {busy
            ? 'Checking or saving settings…'
            : error
              ? 'Settings need attention'
              : dirty
                ? 'Unsaved changes'
                : 'Saved settings confirmed'}
        </p>
        <button
          className="button"
          disabled={busy || !!retry || !!conflict || !dirty}
        >
          Save settings
        </button>
      </form>
      {error && (
        <div className="error-summary stack" role="alert">
          <p>{error.message}</p>
          <p>
            Your draft stays in the fields above. You can copy it before
            leaving.
          </p>
          {retry && (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void send(retry, true)}
            >
              Retry the same save
            </button>
          )}
          {conflict ? (
            <>
              <h3>Latest saved settings</h3>
              <dl>
                <dt>Display name</dt>
                <dd>{conflict.displayName || '(empty)'}</dd>
                <dt>Timezone</dt>
                <dd>{conflict.timezone}</dd>
                <dt>Theme</dt>
                <dd>{conflict.theme}</dd>
              </dl>
              <button
                className="button"
                disabled={busy}
                onClick={() => save(conflict)}
              >
                Save my draft over this version
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  setConfirmed(conflict);
                  setDraft(fields(conflict));
                  setConflict(null);
                  setRetry(null);
                  setError(null);
                  setErrors({});
                  router.refresh();
                }}
              >
                Use saved settings and discard my draft
              </button>
            </>
          ) : (
            <button
              className="button"
              disabled={busy}
              onClick={() => void review()}
            >
              Review latest saved settings
            </button>
          )}
          {[401, 403].includes(error.status) && (
            <Link
              href="/login?returnTo=%2Fsettings"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sign in to the original account in a new tab
            </Link>
          )}
        </div>
      )}
      {leave.dialog}
    </section>
  );
}
