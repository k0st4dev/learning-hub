import { NextRequest, NextResponse } from 'next/server';
import { login, logout, sessionCookieName } from '@/server/auth/service';
import { csrfCookieName } from '@/server/auth/csrf';
import { getStore } from '@/server/db/current';
import { cookieOptions, endpoint, guardRequest, readJson } from '@/server/http';
export async function POST(request: NextRequest) {
  return endpoint(async () => {
    guardRequest(request);
    const store = getStore();
    const result = await login(store, await readJson(request));
    logout(store, request.cookies.get(sessionCookieName)?.value);
    const response = NextResponse.json({ data: { redirect: result.redirect } });
    response.cookies.set(sessionCookieName, result.token, {
      ...cookieOptions,
      expires: new Date(result.expiresAt),
    });
    response.cookies.set(csrfCookieName, '', { ...cookieOptions, maxAge: 0 });
    return response;
  });
}
