import { z } from 'zod';

export const scorecardPeriodSchema = z
  .string()
  .regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/);
export const scorecardDefinitionSchema = z.object({
  dimensions: z
    .array(z.string().min(1).max(80))
    .length(14)
    .refine(
      (keys) => new Set(keys).size === keys.length,
      'Dimension keys must be unique.',
    ),
  scale: z.array(z.string().min(1)).length(4),
});
export const scorecardSubmissionSchema = z.strictObject({
  periodKey: scorecardPeriodSchema,
  mutationId: z.uuid(),
  expectedStudentId: z.string().min(1).max(160),
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ratings: z.record(z.string().min(1).max(80), z.number().int().min(0).max(3)),
  evidence: z.record(z.string().min(1).max(80), z.string().max(2000)),
});
export type ScorecardSubmission = z.infer<typeof scorecardSubmissionSchema>;
export const scorecardStateSchema = z.strictObject({
  periodKey: scorecardPeriodSchema,
  dimensions: scorecardDefinitionSchema.shape.dimensions,
  scale: scorecardDefinitionSchema.shape.scale,
  ratings: scorecardSubmissionSchema.shape.ratings,
  evidence: scorecardSubmissionSchema.shape.evidence,
  revision: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative().nullable(),
  updatedAt: z.number().int().nonnegative().nullable(),
});
export type ScorecardState = z.infer<typeof scorecardStateSchema>;

/** Calendar month in the student's timezone, never the server's local timezone. */
export function scorecardPeriod(timezone: string, now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(now));
  const year = parts
    .find((part) => part.type === 'year')!
    .value.padStart(4, '0');
  const month = parts.find((part) => part.type === 'month')!.value;
  return scorecardPeriodSchema.parse(year + '-' + month);
}

/** Canonical source order makes equivalent keyed requests share an exact retry hash. */
export function scorecardEntries<T>(keys: string[], values: Record<string, T>) {
  if (Object.keys(values).some((key) => !keys.includes(key)))
    throw new Error('Unknown scorecard dimension.');
  return Object.fromEntries(
    keys
      .filter((key) => Object.hasOwn(values, key))
      .map((key) => [key, values[key]!]),
  );
}
