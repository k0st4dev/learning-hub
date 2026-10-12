import { z } from 'zod';

export function supportedTimezone(value: string): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(value))
    return null;
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}
const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(
    (value) => supportedTimezone(value) !== null,
    'Choose a supported IANA timezone.',
  )
  .transform((value) => supportedTimezone(value)!);
const themeSchema = z.enum(['light', 'dark', 'system']);
const revisionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const settingsSubmissionSchema = z.strictObject({
  displayName: z.string().trim().max(80),
  timezone: timezoneSchema,
  theme: themeSchema,
  mutationId: z.uuid(),
  expectedRevision: revisionSchema,
  expectedStudentId: z.string().min(1).max(160),
});
export const settingsStateSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().max(80),
  timezone: timezoneSchema,
  theme: themeSchema,
  revision: revisionSchema,
  updatedAt: z.number().int().nonnegative(),
});
export type SettingsSubmission = z.infer<typeof settingsSubmissionSchema>;
export type SettingsState = z.infer<typeof settingsStateSchema>;
