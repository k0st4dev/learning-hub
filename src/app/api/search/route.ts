import { NextRequest, NextResponse } from 'next/server';
import { searchCurriculum } from '@/server/content/search';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest } from '@/server/http';

export async function GET(request: NextRequest) {
  return endpoint(() => {
    guardRequest(request, false);
    const params = request.nextUrl.searchParams;
    const known = new Set(['q', 'page', 'kind', 'module', 'week', 'day']);
    const input: Record<string, unknown> = {};
    for (const key of new Set(params.keys())) {
      // Unknown and duplicate scalar parameters remain invalid, never select a foreign release/user.
      input[key] =
        known.has(key) && key !== 'q' && key !== 'page'
          ? params.getAll(key)
          : params.getAll(key).length === 1
            ? params.get(key)
            : params.getAll(key);
    }
    const data = searchCurriculum(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      input,
    );
    return NextResponse.json({ data });
  });
}
