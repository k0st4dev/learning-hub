import { z } from 'zod';

// Product interpretations for se-26w-v1, keyed by immutable task ID.
// Values are permitted routes, not grades or claims that submitted code works.
export const alternativeRoutes = {
  'd017-task-02': ['structured_clone', 'manual_copy'],
  'd034-task-01': ['black_random', 'black_erase', 'random_erase'],
  'd039-task-03': ['documented_cases', 'automated_core'],
  'd065-task-03': ['manual', 'jest'],
  'd084-task-01': ['shortest_window', 'similar_medium_lite'],
  'd099-task-01': ['c', 'javascript'],
  'd105-task-03': ['loop_invariant', 'cannot_skip_answer'],
  'd115-task-02': ['implement_now', 'odin_later'],
  'd124-task-01': ['number_toolkit', 'text_analyzer'],
  'd138-task-02': ['anecdotes', 'current_equivalent'],
  'd156-task-01': ['post_delete_put', 'post_delete_patch'],
  'd168-task-03': ['mini_app', 'test'],
  'd172-task-02': ['course_flow', 'analogous_flow'],
  'd177-task-03': ['postgresql', 'known_course_database'],
  'd179-task-01': ['login_and_registration', 'login_only'],
  'd182-task-03': ['prepared_bug', 'own_bug'],
} as const;

export type TaskRequirement = {
  id: string;
  requirement_mode:
    'required' | 'optional' | 'conditional' | 'alternative' | 'mixed';
  completion_rule: string;
};
export type ExerciseRequirements = {
  releaseId: 'se-26w-v1';
  exerciseId: string;
  tasks: readonly TaskRequirement[];
  // Trusted course adapter decides this from the selected assignment, never the client.
  requiresScope: boolean;
  assessment?: {
    kind: 'weekly_checkpoint' | 'final_exam';
    dayNumber: number;
    criterion: string;
    aiPolicy: string;
    studyInstruction: string;
  };
};
const text = z.string().max(2000);
export const exerciseSubmissionSchema = z.strictObject({
  tasks: z
    .array(
      z.strictObject({
        taskId: z.string().min(1).max(160),
        status: z.enum(['done', 'not_applicable']),
        reason: text.default(''),
        choice: z.string().max(80).default(''),
      }),
    )
    .max(548),
  evidence: text,
  selectedScope: text,
  attested: z.boolean(),
  result: z.enum(['passed', 'needs_review']).nullable(),
  transferPath: z
    .enum(['go', 'java', 'existing_languages'])
    .nullable()
    .default(null),
  transferReflection: text.default(''),
  scoreEvidence: text.default(''),
  remediationNote: text.default(''),
});
export type ExerciseSubmission = z.infer<typeof exerciseSubmissionSchema>;
export type RequirementIssue = {
  code:
    | 'invalid_submission'
    | 'unknown_task'
    | 'duplicate_task'
    | 'task_required'
    | 'not_applicable_forbidden'
    | 'reason_required'
    | 'choice_required'
    | 'choice_forbidden'
    | 'scope_required'
    | 'evidence_required'
    | 'attestation_required'
    | 'passed_result_required'
    | 'transfer_path_required'
    | 'transfer_reflection_required'
    | 'transfer_path_conflict';
  taskId?: string;
};

/** Drafts may omit completion work, but may never contain forged decisions. */
export function exerciseDraftIssues(
  requirements: ExerciseRequirements,
  submission: ExerciseSubmission,
  issues = evaluateExercise(requirements, submission).issues,
) {
  return issues.filter((issue) => {
    if (
      [
        'invalid_submission',
        'unknown_task',
        'duplicate_task',
        'not_applicable_forbidden',
        'choice_forbidden',
      ].includes(issue.code)
    )
      return true;
    const response = submission.tasks.find(
      (task) => task.taskId === issue.taskId,
    );
    if (issue.code === 'reason_required')
      return response?.status === 'not_applicable';
    if (issue.code === 'choice_required') return !!response?.choice;
    return (
      issue.code === 'transfer_path_conflict' &&
      requirements.exerciseId !== 'd125-practice'
    );
  });
}

