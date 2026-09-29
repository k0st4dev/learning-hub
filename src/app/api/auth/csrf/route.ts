import { NextRequest, NextResponse } from 'next/server';
import { createCsrf, csrfCookieName } from '@/server/auth/csrf';
import { sessionCookieName } from '@/server/auth/service';
import {
  cookieOptions,
  csrfSecret,
  endpoint,
  guardRequest,
} from '@/server/http';
export async function GET(request: NextRequest) {
  return endpoint(() => {
    guardRequest(request, false);
    const token = createCsrf(
      csrfSecret(),
      request.cookies.get(sessionCookieName)?.value,
    );
    const response = NextResponse.json({ data: { token } });
    response.cookies.set(csrfCookieName, token, {
      ...cookieOptions,
      maxAge: 3600,
    });
    return response;
  });
}
