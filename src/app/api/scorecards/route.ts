import { NextRequest, NextResponse } from 'next/server';
import { readScorecard } from '@/server/learning/scorecards';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest } from '@/server/http';
export async function GET(request: NextRequest) {
  return endpoint(() => {
    guardRequest(request, false);
    const data = readScorecard(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      undefined,
      request.nextUrl.searchParams.get('expectedStudentId') ?? undefined,
    );
    return NextResponse.json({ data, revision: data.revision });
  });
}
