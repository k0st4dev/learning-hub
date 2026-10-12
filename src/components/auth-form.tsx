'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { en } from '@/i18n/en';
import { RequestError, writeApi } from '@/lib/client-api';
export function AuthForm({
  mode,
  email = '',
  returnTo = '/dashboard',
  registered = false,
  passwordChanged = false,
}: {
  mode: 'register' | 'login';
  email?: string;
  returnTo?: string;
  registered?: boolean;
  passwordChanged?: boolean;
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const element = form.current;
    const clear = () => {
      for (const field of element?.querySelectorAll<HTMLInputElement>(
        'input[name="password"], input[name="confirmation"]',
      ) ?? [])
        field.value = '';
    };
    window.addEventListener('pagehide', clear);
    return () => {
      mounted.current = false;
      clear();
      window.removeEventListener('pagehide', clear);
    };
  }, []);
  const registering = mode === 'register';
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    const element = event.currentTarget;
    setPending(true);
    setError(null);
    const fields = new FormData(element);
    const body = Object.fromEntries(fields);
    try {
      if (registering) {
        const result = await writeApi<{ data: { email: string } }>(
          '/api/auth/register',
          'POST',
          body,
        );
        if (!mounted.current) return;
        router.push(
          `/login?registered=1&email=${encodeURIComponent(result.data.email)}`,
        );
      } else {
        const result = await writeApi<{ data: { redirect: string } }>(
          '/api/auth/login',
          'POST',
          { ...body, returnTo },
        );
        if (!mounted.current) return;
        router.push(result.data.redirect);
        router.refresh();
      }
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        cause instanceof RequestError
          ? cause
          : new RequestError(en.auth.networkError, 0),
      );
      requestAnimationFrame(() => summary.current?.focus());
    } finally {
      for (const input of element.querySelectorAll<HTMLInputElement>(
        'input[name="password"], input[name="confirmation"]',
      ))
        input.value = '';
      locked.current = false;
      if (mounted.current) {
        setShow(false);
        setPending(false);
      }
    }
  }
  const field = (
    name: 'email' | 'password' | 'confirmation' | 'displayName',
    type: string,
    required = true,
  ) => (
    <div className="field">
      <label htmlFor={name}>{en.auth[name]}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={name === 'email' ? email : undefined}
        autoComplete={
          name === 'email'
            ? 'username'
            : name === 'displayName'
              ? 'nickname'
              : registering
                ? 'new-password'
                : 'current-password'
        }
        aria-invalid={!!error?.fieldErrors[name]}
        aria-describedby={
          error?.fieldErrors[name]
            ? `${name}-error`
            : name === 'password' && registering
              ? 'password-help'
              : undefined
        }
      />
      {error?.fieldErrors[name] && (
        <p className="field-error" id={`${name}-error`}>
          {error.fieldErrors[name]}
        </p>
      )}
    </div>
  );
  return (
    <form
      ref={form}
      method="post"
      onSubmit={submit}
      className="stack"
      aria-busy={pending}
    >
      {registered && (
        <p role="status" className="notice">
          {en.auth.registered}
        </p>
      )}
      {passwordChanged && (
        <p role="status" className="notice">
          Password changed. All previous sessions were signed out. Sign in with
          your new password.
        </p>
      )}
      {error && (
        <div ref={summary} tabIndex={-1} role="alert" className="error-summary">
          <strong>{en.auth.errorTitle}</strong>
          <p>{error.message}</p>
          {error.retryAfter && (
            <p>
              Wait about {error.retryAfter} seconds from this attempt before
              trying again.
            </p>
          )}
          {Object.entries(error.fieldErrors).length > 0 && (
            <ul>
              {Object.entries(error.fieldErrors).map(([key, message]) => (
                <li key={key}>
                  <a href={`#${key}`}>{message}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <fieldset className="stack settings-fields" disabled={pending}>
        <legend className="sr-only">
          {registering ? en.register : en.login}
        </legend>
        {field('email', 'email')}
        {registering && field('displayName', 'text', false)}
        {field('password', show ? 'text' : 'password')}
        {registering && (
          <p id="password-help" className="muted">
            {en.auth.passwordHelp}
          </p>
        )}
        {registering && field('confirmation', show ? 'text' : 'password')}
        <label className="check-row">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          {en.auth.showPassword}
        </label>
      </fieldset>
      <button className="button primary" disabled={pending}>
        {pending ? en.auth.working : registering ? en.register : en.login}
      </button>
      <p>
        {registering ? en.auth.existing : en.auth.newAccount}{' '}
        <Link href={registering ? '/login' : '/register'}>
          {registering ? en.login : en.register}
        </Link>
      </p>
    </form>
  );
}
