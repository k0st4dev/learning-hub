import { NextRequest, NextResponse } from 'next/server';
import { mutateLearning } from '@/server/learning/mutate';
import { getStore } from '@/server/db/current';
import { sessionCookieName } from '@/server/auth/service';
import { endpoint, guardRequest, readJson } from '@/server/http';
import { AppError } from '@/server/errors';
import { revalidateLearningPages } from '@/server/learning/revalidate';
const kinds: Record<string, string> = {
  lessons: 'lesson',
  exercises: 'exercise',
  tasks: 'task',
  preparation: 'preparation',
};
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  return endpoint(async () => {
    guardRequest(request);
    const { kind, id } = await params;
    const body = await readJson(request);
    if (
      !body ||
      typeof body !== 'object' ||
      !('kind' in body) ||
      !('itemId' in body) ||
      !kinds[kind] ||
      body.kind !== kinds[kind] ||
      body.itemId !== id
    )
      throw new AppError(
        400,
        'INVALID_ACTION',
        'The request does not match this learning item.',
      );
    const data = mutateLearning(
      getStore(),
      request.cookies.get(sessionCookieName)?.value,
      body,
    );
    revalidateLearningPages();
    return NextResponse.json({ data, revision: data.revision });
  });
}
