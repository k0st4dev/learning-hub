import { NextRequest, NextResponse } from 'next/server';
import { changePassword, sessionCookieName } from '@/server/auth/service';
import { csrfCookieName } from '@/server/auth/csrf';
import { getStore } from '@/server/db/current';
import { cookieOptions, endpoint, guardRequest, readJson } from '@/server/http';
export async function POST(request: NextRequest) {
  return endpoint(async () => {
    guardRequest(request);
    await changePassword(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      await readJson(request),
    );
    const response = new NextResponse(null, { status: 204 });
    for (const name of [sessionCookieName, csrfCookieName])
      response.cookies.set(name, '', { ...cookieOptions, maxAge: 0 });
    return response;
  });
}
