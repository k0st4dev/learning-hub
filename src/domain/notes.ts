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
export type NoteState = {
  itemId: string;
  body: string;
  revision: number;
  createdAt: number | null;
  updatedAt: number | null;
};
