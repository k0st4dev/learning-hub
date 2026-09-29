import { NextRequest, NextResponse } from 'next/server';
import { allowedLocalRequest } from './server/request-policy';

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
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
