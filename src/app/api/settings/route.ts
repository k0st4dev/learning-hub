import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { readSettings, saveSettings } from '@/server/account/settings';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest, readJson } from '@/server/http';

export async function GET(request: NextRequest) {
  return endpoint(() => {
    guardRequest(request, false);
    const data = readSettings(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      request.nextUrl.searchParams.get('expectedStudentId') ?? undefined,
    );
    return NextResponse.json({ data, revision: data.revision });
  });
}
export async function PUT(request: NextRequest) {
  return endpoint(async () => {
    guardRequest(request);
    const data = saveSettings(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      await readJson(request),
    );
    revalidatePath('/', 'layout');
    return NextResponse.json({ data, revision: data.revision });
  });
}
