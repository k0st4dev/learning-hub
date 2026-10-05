import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateSource } from '../../src/server/content/source-schema';
import {
  evaluateExercise,
  type ExerciseRequirements,
  type ExerciseSubmission,
} from '../../src/domain/exercise-requirements';

const source = validateSource(
  JSON.parse(
    readFileSync('content/se-26w-v1/source/curriculum-source.json', 'utf8'),
  ),
);
const choices: Record<string, string> = {
  'd017-task-02': 'manual_copy',
  'd034-task-01': 'black_random',
  'd039-task-03': 'documented_cases',
  'd065-task-03': 'manual',
  'd084-task-01': 'similar_medium_lite',
  'd099-task-01': 'c',
  'd105-task-03': 'loop_invariant',
  'd115-task-02': 'implement_now',
  'd124-task-01': 'text_analyzer',
  'd138-task-02': 'current_equivalent',
  'd156-task-01': 'post_delete_patch',
  'd168-task-03': 'test',
  'd172-task-02': 'analogous_flow',
  'd177-task-03': 'postgresql',
  'd179-task-01': 'login_and_registration',
  'd182-task-03': 'own_bug',
};
function fixture(number: number) {
  const day = source.days.find((day) => day.number === number)!;
  const requirements: ExerciseRequirements = {
    releaseId: source.release_id,
    exerciseId: day.exercise_id,
    tasks: day.tasks,
    requiresScope: false,
  };
  const submission: ExerciseSubmission = {
    tasks: day.tasks.map((task) => ({
      taskId: task.id,
      status: 'done',
      reason: '',
      choice: choices[task.id] ?? '',
    })),
    evidence:
      'local/src/solution.js — commit abc123; checked against the original criterion',
    selectedScope:
      'Selected assignment and route, including current external identifiers',
    attested: true,
    result: 'passed',
    transferPath: number === 125 ? 'go' : null,
    transferReflection: '',
    scoreEvidence: '',
    remediationNote: '',
  };
  return { day, requirements, submission };
}
const specials = source.days.flatMap((day) =>
  day.tasks
    .filter((task) => task.requirement_mode !== 'required')
    .map((task) => ({ number: day.number, ...task })),
);

