import { and, eq } from 'drizzle-orm';
import {
  settingsSubmissionSchema,
  settingsStateSchema,
  type SettingsState,
} from '../../domain/settings.ts';
import type { Store } from '../db/connection.ts';
import { appUser, settingsReceipt } from '../db/schema.ts';
import { requireStudent } from '../auth/service.ts';
import { digest } from '../auth/crypto.ts';
import { AppError } from '../errors.ts';

function confirmed(store: Store, userId: string): SettingsState {
  const row = store.orm
    .select({
      id: appUser.id,
      email: appUser.email,
      displayName: appUser.displayName,
      timezone: appUser.timezone,
      theme: appUser.theme,
      revision: appUser.settingsRevision,
      updatedAt: appUser.updatedAt,
    })
    .from(appUser)
    .where(eq(appUser.id, userId))
    .get();
  try {
    return settingsStateSchema.parse(row);
  } catch {
    throw new AppError(
      503,
      'SETTINGS_UNAVAILABLE',
      'Your saved settings could not be read. Preserve your local data and retry.',
    );
  }
}
function owner(store: Store, token: string | undefined, expected?: unknown) {
  const student = requireStudent(store, token);
  if (
    expected !== undefined &&
    settingsSubmissionSchema.shape.expectedStudentId.parse(expected) !==
      student.id
  )
    throw new AppError(
      403,
      'ACCOUNT_CHANGED',
      'The signed-in account changed. Return to the original account before reading or saving these settings.',
    );
  return student.id;
}
export function readSettings(
  store: Store,
  token: string | undefined,
  expectedStudentId?: unknown,
) {
  return confirmed(store, owner(store, token, expectedStudentId));
}
export function saveSettings(
  store: Store,
  token: string | undefined,
  input: unknown,
): SettingsState {
  requireStudent(store, token);
  const data = settingsSubmissionSchema.parse(input);
  return store.native
    .transaction(() => {
      const userId = owner(store, token, data.expectedStudentId);
      const requestHash = digest(JSON.stringify({ kind: 'settings', ...data }));
      const receipt = store.orm
        .select()
        .from(settingsReceipt)
        .where(
          and(
            eq(settingsReceipt.userId, userId),
            eq(settingsReceipt.mutationId, data.mutationId),
          ),
        )
        .get();
      if (receipt) {
        if (receipt.requestHash !== requestHash)
          throw new AppError(
            409,
            'MUTATION_REUSED',
            'This save identifier was used for different settings. Review the saved settings before trying again.',
          );
        try {
          const saved = settingsStateSchema.parse(
            JSON.parse(receipt.responseJson),
          );
          if (saved.id !== userId) throw new Error('Foreign receipt');
          return saved;
        } catch {
          throw new AppError(
            503,
            'SETTINGS_UNAVAILABLE',
            'The saved confirmation could not be read. Preserve your local data and retry.',
          );
        }
      }
      const currentState = confirmed(store, userId);
      if (currentState.revision !== data.expectedRevision)
        throw new AppError(
          409,
          'REVISION_CONFLICT',
          'Your settings changed in another tab. Keep your changes and review the saved settings before trying again.',
          { revision: currentState.revision, currentState },
        );
      const changed =
        currentState.displayName !== data.displayName ||
        currentState.timezone !== data.timezone ||
        currentState.theme !== data.theme;
      if (changed)
        store.orm
          .update(appUser)
          .set({
            displayName: data.displayName,
            timezone: data.timezone,
            theme: data.theme,
            settingsRevision: currentState.revision + 1,
            updatedAt: Date.now(),
          })
          .where(eq(appUser.id, userId))
          .run();
      const result = confirmed(store, userId);
      store.orm
        .insert(settingsReceipt)
        .values({
          userId,
          mutationId: data.mutationId,
          requestHash,
          responseJson: JSON.stringify(result),
          createdAt: Date.now(),
        })
        .run();
      return result;
    })
    .immediate();
}
