import { NextRequest, NextResponse } from 'next/server';
import { searchCurriculum } from '@/server/content/search';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest } from '@/server/http';
import { searchInput } from '@/domain/search';

export async function GET(request: NextRequest) {
  return endpoint(() => {
    guardRequest(request, false);
    const input = searchInput(request.nextUrl.searchParams);
    const data = searchCurriculum(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      input,
      request.headers.get('x-expected-student') ?? undefined,
    );
    return NextResponse.json({ data });
  });
}
