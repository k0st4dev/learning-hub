import { revalidatePath } from 'next/cache';
export function revalidateLearningPages() {
  revalidatePath('/dashboard');
  revalidatePath('/course/software-engineer/[[...segments]]', 'page');
}
