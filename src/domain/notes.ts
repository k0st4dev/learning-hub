import { z } from 'zod';

export const noteCharacterLimit = 20000;
export const noteItemIdSchema = z.string().min(1).max(160);
export const noteSubmissionSchema = z.strictObject({
  mutationId: z.uuid(),
  itemId: noteItemIdSchema,
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  expectedStudentId: z.string().min(1).max(160),
  body: z.string().max(noteCharacterLimit),
});
export type NoteSubmission = z.infer<typeof noteSubmissionSchema>;
export const noteStateSchema = z.strictObject({
  itemId: noteItemIdSchema,
  body: z.string().max(noteCharacterLimit),
  revision: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative().nullable(),
  updatedAt: z.number().int().nonnegative().nullable(),
});
export type NoteState = z.infer<typeof noteStateSchema>;
