import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { startCourse } from '@/server/learning/mutate';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest, readJson } from '@/server/http';
export async function POST(request: NextRequest) {
  return endpoint(async () => {
    guardRequest(request);
    z.object({})
      .strict()
      .parse(await readJson(request));
    const data = startCourse(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
    );
    return NextResponse.json({ data, revision: data.revision });
  });
}
