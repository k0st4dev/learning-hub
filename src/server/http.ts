import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { readConfig } from './config';
import { allowedLocalRequest } from './request-policy';
import { AppError } from './errors';
import { csrfCookieName, verifyCsrf } from './auth/csrf';
import { sessionCookieName } from './auth/service';

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  path: '/',
} as const;
export function csrfSecret() {
  try {
    const secret = readFileSync(
      path.join(readConfig(process.env, process.cwd()).dataDir, 'csrf-secret'),
      'utf8',
    ).trim();
    if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Invalid secret');
    return secret;
  } catch {
    throw new AppError(
      503,
      'SETUP_REQUIRED',
      'Run setup before using accounts. Preserve existing local data.',
    );
  }
}
export function guardRequest(request: NextRequest, write = true) {
  if (
    !allowedLocalRequest(
      request.headers,
      request.method,
      readConfig(process.env, process.cwd()).origin,
    )
  )
    throw new AppError(
      403,
      'ORIGIN_REJECTED',
      'Open the application at its configured local address.',
    );
  if (
    write &&
    !verifyCsrf(
      csrfSecret(),
      request.cookies.get(sessionCookieName)?.value,
      request.cookies.get(csrfCookieName)?.value,
      request.headers.get('x-csrf-token'),
    )
  )
    throw new AppError(
      403,
      'CSRF_REJECTED',
      'Refresh this page and try again.',
    );
}
export async function readJson(
  request: Request,
  byteLimit = 32768,
): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AppError(400, 'INVALID_BODY', 'Send a JSON request.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'INVALID_BODY', 'The request is empty.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > byteLimit) {
      await reader.cancel();
      throw new AppError(400, 'BODY_TOO_LARGE', 'This request is too large.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError(400, 'INVALID_BODY', 'The request could not be read.');
  }
}
export async function endpoint(
  work: () => Promise<NextResponse> | NextResponse,
) {
  try {
    const response = await work();
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    const requestId = randomUUID();
    const known = error instanceof AppError;
    const invalid = error instanceof ZodError;
    const status = known ? error.status : invalid ? 400 : 503;
    const fieldErrors = invalid
      ? Object.fromEntries(
          error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        )
      : undefined;
    const response = NextResponse.json(
      {
        error: {
          code: known
            ? error.code
            : invalid
              ? 'VALIDATION_FAILED'
              : 'SERVICE_UNAVAILABLE',
          message: known
            ? error.message
            : invalid
              ? 'Check the highlighted fields.'
              : 'Your change was not confirmed. Try again or restart the application.',
          fieldErrors,
          requestId,
          ...(known ? error.details : {}),
        },
      },
      { status },
    );
    response.headers.set('Cache-Control', 'no-store');
    if (known && status === 429)
      response.headers.set(
        'Retry-After',
        String(error.details?.retryAfter ?? 900),
      );
    return response;
  }
}
