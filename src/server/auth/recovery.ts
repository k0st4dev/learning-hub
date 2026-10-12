import { z } from 'zod';
import type { Store } from '../db/connection.ts';
import { authRepository } from './repository.ts';
import { passwordSchema, hashPassword } from './passwords.ts';
import { AppError } from '../errors.ts';

const emailSchema = z.string().trim().max(254).email();
export function recoveryAccount(store: Store, email: unknown) {
  const canonical = emailSchema.parse(email).toLowerCase();
  const user = authRepository(store).findByEmail(canonical);
  if (!user)
    throw new AppError(
      404,
      'ACCOUNT_NOT_FOUND',
      'No local account has that email. Check the account and data directory.',
    );
  return { id: user.id, email: user.email };
}
/** OS-owner capability. Never expose this service through a browser endpoint. */
export async function recoverPassword(
  store: Store,
  input: unknown,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const data = z
    .strictObject({
      email: emailSchema,
      newPassword: passwordSchema,
      expectedStudentId: z.string().min(1).max(160),
    })
    .parse(input);
  const repo = authRepository(store);
  const user = repo.findByEmail(data.email.toLowerCase());
  if (!user)
    throw new AppError(
      404,
      'ACCOUNT_NOT_FOUND',
      'No local account has that email. Check the account and data directory.',
    );
  if (user.id !== data.expectedStudentId)
    throw new AppError(
      409,
      'ACCOUNT_CHANGED',
      'The selected account changed. Start recovery again.',
    );
  const passwordHash = await hashPassword(data.newPassword);
  signal?.throwIfAborted();
  store.native
    .transaction(() => {
      signal?.throwIfAborted();
      const current = repo.findById(user.id);
      if (
        !current ||
        current.emailCanonical !== user.emailCanonical ||
        current.passwordHash !== user.passwordHash
      )
        throw new AppError(
          409,
          'ACCOUNT_CHANGED',
          'The selected account changed. Start recovery again.',
        );
      const now = Date.now();
      repo.updateHash(user.id, passwordHash, now);
      repo.revokeUserSessions(user.id, now);
      repo.clearAccountFailures(user.emailCanonical);
      repo.clearPasswordFailures(user.id);
    })
    .immediate();
}
