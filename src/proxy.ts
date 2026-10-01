import { NextRequest, NextResponse } from 'next/server';
import { allowedLocalRequest } from './server/request-policy';
import {
  courseAvailability,
  availabilityFailure,
  isCourseRoute,
  type CourseIssue,
} from './server/content/availability';
import { getStore } from './server/db/current';
import { sessionCookieName } from './server/auth/service';

export function proxy(request: NextRequest) {
  const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000';
  if (!allowedLocalRequest(request.headers, request.method, origin)) {
    return new NextResponse(
      'This application only accepts requests from its configured local address.',
      { status: 403 },
    );
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${process.env.NODE_ENV === 'development' ? ` ws://${new URL(origin).host}` : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  headers.delete('x-course-issue');
  let issue: CourseIssue | null = null;
  if (
    ['GET', 'HEAD'].includes(request.method) &&
    isCourseRoute(request.nextUrl.pathname)
  ) {
    try {
      issue = courseAvailability(
        getStore(),
        request.cookies.get(sessionCookieName)?.value,
        request.nextUrl.pathname,
      );
    } catch (error) {
      issue = availabilityFailure(error);
    }
  }
  if (issue) headers.set('x-course-issue', issue);
  const destination = new URL('/course-state', origin);
  const response = issue
    ? NextResponse.rewrite(destination, {
        status: issue === 'missing' ? 404 : 503,
        request: { headers },
      })
    : NextResponse.next({ request: { headers } });
  if (issue && issue !== 'missing') response.headers.set('Retry-After', '5');
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
