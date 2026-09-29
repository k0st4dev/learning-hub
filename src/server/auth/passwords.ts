import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify, needsRehash } from 'argon2';
import { z } from 'zod';
import { AppError } from '../errors.ts';

const common = new Set(
  gunzipSync(
    readFileSync(
      path.join(process.cwd(), 'src/server/auth/common-passwords.txt.gz'),
    ),
  )
    .toString('utf8')
    .split('\n'),
);
export const passwordSchema = z
  .string()
  .refine(
    (value) =>
      [...value].length >= 15 &&
      [...value].length <= 128 &&
      Buffer.byteLength(value, 'utf8') <= 512,
    'Use 15–128 characters, at most 512 UTF-8 bytes.',
  )
  .refine(
    (value) => !common.has(value.toLowerCase()),
    'This password is too common. Choose a different password.',
  );
export const passwordOptions = {
  type: argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
} as const;
let active = 0;
const queue: Array<() => void> = [];
async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (active >= 2) {
    if (queue.length >= 16)
      throw new AppError(
        503,
        'AUTH_BUSY',
        'Sign-in is busy. Please try again shortly.',
      );
    await new Promise<void>((resolve) => queue.push(resolve));
  } else active++;
  try {
    return await work();
  } finally {
    const next = queue.shift();
    if (next) next();
    else active--;
  }
}
export const hashPassword = (password: string) =>
  limited(() => hash(password, passwordOptions));
export const verifyPassword = (encoded: string, password: string) =>
  limited(() => verify(encoded, password));
export const passwordNeedsRehash = (encoded: string) =>
  needsRehash(encoded, passwordOptions);
let dummy: Promise<string> | undefined;
export async function dummyPasswordCheck(password: string) {
  dummy ??= hashPassword(randomBytes(32).toString('base64url'));
  await verifyPassword(await dummy, password);
}
