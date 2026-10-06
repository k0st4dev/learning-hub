import { NextRequest, NextResponse } from 'next/server';
import { readScorecard, saveScorecard } from '@/server/learning/scorecards';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest, readJson } from '@/server/http';
import { AppError } from '@/server/errors';

type Context = { params: Promise<{ periodKey: string }> };
// Fourteen 2,000-unit evidence fields can require 168,000 JSON-escaped bytes.
const scorecardRequestByteLimit = 262144;
export async function GET(request: NextRequest, { params }: Context) {
  return endpoint(async () => {
    guardRequest(request, false);
    const { periodKey } = await params;
    const data = readScorecard(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      periodKey,
      request.nextUrl.searchParams.get('expectedStudentId') ?? undefined,
    );
    return NextResponse.json({ data, revision: data.revision });
  });
}
export async function PUT(request: NextRequest, { params }: Context) {
  return endpoint(async () => {
    guardRequest(request);
    const { periodKey } = await params;
    const body = await readJson(request, scorecardRequestByteLimit);
    if (
      !body ||
      typeof body !== 'object' ||
      !('periodKey' in body) ||
      body.periodKey !== periodKey
    )
      throw new AppError(
        400,
        'INVALID_ACTION',
        'The request does not match this scorecard month.',
      );
    const data = saveScorecard(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      body,
    );
    return NextResponse.json({ data, revision: data.revision });
  });
}
