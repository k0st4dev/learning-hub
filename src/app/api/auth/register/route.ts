import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/server/auth/service';
import { getStore } from '@/server/db/current';
import { endpoint, guardRequest, readJson } from '@/server/http';
export async function POST(request: NextRequest) {
  return endpoint(async () => {
    guardRequest(request);
    return NextResponse.json(
      { data: await register(getStore(), await readJson(request)) },
      { status: 201 },
    );
  });
}