describe('exercise eligibility using the complete original curriculum', () => {
  it('covers every task and every non-default rule without changing the source', () => {
    expect(source.days.flatMap((day) => day.tasks)).toHaveLength(548);
    expect(specials).toHaveLength(33);
    expect(Object.keys(choices)).toHaveLength(16);
    for (const day of source.days) {
      const { requirements, submission } = fixture(day.number);
      const before = JSON.stringify({ requirements, submission });
      expect(evaluateExercise(requirements, submission), day.id).toEqual({
        eligible: true,
        issues: [],
      });
      expect(JSON.stringify({ requirements, submission })).toBe(before);
      for (const task of day.tasks.filter((task) =>
        ['required', 'mixed'].includes(task.requirement_mode),
      )) {
        const incomplete = {
          ...submission,
          tasks: submission.tasks.filter((row) => row.taskId !== task.id),
        };
        expect(
          evaluateExercise(requirements, incomplete).eligible,
          task.id,
        ).toBe(false);
      }
    }
  });
  it.each(specials)(
    '$id enforces its published $requirement_mode interpretation',
    (task) => {
      const { requirements, submission } = fixture(task.number);
      const row = submission.tasks.find((row) => row.taskId === task.id)!;
      if (task.requirement_mode === 'alternative') {
        row.choice = '';
        expect(evaluateExercise(requirements, submission).eligible).toBe(false);
        row.choice = 'an_unpermitted_shortcut';
        expect(evaluateExercise(requirements, submission).eligible).toBe(false);
        row.choice = choices[task.id]!;
        expect(evaluateExercise(requirements, submission).eligible).toBe(true);
        submission.selectedScope = '  ';
        expect(evaluateExercise(requirements, submission).eligible).toBe(false);
      } else if (task.requirement_mode === 'conditional') {
        row.status = 'not_applicable';
        row.reason = '  ';
        expect(evaluateExercise(requirements, submission).eligible).toBe(false);
        row.reason =
          'Selected environment or official assignment does not support this step; required objective covered in evidence.';
        expect(evaluateExercise(requirements, submission).eligible).toBe(
          task.number !== 125,
        );
      } else if (task.requirement_mode === 'optional') {
        submission.tasks = submission.tasks.filter(
          (row) => row.taskId !== task.id,
        );
        expect(evaluateExercise(requirements, submission).eligible).toBe(
          task.number !== 125,
        );
      } else {
        row.status = 'not_applicable';
        row.reason = 'I skipped the whole task because one clause is optional';
        expect(evaluateExercise(requirements, submission).eligible).toBe(false);
        row.status = 'done';
        row.reason = '';
        expect(evaluateExercise(requirements, submission).eligible).toBe(true);
      }
    },
  );
  it.each([7, 28, 182])(
    'keeps failed/undecided assessment day %i incomplete',
    (number) => {
      const { requirements, submission } = fixture(number);
      for (const result of ['needs_review', null] as const) {
        submission.result = result;
        expect(
          evaluateExercise(requirements, submission).issues,
        ).toContainEqual({ code: 'passed_result_required' });
      }
    },
  );
  it('requires evidence, criterion attestation and trusted assignment scope independently', () => {
    const { requirements, submission } = fixture(1);
    expect(
      evaluateExercise(requirements, { ...submission, evidence: '\n\t ' })
        .eligible,
    ).toBe(false);
    expect(
      evaluateExercise(requirements, { ...submission, attested: false })
        .eligible,
    ).toBe(false);
    expect(
      evaluateExercise(
        { ...requirements, requiresScope: true },
        { ...submission, selectedScope: ' ' },
      ).eligible,
    ).toBe(false);
    expect(
      evaluateExercise(requirements, { ...submission, selectedScope: '' })
        .eligible,
    ).toBe(true);
    // Evidence is self-reported text; no URL fetch, local file inspection or grading.
    expect(
      evaluateExercise(requirements, {
        ...submission,
        evidence: 'C:\\nonexistent\\exercise.js',
      }).eligible,
    ).toBe(true);
  });
  it.each([
    [115, 'd115-task-02', 'odin_later'],
    [177, 'd177-task-03', 'known_course_database'],
    [179, 'd179-task-01', 'login_only'],
  ] as const)(
    'requires a recorded plan/reason for day %i deferred or reduced scope',
    (number, id, choice) => {
      const { requirements, submission } = fixture(number);
      const row = submission.tasks.find((row) => row.taskId === id)!;
      row.choice = choice;
      expect(evaluateExercise(requirements, submission).eligible).toBe(false);
      row.reason = 'Recorded scope decision and next action';
      expect(evaluateExercise(requirements, submission).eligible).toBe(true);
      submission.tasks = submission.tasks.filter((task) => task.taskId === id);
      expect(evaluateExercise(requirements, submission).eligible).toBe(false);
    },
  );
  it.each([78, 103, 134])(
    'records selected current assignment on day %i',
    (number) => {
      const { requirements, submission } = fixture(number);
      submission.selectedScope = '';
      expect(evaluateExercise(requirements, submission).eligible).toBe(false);
    },
  );
  it('requires the Day 125 reflection instead of falsely marking new-language tasks done', () => {
    const { requirements, submission } = fixture(125);
    submission.transferPath = 'existing_languages';
    submission.tasks = submission.tasks.filter(
      (task) => task.taskId !== 'd125-task-01',
    );
    const practice = submission.tasks.find(
      (task) => task.taskId === 'd125-task-02',
    )!;
    practice.status = 'not_applicable';
    practice.reason = 'Existing JS/C/Python transfer path selected';
    expect(evaluateExercise(requirements, submission).eligible).toBe(false);
    submission.transferReflection =
      'Compared binary search in previous JS/C/Python work; the invariant stays the same while types and array syntax differ.';
    expect(evaluateExercise(requirements, submission).eligible).toBe(true);
    expect(
      evaluateExercise(requirements, { ...submission, evidence: '' }).eligible,
    ).toBe(false);
    expect(
      evaluateExercise(requirements, { ...submission, selectedScope: '' })
        .eligible,
    ).toBe(false);
    practice.status = 'done';
    expect(evaluateExercise(requirements, submission).eligible).toBe(false);
  });
  it.each(['go', 'java'] as const)(
    'requires both learning and implementation for the optional %s path',
    (path) => {
      const { requirements, submission } = fixture(125);
      submission.transferPath = path;
      expect(evaluateExercise(requirements, submission).eligible).toBe(true);
      submission.tasks = submission.tasks.filter(
        (task) => task.taskId !== 'd125-task-02',
      );
      expect(evaluateExercise(requirements, submission).eligible).toBe(false);
    },
  );
  it('rejects missing transfer selection and cross-exercise transfer metadata', () => {
    const transfer = fixture(125);
    expect(
      evaluateExercise(transfer.requirements, {
        ...transfer.submission,
        transferPath: null,
      }).eligible,
    ).toBe(false);
    const ordinary = fixture(1);
    expect(
      evaluateExercise(ordinary.requirements, {
        ...ordinary.submission,
        transferPath: 'go',
      }).eligible,
    ).toBe(false);
  });
  it('rejects forged skips, choices, foreign IDs and duplicates', () => {
    const { requirements, submission } = fixture(1);
    const row = submission.tasks[0]!;
    for (const change of [
      { status: 'not_applicable', reason: 'skip' },
      { choice: 'manual' },
    ]) {
      expect(
        evaluateExercise(requirements, {
          ...submission,
          tasks: [{ ...row, ...change }, ...submission.tasks.slice(1)],
        }).eligible,
      ).toBe(false);
    }
    for (const extra of [row, { ...row, taskId: 'd002-task-01' }]) {
      expect(
        evaluateExercise(requirements, {
          ...submission,
          tasks: [...submission.tasks, extra],
        }).eligible,
      ).toBe(false);
    }
    const optional = fixture(131);
    optional.submission.tasks.find(
      (row) => row.taskId === 'd131-task-03',
    )!.status = 'not_applicable';
    expect(
      evaluateExercise(optional.requirements, optional.submission).eligible,
    ).toBe(false);
  });
  it('validates untrusted input and 2000-character text boundaries', () => {
    const { requirements, submission } = fixture(1);
    for (const input of [
      null,
      {},
      { ...submission, attested: 'true' },
      { ...submission, eligible: true },
      { ...submission, tasks: [{ ...submission.tasks[0], status: 'skipped' }] },
    ]) {
      expect(evaluateExercise(requirements, input).issues).toEqual([
        { code: 'invalid_submission' },
      ]);
    }
    for (const field of ['evidence', 'selectedScope'] as const) {
      expect(
        evaluateExercise(requirements, {
          ...submission,
          [field]: 'x'.repeat(2000),
        }).eligible,
      ).toBe(true);
      expect(
        evaluateExercise(requirements, {
          ...submission,
          [field]: 'x'.repeat(2001),
        }).eligible,
      ).toBe(false);
    }
    expect(() =>
      evaluateExercise({ ...requirements, tasks: [] }, submission),
    ).toThrow();
    expect(() =>
      evaluateExercise(
        {
          ...requirements,
          tasks: [
            {
              id: 'unknown',
              requirement_mode: 'alternative',
              completion_rule: 'unreviewed',
            },
          ],
        },
        submission,
      ),
    ).toThrow();
  });
});
