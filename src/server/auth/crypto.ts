import { createHash, timingSafeEqual } from 'node:crypto';
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function equalSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
