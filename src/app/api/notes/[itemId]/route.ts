import { NextRequest, NextResponse } from 'next/server';
import { readNote, saveNote } from '@/server/learning/notes';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest, readJson } from '@/server/http';
import { AppError } from '@/server/errors';

type Context = { params: Promise<{ itemId: string }> };
// 20,000 UTF-16 units can require 120,000 bytes when JSON-escaped.
// Keep the default 32 KiB bound for other endpoints.
const noteRequestByteLimit = 131072;

export async function GET(request: NextRequest, { params }: Context) {
  return endpoint(async () => {
    guardRequest(request, false);
    const { itemId } = await params;
    const data = readNote(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      itemId,
      request.nextUrl.searchParams.get('expectedStudentId') ?? undefined,
    );
    return NextResponse.json({ data, revision: data.revision });
  });
}

export async function PUT(request: NextRequest, { params }: Context) {
  return endpoint(async () => {
    guardRequest(request);
    const { itemId } = await params;
    const body = await readJson(request, noteRequestByteLimit);
    if (
      !body ||
      typeof body !== 'object' ||
      !('itemId' in body) ||
      body.itemId !== itemId
    )
      throw new AppError(
        400,
        'INVALID_ACTION',
        'The request does not match this note item.',
      );
    const data = saveNote(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      body,
    );
    return NextResponse.json({ data, revision: data.revision });
  });
}