/** Pure eligibility only. No writes, percentage changes, URLs/files or code execution.
 * Requirements MUST come from the owned enrollment's published release, not a request body.
 * The server repeats this evaluation inside its owned-enrollment save transaction.
 */
export function evaluateExercise(
  requirements: ExerciseRequirements,
  input: unknown,
) {
  if (
    requirements.releaseId !== 'se-26w-v1' ||
    !requirements.tasks.length ||
    new Set(requirements.tasks.map((task) => task.id)).size !==
      requirements.tasks.length
  )
    throw new Error('Unsupported or invalid exercise requirements');
  for (const task of requirements.tasks) {
    if (
      !['required', 'optional', 'conditional', 'alternative', 'mixed'].includes(
        task.requirement_mode,
      ) ||
      !task.completion_rule.trim() ||
      (task.requirement_mode === 'alternative' &&
        !(task.id in alternativeRoutes))
    )
      throw new Error('Unsupported task requirement');
  }
  const issues: RequirementIssue[] = [];
  const add = (code: RequirementIssue['code'], taskId?: string) =>
    issues.push({ code, ...(taskId ? { taskId } : {}) });
  const parsed = exerciseSubmissionSchema.safeParse(input);
  if (!parsed.success)
    return {
      eligible: false,
      issues: [{ code: 'invalid_submission' } as RequirementIssue],
    };
  const submission = parsed.data;
  const responses = new Map<string, ExerciseSubmission['tasks'][number]>();
  for (const response of submission.tasks) {
    if (!requirements.tasks.some((task) => task.id === response.taskId))
      add('unknown_task', response.taskId);
    if (responses.has(response.taskId)) add('duplicate_task', response.taskId);
    responses.set(response.taskId, response);
  }
  const transfer = requirements.exerciseId === 'd125-practice';
  if (
    !transfer &&
    (submission.transferPath !== null || submission.transferReflection.trim())
  )
    add('transfer_path_conflict');
  for (const task of requirements.tasks) {
    const response = responses.get(task.id);
    if (response?.choice && task.requirement_mode !== 'alternative')
      add('choice_forbidden', task.id);
    if (
      response?.status === 'not_applicable' &&
      task.requirement_mode !== 'conditional'
    )
      add('not_applicable_forbidden', task.id);
    if (task.requirement_mode === 'optional') continue;
    if (!response) {
      add('task_required', task.id);
      continue;
    }
    if (
      task.requirement_mode === 'conditional' &&
      response.status === 'not_applicable'
    ) {
      if (!response.reason.trim()) add('reason_required', task.id);
      continue;
    }
    if (response.status !== 'done') continue; // Invalid skips already reported above.
    if (task.requirement_mode === 'alternative') {
      const permitted: readonly string[] =
        alternativeRoutes[task.id as keyof typeof alternativeRoutes];
      if (!permitted.includes(response.choice)) add('choice_required', task.id);
      if (!submission.selectedScope.trim()) add('scope_required', task.id);
      if (
        ['odin_later', 'known_course_database', 'login_only'].includes(
          response.choice,
        ) &&
        !response.reason.trim()
      )
        add('reason_required', task.id);
    }
    if (
      ['d078-task-02', 'd103-task-03', 'd134-task-01'].includes(task.id) &&
      !submission.selectedScope.trim()
    )
      add('scope_required', task.id);
  }
  if (requirements.requiresScope && !submission.selectedScope.trim())
    add('scope_required');
  if (transfer) {
    const language = responses.get('d125-task-01');
    const practice = responses.get('d125-task-02');
    if (!submission.transferPath) add('transfer_path_required');
    if (!submission.selectedScope.trim()) add('scope_required');
    if (submission.transferPath === 'existing_languages') {
      if (!submission.transferReflection.trim())
        add('transfer_reflection_required');
      if (language || practice?.status !== 'not_applicable')
        add('transfer_path_conflict');
    } else if (
      submission.transferPath === 'go' ||
      submission.transferPath === 'java'
    ) {
      if (language?.status !== 'done' || practice?.status !== 'done')
        add('transfer_path_conflict');
    }
  }
  if (!submission.evidence.trim()) add('evidence_required');
  if (!submission.attested) add('attestation_required');
  if (submission.result !== 'passed') add('passed_result_required');
  return { eligible: issues.length === 0, issues };
}
