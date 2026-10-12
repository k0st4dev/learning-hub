'use client';
export class RequestError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  currentState: unknown;
  retryAfter?: number;
  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
    currentState?: unknown,
    retryAfter?: number,
  ) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.currentState = currentState;
    if (
      typeof retryAfter === 'number' &&
      Number.isSafeInteger(retryAfter) &&
      retryAfter > 0
    )
      this.retryAfter = retryAfter;
  }
}
export async function writeApi<T>(
  url: string,
  method: 'POST' | 'PUT',
  body?: unknown,
): Promise<T> {
  const csrfResponse = await fetch('/api/auth/csrf', { cache: 'no-store' });
  const csrf = await csrfResponse.json();
  if (!csrfResponse.ok)
    throw new RequestError(
      csrf.error?.message ?? 'Please refresh and try again.',
      csrfResponse.status,
    );
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf.data.token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json();
  if (!response.ok)
    throw new RequestError(
      result.error?.message ?? 'Your change was not confirmed. Please retry.',
      response.status,
      result.error?.fieldErrors,
      result.error?.currentState,
      result.error?.retryAfter,
    );
  return result as T;
}
