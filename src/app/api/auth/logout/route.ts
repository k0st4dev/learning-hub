import { NextRequest, NextResponse } from 'next/server';
import { logout, sessionCookieName } from '@/server/auth/service';
import { csrfCookieName } from '@/server/auth/csrf';
import { getStore } from '@/server/db/current';
import { cookieOptions, endpoint, guardRequest } from '@/server/http';
export async function POST(request: NextRequest) {
  return endpoint(() => {
    guardRequest(request);
    logout(getStore(), request.cookies.get(sessionCookieName)?.value);
    const response = new NextResponse(null, { status: 204 });
    for (const name of [sessionCookieName, csrfCookieName])
      response.cookies.set(name, '', { ...cookieOptions, maxAge: 0 });
    return response;
  });
}
