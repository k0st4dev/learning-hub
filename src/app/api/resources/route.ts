import { NextRequest, NextResponse } from 'next/server';
import { resourceQueryInput } from '@/domain/resource-library';
import { readResourceLibrary } from '@/server/content/resource-library';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return endpoint(() => {
    guardRequest(request, false);
    const data = readResourceLibrary(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      resourceQueryInput(request.nextUrl.searchParams),
      request.headers.get('x-expected-student') ?? undefined,
    );
    return NextResponse.json({ data });
  });
}
