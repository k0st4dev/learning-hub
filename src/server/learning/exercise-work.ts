import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Store } from '../db/connection';
import * as s from '../db/schema';
import { AppError } from '../errors';
import {
  evaluateExercise,
  exerciseDraftIssues,
  exerciseSubmissionSchema,
  type ExerciseRequirements,
  type ExerciseSubmission,
} from '../../domain/exercise-requirements';

// Reviewed external assignment sets whose exact selected identifiers are not fixed
// by the source. This records scope; it never adds external-course requirements.
export const scopedAssignmentDays = [
  85, 89, 90, 96, 97, 103, 104, 110, 117, 123, 131, 135, 139, 152, 153, 160,
  167, 174,
] as const;
const mode = z.enum([
  'required',
  'optional',
  'conditional',
  'alternative',
  'mixed',
]);
const ruleMetadata = z.object({
  completionRule: z.string().min(1),
  origin: z.literal('product_interpretation'),
});
const workSchema = z.strictObject({
  version: z.literal(1),
  choices: z.array(
    z.strictObject({ taskId: z.string(), choice: z.string().max(80) }),
  ),
  transferPath: exerciseSubmissionSchema.shape.transferPath,
  transferReflection: exerciseSubmissionSchema.shape.transferReflection,
  attested: z.boolean(),
  scoreEvidence: exerciseSubmissionSchema.shape.scoreEvidence,
  remediationNote: exerciseSubmissionSchema.shape.remediationNote,
});
type Progress = typeof s.exerciseProgress.$inferSelect;
type TaskProgress = typeof s.taskProgress.$inferSelect;
type Item = Pick<
  typeof s.contentItem.$inferSelect,
  'id' | 'stableKey' | 'parentId'
>;
function rubric(value: string) {
  try {
    return z.record(z.string(), z.unknown()).parse(JSON.parse(value));
  } catch {
    throw new AppError(
      503,
      'INVALID_PROGRESS',
      'Saved exercise data is unavailable. Keep your data and retry.',
    );
  }
}
export function readExerciseSubmission(
  progress: Progress,
  tasks: readonly TaskProgress[],
  items: readonly Item[],
): ExerciseSubmission {
  const saved = rubric(progress.rubricJson);
  const parsed =
    saved.exerciseWork === undefined
      ? null
      : workSchema.safeParse(saved.exerciseWork);
  if (parsed && !parsed.success)
    throw new AppError(
      503,
      'INVALID_PROGRESS',
      'Saved exercise decisions are unavailable. Keep your data and retry.',
    );
  const work = parsed?.data;
  const related = new Map(
    items
      .filter((item) => item.parentId === progress.exerciseId)
      .map((item) => [item.id, item.stableKey]),
  );
  const input = {
    tasks: tasks
      .filter(
        (task) =>
          task.enrollmentId === progress.enrollmentId &&
          related.has(task.taskId),
      )
      .map((task) => ({
        taskId: related.get(task.taskId)!,
        status: task.status,
        reason: task.reason,
        choice:
          work?.choices.find(
            (choice) => choice.taskId === related.get(task.taskId),
          )?.choice ?? '',
      })),
    evidence: progress.evidenceText,
    selectedScope: progress.selectedScope,
    attested: work?.attested ?? progress.criterionAttestedAt !== null,
    result: progress.result,
    transferPath: work?.transferPath ?? null,
    transferReflection: work?.transferReflection ?? '',
    scoreEvidence: work?.scoreEvidence ?? '',
    remediationNote: work?.remediationNote ?? '',
  };
  const submission = exerciseSubmissionSchema.safeParse(input);
  if (!submission.success)
    throw new AppError(
      503,
      'INVALID_PROGRESS',
      'Saved exercise data is unavailable. Keep your data and retry.',
    );
  return submission.data;
}

