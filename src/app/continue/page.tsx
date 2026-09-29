import { redirect } from 'next/navigation';
import { pageStudent } from '@/server/auth/page';
import { getStore } from '@/server/db/current';
import { snapshot, continuePath } from '@/server/learning/read';
export default async function Continue() {
  const { token } = await pageStudent('/continue');
  redirect(continuePath(snapshot(getStore(), token)));
}
