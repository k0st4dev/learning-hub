import { NextRequest, NextResponse } from 'next/server';
import { mutateLearning } from '@/server/learning/mutate';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest, readJson } from '@/server/http';
import { AppError } from '@/server/errors';
import { revalidateLearningPages } from '@/server/learning/revalidate';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  return endpoint(async () => {
    guardRequest(request);
    const { action } = await params;
    const body = await readJson(request);
    if (
      !body ||
      typeof body !== 'object' ||
      !('kind' in body) ||
      !['orientation', 'cursor'].includes(action) ||
      body.kind !== action
    )
      throw new AppError(400, 'INVALID_ACTION', 'Unknown enrollment action.');
    const data = mutateLearning(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      body,
    );
    revalidateLearningPages();
    return NextResponse.json({ data, revision: data.revision });
  });
}
