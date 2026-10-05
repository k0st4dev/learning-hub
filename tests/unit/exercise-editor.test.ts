// @vitest-environment jsdom
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { validateSource } from '../../src/server/content/source-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ExerciseEditor } from '../../src/components/exercise-editor';
import { RequestError, writeApi } from '../../src/lib/client-api';
import {
  studyContext,
  type StudyContext,
} from '../../src/domain/study-context';
import type {
  ExerciseRequirements,
  ExerciseSubmission,
} from '../../src/domain/exercise-requirements';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../src/lib/client-api', async (original) => ({
  ...(await original<object>()),
  writeApi: vi.fn(),
}));
const api = vi.mocked(writeApi);
const itemId = 'se-26w-v1:d017-practice';
const empty: ExerciseSubmission = {
  tasks: [],
  evidence: '',
  selectedScope: '',
  attested: false,
  result: null,
  transferPath: null,
  transferReflection: '',
  scoreEvidence: '',
  remediationNote: '',
};
const requirements: ExerciseRequirements = {
  releaseId: 'se-26w-v1',
  exerciseId: 'd017-practice',
  requiresScope: false,
  tasks: [
    {
      id: 'd017-task-01',
      requirement_mode: 'required',
      completion_rule: 'Required original criterion',
    },
    {
      id: 'd017-task-02',
      requirement_mode: 'alternative',
      completion_rule: 'Manual or structured clone',
    },
    {
      id: 'd025-task-03',
      requirement_mode: 'conditional',
      completion_rule: 'Explain manual path if Jest is not used',
    },
    {
      id: 'd131-task-03',
      requirement_mode: 'optional',
      completion_rule: 'Optional EXPLAIN',
    },
    {
      id: 'd020-task-03',
      requirement_mode: 'mixed',
      completion_rule: 'In-memory required; JSON optional',
    },
  ],
};
const complete: ExerciseSubmission = {
  ...empty,
  tasks: requirements.tasks
    .filter((task) => task.requirement_mode !== 'optional')
    .map((task) => ({
      taskId: task.id,
      status: 'done',
      reason: '',
      choice: task.requirement_mode === 'alternative' ? 'manual_copy' : '',
    })),
  evidence: 'commit abc',
  selectedScope: 'Manual copying of nested object',
  attested: true,
  result: 'passed',
};
function state(
  submission: ExerciseSubmission,
  revision = 1,
  completed = false,
) {
  return {
    revision,
    exerciseProgress: [
      {
        exerciseId: itemId,
        status: completed ? 'completed' : 'started',
        submission,
      },
    ],
  };
}
function mount(submission = empty, completed = false, context?: StudyContext) {
  return render(
    createElement(ExerciseEditor, {
      itemId,
      studentId: 'owner',
      requirements,
      tasks: requirements.tasks.map((task) => ({
        id: task.id,
        text: `Original ${task.id}`,
      })),
      initial: {
        revision: 0,
        completed,
        submission,
        ...(context ? { context } : {}),
      },
    }),
  );
}
const evidence = () => screen.getByLabelText('Evidence') as HTMLTextAreaElement;
const button = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
beforeEach(() => {
  api.mockReset();
  api.mockImplementation(async (_url, _method, body) => {
    const data = body as {
      submission: ExerciseSubmission;
      completed: boolean;
      expectedRevision: number;
    };
    return {
      data: state(data.submission, data.expectedRevision + 1, data.completed),
    };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('full-course exercise editing', () => {
  it('keeps an unsaved exercise when study selection would leave for its lesson', async () => {
    const units = ['lesson', 'exercise'].map((kind) => ({
      id: kind === 'lesson' ? 'se-26w-v1:d017-learn' : itemId,
      key: kind === 'lesson' ? 'd017-learn' : 'd017-practice',
      kind,
      dayId: 'd017',
      dayKey: 'd017',
      dayNumber: 17,
      complete: false,
    }));
    const current = {
      ...state(empty),
      units,
      enrollment: { resumeItemId: itemId },
    };
    api.mockResolvedValue({ data: current });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mount(empty, false, studyContext(current, itemId));
    await screen.findByText('Saved on this computer.');
    fireEvent.change(evidence(), {
      target: { value: 'Unsaved implementation notes' },
    });
    fireEvent.click(button('Study this day'));
    expect(confirm).toHaveBeenCalledOnce();
    expect(api).toHaveBeenCalledTimes(1);
    expect(evidence().value).toBe('Unsaved implementation notes');
  });
  it.each([7, 28, 35, 182])(
    'saves assessment evidence and remediation for day %i without awarding completion',
    async (number) => {
      const source = validateSource(
        JSON.parse(
          readFileSync(
            'content/se-26w-v1/source/curriculum-source.json',
            'utf8',
          ),
        ),
      );
      const day = source.days.find((row) => row.number === number)!;
      render(
        createElement(ExerciseEditor, {
          itemId,
          studentId: 'owner',
          requirements: {
            releaseId: source.release_id,
            exerciseId: day.exercise_id,
            tasks: day.tasks,
            requiresScope: false,
            assessment: {
              kind: day.assessment_kind as 'weekly_checkpoint' | 'final_exam',
              dayNumber: number,
              criterion: day.completion_criterion,
              aiPolicy: day.ai_policy,
              studyInstruction: day.study_instruction,
            },
          },
          tasks: day.tasks,
          initial: { revision: 0, completed: false, submission: empty },
        }),
      );
      expect(screen.getByText(day.completion_criterion)).toBeTruthy();
      expect(screen.getByText(day.ai_policy)).toBeTruthy();
      fireEvent.change(screen.getByLabelText('Self-assessment'), {
        target: { value: 'needs_review' },
      });
      fireEvent.change(
        screen.getByLabelText('Score or rubric evidence (when applicable)'),
        { target: { value: 'Independent result: review needed' } },
      );
      fireEvent.change(screen.getByLabelText('Review and remediation note'), {
        target: { value: 'Repeat weak cases and explain the invariant' },
      });
      if (number === 7)
        expect(
          screen.getByRole('link', { name: 'Day 3' }).getAttribute('href'),
        ).toContain('/days/d003');
      if (number === 28)
        expect(screen.getByRole('link', { name: 'Week 1' })).toBeTruthy();
      if (number === 35)
        expect(screen.getByRole('link', { name: 'Week 5' })).toBeTruthy();
      if (number === 182) {
        expect(screen.getByText(day.study_instruction)).toBeTruthy();
        for (const task of day.tasks.slice(0, 3))
          expect(screen.getAllByText(task.text)).toHaveLength(2);
        expect(screen.queryByRole('timer')).toBeNull();
      }
      expect(button('Mark exercise complete').disabled).toBe(true);
      fireEvent.click(button('Save assessment'));
      await screen.findByText('Saved on this computer.');
      expect(api.mock.calls[0]![2]).toMatchObject({
        completed: false,
        submission: {
          result: 'needs_review',
          scoreEvidence: 'Independent result: review needed',
          remediationNote: 'Repeat weak cases and explain the invariant',
        },
      });
      expect(
        screen.getByLabelText('Review and remediation note').closest('fieldset')
          ?.disabled,
      ).toBe(false);
    },
  );
  it('keeps original wording separate from rule guidance and gates completion', () => {
    mount();
    expect(screen.getByText('Original d017-task-01').getAttribute('lang')).toBe(
      'sr-Latn',
    );
    expect(
      screen.getAllByText('Added rule guidance:', { exact: false }),
    ).toHaveLength(5);
    expect(button('Mark exercise complete').disabled).toBe(true);
    expect(button('Save draft').disabled).toBe(true);
    expect(
      screen.getByText('In-memory required; JSON optional', { exact: false }),
    ).toBeTruthy();
  });
  it('saves partial work with owner/revision and restores it from confirmed state', async () => {
    const view = mount();
    fireEvent.change(evidence(), { target: { value: 'local/src.js' } });
    fireEvent.click(button('Save draft'));
    await screen.findByText('Saved on this computer.');
    const sent = api.mock.calls[0]![2] as {
      submission: ExerciseSubmission;
      expectedStudentId: string;
      expectedRevision: number;
      completed: boolean;
    };
    expect(sent).toMatchObject({
      expectedStudentId: 'owner',
      expectedRevision: 0,
      completed: false,
    });
    view.unmount();
    mount(sent.submission);
    expect(evidence().value).toBe('local/src.js');
    expect(button('Mark exercise complete').disabled).toBe(true);
  });
  it('records conditional reasons and allowed alternatives without requiring optional work', async () => {
    mount();
    fireEvent.click(screen.getByLabelText('1. Done'));
    fireEvent.click(screen.getByLabelText('2. Done'));
    fireEvent.change(screen.getByLabelText('2. Chosen path'), {
      target: { value: 'manual_copy' },
    });
    fireEvent.change(screen.getByLabelText('3. Task decision'), {
      target: { value: 'not_applicable' },
    });
    fireEvent.change(screen.getByLabelText('3. Reason or plan'), {
      target: { value: 'Manual testing path' },
    });
    fireEvent.click(screen.getByLabelText('5. Done'));
    fireEvent.change(screen.getByLabelText('Selected scope'), {
      target: { value: 'Manual copy and tests' },
    });
    fireEvent.change(evidence(), { target: { value: 'commit abc' } });
    fireEvent.click(
      screen.getByLabelText(
        'My work satisfies the original completion criterion',
      ),
    );
    fireEvent.change(screen.getByLabelText('Self-assessment'), {
      target: { value: 'passed' },
    });
    expect(button('Mark exercise complete').disabled).toBe(false);
    fireEvent.click(button('Mark exercise complete'));
    await screen.findByRole('button', { name: 'Reopen exercise' });
    const sent = api.mock.calls[0]![2] as {
      submission: ExerciseSubmission;
      completed: boolean;
    };
    expect(sent.completed).toBe(true);
    expect(
      sent.submission.tasks.some((task) => task.taskId === 'd131-task-03'),
    ).toBe(false);
    expect(evidence().closest('fieldset')?.disabled).toBe(true);
  });
  it('requires an explicit reopen confirmation and does not write just by visiting', async () => {
    mount(complete, true);
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(button('Reopen exercise'));
    fireEvent.click(button('Cancel'));
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(button('Reopen exercise'));
    fireEvent.click(button('Confirm reopen'));
    await screen.findByText('Saved on this computer.');
    expect(api.mock.calls[0]![2]).toMatchObject({
      completed: false,
      submission: complete,
    });
    expect(evidence().closest('fieldset')?.disabled).toBe(false);
  });
  it('preserves the draft after an uncertain save and retries the identical receipt', async () => {
    mount();
    api.mockRejectedValueOnce(new RequestError('Network unavailable', 0));
    fireEvent.change(evidence(), { target: { value: 'Do not lose this' } });
    fireEvent.click(button('Save draft'));
    await screen.findByRole('alert');
    expect(evidence().value).toBe('Do not lose this');
    expect(evidence().closest('fieldset')?.disabled).toBe(true);
    fireEvent.click(button('Retry the same save'));
    await screen.findByText('Saved on this computer.');
    expect(api.mock.calls[1]![2]).toEqual(api.mock.calls[0]![2]);
  });
  it('keeps validation failures editable and focuses the error', async () => {
    mount();
    api.mockRejectedValueOnce(new RequestError('Record a reason', 422));
    fireEvent.change(evidence(), { target: { value: 'Draft' } });
    fireEvent.click(button('Save draft'));
    const alert = await screen.findByRole('alert');
    expect(document.activeElement).toBe(alert);
    expect(evidence().closest('fieldset')?.disabled).toBe(false);
    expect(evidence().value).toBe('Draft');
  });
  it('preserves conflicting edits until explicitly rebased or discarded', async () => {
    mount();
    api.mockRejectedValueOnce(
      new RequestError(
        'Conflict',
        409,
        {},
        state({ ...empty, evidence: 'Other tab' }, 7),
      ),
    );
    fireEvent.change(evidence(), { target: { value: 'My edits' } });
    fireEvent.click(button('Save draft'));
    await screen.findByRole('alert');
    expect(evidence().value).toBe('My edits');
    fireEvent.click(button('Keep my draft and use the latest revision'));
    fireEvent.click(button('Save draft'));
    await screen.findByText('Saved on this computer.');
    expect(api.mock.calls[1]![2]).toMatchObject({
      expectedRevision: 7,
      submission: { evidence: 'My edits' },
    });
  });
  it('can explicitly use another tab’s saved work', async () => {
    mount();
    api.mockRejectedValueOnce(
      new RequestError(
        'Conflict',
        409,
        {},
        state({ ...empty, evidence: 'Other saved work' }, 4),
      ),
    );
    fireEvent.change(evidence(), { target: { value: 'My edits' } });
    fireEvent.click(button('Save draft'));
    await screen.findByRole('alert');
    fireEvent.click(button('Use saved version and discard my edits'));
    expect(evidence().value).toBe('Other saved work');
    expect(button('Save draft').disabled).toBe(true);
  });
  it('keeps edits when a conflict requires explicitly reopening a completed exercise', async () => {
    mount();
    api.mockRejectedValueOnce(
      new RequestError('Conflict', 409, {}, state(complete, 8, true)),
    );
    fireEvent.change(evidence(), { target: { value: 'Unsent edits' } });
    fireEvent.click(button('Save draft'));
    await screen.findByRole('alert');
    fireEvent.click(button('Keep my draft and use the latest revision'));
    fireEvent.click(button('Reopen exercise'));
    fireEvent.click(button('Confirm reopen'));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(evidence().closest('fieldset')?.disabled).toBe(false),
    );
    expect(api.mock.calls[1]![2]).toMatchObject({
      completed: false,
      submission: complete,
      expectedRevision: 8,
    });
    expect(evidence().value).toBe('Unsent edits');
    fireEvent.click(button('Save draft'));
    await screen.findByText('Saved on this computer.');
    expect(api.mock.calls[2]![2]).toMatchObject({
      expectedRevision: 9,
      submission: { evidence: 'Unsent edits' },
    });
  });
  it('blocks duplicate pending clicks and warns before discarding unsaved edits', async () => {
    mount();
    fireEvent.change(evidence(), { target: { value: 'Pending work' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const leave = new Event('learning:before-leave', { cancelable: true });
    document.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalled();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    let resolve!: (value: unknown) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    fireEvent.click(button('Save draft'));
    fireEvent.click(button('Save draft'));
    expect(api).toHaveBeenCalledTimes(1);
    resolve({ data: state({ ...empty, evidence: 'Pending work' }) });
    await waitFor(() => expect(button('Save draft').disabled).toBe(true));
  });
  it('locks a draft if the account changes instead of sending it to another student', async () => {
    mount();
    api.mockRejectedValueOnce(new RequestError('Account changed', 403));
    fireEvent.change(evidence(), { target: { value: 'Private draft' } });
    fireEvent.click(button('Save draft'));
    await screen.findByRole('alert');
    expect(evidence().value).toBe('Private draft');
    expect(button('Save draft').disabled).toBe(true);
    fireEvent.click(button('Retry the same save'));
    await screen.findByText('Saved on this computer.');
    expect(api.mock.calls[1]![2]).toEqual(api.mock.calls[0]![2]);
  });
});
