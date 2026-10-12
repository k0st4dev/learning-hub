'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { validPasswordSize } from '@/domain/password-policy';
import { RequestError, writeApi } from '@/lib/client-api';
import { allowLearningLeave, deferLearningLeave } from '@/lib/learning-leave';
import { useLeaveDialog } from './use-leave-dialog';

export function PasswordChangeForm({
  studentId,
  email,
}: {
  studentId: string;
  email: string;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const preparing = useRef(false);
  const mounted = useRef(true);
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const login = '/login?returnTo=%2Fsettings';
  const changedLogin = login + '&passwordChanged=1';
  const leave = useLeaveDialog(
    'Leave without changing your password?',
    'Your entered passwords have not been submitted. Stay to finish, or leave to discard them.',
  );
  const clear = useCallback(() => {
    form.current?.reset();
    if (mounted.current) setShow(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const element = form.current;
    const hasSecrets = () =>
      !!element?.querySelector<HTMLInputElement>('[name="currentPassword"]')
        ?.value ||
      !!element?.querySelector<HTMLInputElement>('[name="newPassword"]')?.value;
    const unload = (event: BeforeUnloadEvent) => {
      if (locked.current || hasSecrets()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const navigate = (event: Event) => {
      // The submit action checks other editors first, without asking to discard
      // the very passwords it is about to send. Ordinary navigation never does.
      if (preparing.current) return;
      if (locked.current) {
        event.preventDefault();
        return;
      }
      if (hasSecrets() && !deferLearningLeave(event, leave.confirm))
        event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('pagehide', clear);
    document.addEventListener('learning:before-leave', navigate);
    return () => {
      mounted.current = false;
      element?.reset();
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('pagehide', clear);
      document.removeEventListener('learning:before-leave', navigate);
    };
  }, [clear, leave.confirm]);
  function focusError() {
    requestAnimationFrame(() => summary.current?.focus());
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || done || uncertain) return;
    const fields = new FormData(event.currentTarget);
    const currentPassword = String(fields.get('currentPassword') ?? '');
    const newPassword = String(fields.get('newPassword') ?? '');
    const issues: Record<string, string> = {};
    if (
      !currentPassword ||
      new TextEncoder().encode(currentPassword).length > 512
    )
      issues.currentPassword =
        'Enter your current password (at most 512 UTF-8 bytes).';
    if (!validPasswordSize(newPassword))
      issues.newPassword = 'Use 15–128 characters, at most 512 UTF-8 bytes.';
    setErrors(issues);
    setError(null);
    if (Object.keys(issues).length) {
      setError('Check the highlighted password fields.');
      focusError();
      return;
    }
    locked.current = true;
    preparing.current = true;
    setPending(true);
    let sent = false,
      confirmed = false;
    try {
      if (!(await allowLearningLeave())) return;
      if (!mounted.current) return;
      preparing.current = false;
      // Keep secrets only in this request's local variables, never in state,
      // history, browser storage or a retry queue. Clear the visible fields now.
      clear();
      sent = true;
      const result = await writeApi<void>('/api/auth/password', 'POST', {
        currentPassword,
        newPassword,
        expectedStudentId: studentId,
      });
      if (result !== undefined) throw new Error('Unexpected acknowledgment');
      confirmed = true;
      if (mounted.current) {
        setDone(true);
        setErrors({});
      }
    } catch (cause) {
      if (!mounted.current) return;
      const status = cause instanceof RequestError ? cause.status : 0;
      const unknown = status === 0 || status >= 500;
      setUncertain(unknown);
      setError(
        unknown
          ? 'The password-change result could not be confirmed.'
          : status === 401
            ? 'Your session expired or was revoked. Sign in again before changing your password.'
            : status === 403
              ? 'The account or request could not be verified. Sign in to the original account and reopen Settings.'
              : status === 409
                ? 'The password changed during this request. Sign in again before another change.'
                : status === 429
                  ? 'Too many password-change attempts. Wait for the temporary block to expire before trying again.'
                  : 'The password was not changed. Check the errors and enter your passwords again.',
      );
      if (cause instanceof RequestError)
        setErrors(
          Object.fromEntries(
            Object.entries(cause.fieldErrors).filter(([key]) =>
              ['currentPassword', 'newPassword'].includes(key),
            ),
          ),
        );
      focusError();
    } finally {
      preparing.current = false;
      locked.current = false;
      if (sent) clear();
      if (mounted.current) setPending(false);
    }
    if (confirmed && mounted.current) {
      // Retain confirmed success and the login link if navigation itself fails.
      try {
        router.replace(changedLogin);
        router.refresh();
      } catch {
        /* Login link remains available. */
      }
    }
  }
  return (
    <section
      className="card stack section"
      aria-labelledby="password-change-title"
    >
      <h2 id="password-change-title">Change password</h2>
      <p id="password-change-help">
        Changing your password signs out all sessions for your account,
        including this one. Save other changes before continuing. Your confirmed
        learning records stay saved.
      </p>
      {done ? (
        <div role="status">
          <p>Password changed. Sign in with your new password.</p>
          <Link href={changedLogin}>Sign in with your new password</Link>
        </div>
      ) : (
        <form
          ref={form}
          method="post"
          onSubmit={submit}
          noValidate
          className="stack"
          aria-busy={pending}
          aria-describedby="password-change-help"
        >
          <input
            type="hidden"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
          />
          {error && (
            <div
              ref={summary}
              tabIndex={-1}
              role="alert"
              className="error-summary stack"
            >
              <p>{error}</p>
              {Object.entries(errors).length > 0 && (
                <ul>
                  {Object.entries(errors).map(([key, message]) => (
                    <li key={key}>
                      <a href={'#change-' + key}>{message}</a>
                    </li>
                  ))}
                </ul>
              )}
              {uncertain && (
                <p>
                  Sign in with the new password you chose. If it is rejected as
                  incorrect, try your previous password. A lost response may
                  mean the change succeeded. This form will not repeat that
                  change automatically.
                </p>
              )}
              <p>
                Submitted passwords have been cleared. This form does not store
                your passwords.
              </p>
              <Link href={login}>Sign in again</Link>
            </div>
          )}
          <fieldset
            className="stack settings-fields"
            disabled={pending || uncertain}
          >
            <legend>Password change</legend>
            <div className="field">
              <label htmlFor="change-currentPassword">Current password</label>
              <input
                id="change-currentPassword"
                name="currentPassword"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={512}
                aria-invalid={!!errors.currentPassword}
                aria-describedby={
                  errors.currentPassword
                    ? 'change-currentPassword-error'
                    : undefined
                }
              />
              {errors.currentPassword && (
                <p className="field-error" id="change-currentPassword-error">
                  {errors.currentPassword}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="change-newPassword">New password</label>
              <input
                id="change-newPassword"
                name="newPassword"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                maxLength={256}
                aria-invalid={!!errors.newPassword}
                aria-describedby="change-password-size change-newPassword-error"
              />
              <p id="change-password-size" className="muted">
                Use 15–128 characters and at most 512 UTF-8 bytes. Spaces, paste
                and password managers are supported. Common compromised
                passwords are rejected.
              </p>
              <p className="field-error" id="change-newPassword-error">
                {errors.newPassword}
              </p>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={show}
                onChange={(event) => setShow(event.target.checked)}
              />
              Show passwords
            </label>
          </fieldset>
          <p role="status">
            {pending
              ? 'Changing password… Stay on this page until the result is confirmed.'
              : uncertain
                ? 'Result uncertain — sign in to check.'
                : 'Enter both passwords, then choose Change password.'}
          </p>
          <button className="button primary" disabled={pending || uncertain}>
            Change password
          </button>
        </form>
      )}
      {leave.dialog}
    </section>
  );
}