export function loadExerciseRequirements(
  store: Store,
  releaseId: string,
  exerciseId: string,
) {
  const db = store.orm;
  const release = db
    .select()
    .from(s.courseRelease)
    .where(eq(s.courseRelease.id, releaseId))
    .get();
  if (releaseId !== 'se-26w-v1' || release?.status !== 'published')
    throw new AppError(
      503,
      'UNSUPPORTED_RELEASE',
      'This course version is not available for exercise saves.',
    );
  const exercise = db
    .select()
    .from(s.contentItem)
    .where(
      and(
        eq(s.contentItem.id, exerciseId),
        eq(s.contentItem.releaseId, releaseId),
        eq(s.contentItem.kind, 'exercise'),
      ),
    )
    .get();
  const lesson = exercise?.parentId
    ? db
        .select()
        .from(s.contentItem)
        .where(
          and(
            eq(s.contentItem.id, exercise.parentId),
            eq(s.contentItem.releaseId, releaseId),
          ),
        )
        .get()
    : undefined;
  const day = lesson?.parentId
    ? db
        .select()
        .from(s.courseDay)
        .where(eq(s.courseDay.itemId, lesson.parentId))
        .get()
    : undefined;
  if (!exercise || !day)
    throw new AppError(
      503,
      'INVALID_CONTENT',
      'Exercise requirements are unavailable.',
    );
  const rows = db
    .select()
    .from(s.contentItem)
    .innerJoin(s.exerciseTask, eq(s.contentItem.id, s.exerciseTask.itemId))
    .where(
      and(
        eq(s.contentItem.parentId, exerciseId),
        eq(s.contentItem.releaseId, releaseId),
        eq(s.contentItem.kind, 'task'),
      ),
    )
    .all();
  let requirements: ExerciseRequirements;
  try {
    requirements = {
      releaseId,
      exerciseId: exercise.stableKey,
      requiresScope: (scopedAssignmentDays as readonly number[]).includes(
        day.dayNumber,
      ),
      ...(day.assessmentKind === 'practice'
        ? {}
        : {
            assessment: {
              kind: z
                .enum(['weekly_checkpoint', 'final_exam'])
                .parse(day.assessmentKind),
              dayNumber: day.dayNumber,
              criterion: day.completionCriterionMarkdown,
              aiPolicy: day.aiPolicyMarkdown,
              studyInstruction: lesson!.bodyMarkdown,
            },
          }),
      tasks: rows.map(({ content_item: item, exercise_task: task }) => ({
        id: item.stableKey,
        requirement_mode: mode.parse(task.requirementMode),
        completion_rule: ruleMetadata.parse(JSON.parse(task.ruleJson))
          .completionRule,
      })),
    };
    // Validate the definition even for draft saves, before any write.
    evaluateExercise(requirements, null);
  } catch {
    throw new AppError(
      503,
      'INVALID_CONTENT',
      'Exercise requirements are unavailable.',
    );
  }
  return {
    requirements,
    taskIds: new Map(
      rows.map(({ content_item: item }) => [item.stableKey, item.id]),
    ),
  };
}

// Called only inside mutateLearning's owned-enrollment IMMEDIATE transaction.
export function saveExerciseWork(
  store: Store,
  enrollment: typeof s.enrollment.$inferSelect,
  exerciseId: string,
  completed: boolean,
  submission: ExerciseSubmission,
  now: number,
) {
  const { requirements, taskIds } = loadExerciseRequirements(
    store,
    enrollment.releaseId,
    exerciseId,
  );
  const evaluation = evaluateExercise(requirements, submission);
  if (
    !requirements.assessment &&
    (submission.scoreEvidence.trim() || submission.remediationNote.trim())
  )
    throw new AppError(
      422,
      'ASSESSMENT_NOT_AVAILABLE',
      'Assessment notes belong to checkpoints or the final exam.',
    );
  const hardIssues = exerciseDraftIssues(
    requirements,
    submission,
    evaluation.issues,
  );
  const issues = completed ? evaluation.issues : hardIssues;
  if (issues.length)
    throw new AppError(
      422,
      'COMPLETION_REQUIREMENTS',
      'Check task decisions, selected scope, evidence and the original criterion before saving.',
      { issues },
    );
  const db = store.orm;
  const where = and(
    eq(s.exerciseProgress.enrollmentId, enrollment.id),
    eq(s.exerciseProgress.exerciseId, exerciseId),
  );
  const previous = db.select().from(s.exerciseProgress).where(where).get();
  const savedRubric = previous ? rubric(previous.rubricJson) : {};
  // Full replacement is limited to this exercise and enrollment; absent tasks mean unchecked.
  for (const id of taskIds.values())
    db.delete(s.taskProgress)
      .where(
        and(
          eq(s.taskProgress.enrollmentId, enrollment.id),
          eq(s.taskProgress.taskId, id),
        ),
      )
      .run();
  for (const response of submission.tasks)
    db.insert(s.taskProgress)
      .values({
        enrollmentId: enrollment.id,
        releaseId: enrollment.releaseId,
        taskId: taskIds.get(response.taskId)!,
        status: response.status,
        reason: response.reason,
        updatedAt: now,
      })
      .run();
  const update = {
    status: completed ? 'completed' : 'started',
    evidenceText: submission.evidence,
    selectedScope: submission.selectedScope,
    result: submission.result,
    criterionAttestedAt: completed
      ? (previous?.criterionAttestedAt ?? now)
      : null,
    completedAt: completed ? (previous?.completedAt ?? now) : null,
    rubricJson: JSON.stringify({
      ...savedRubric,
      exerciseWork: {
        version: 1,
        choices: submission.tasks
          .filter((task) => task.choice)
          .map(({ taskId, choice }) => ({ taskId, choice })),
        transferPath: submission.transferPath,
        transferReflection: submission.transferReflection,
        attested: submission.attested,
        scoreEvidence: submission.scoreEvidence,
        remediationNote: submission.remediationNote,
      },
    }),
    updatedAt: now,
  };
  db.insert(s.exerciseProgress)
    .values({
      ...update,
      enrollmentId: enrollment.id,
      releaseId: enrollment.releaseId,
      exerciseId,
      startedAt: previous?.startedAt ?? now,
    })
    .onConflictDoUpdate({
      target: [s.exerciseProgress.enrollmentId, s.exerciseProgress.exerciseId],
      set: update,
    })
    .run();
  return previous?.status === 'completed';
}
