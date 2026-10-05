'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  alternativeRoutes,
  evaluateExercise,
  type ExerciseRequirements,
  type ExerciseSubmission,
} from '@/domain/exercise-requirements';
import { exerciseText as t } from '@/i18n/exercise';
import { en } from '@/i18n/en';
import { useExerciseSave, type ConfirmedExercise } from './use-exercise-save';

export function ExerciseEditor({
  itemId,
  studentId,
  requirements,
  tasks,
  initial,
}: {
  itemId: string;
  studentId: string;
  requirements: ExerciseRequirements;
  tasks: { id: string; text: string }[];
  initial: ConfirmedExercise;
}) {
  const empty: ExerciseSubmission = {
    tasks: [],
    evidence: '',
    selectedScope: '',
    attested: false,
    result: null,
    transferPath: null,
    transferReflection: '',
  };
  const work = useExerciseSave(itemId, studentId, initial, empty);
  const [reopening, setReopening] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (work.error) errorRef.current?.focus();
  }, [work.error]);
  const disabled = work.locked || work.confirmed.completed;
  const evaluation = evaluateExercise(requirements, work.draft);
  const change = (patch: Partial<ExerciseSubmission>) =>
    work.setDraft((draft) => ({ ...draft, ...patch }));
  const taskChange = (
    taskId: string,
    patch: Partial<ExerciseSubmission['tasks'][number]> | null,
  ) =>
    work.setDraft((draft) => {
      const existing = draft.tasks.find((task) => task.taskId === taskId);
      const next = draft.tasks.filter((task) => task.taskId !== taskId);
      if (patch)
        next.push({
          taskId,
          status: 'done',
          reason: '',
          choice: '',
          ...existing,
          ...patch,
        });
      return { ...draft, tasks: next };
    });
  return (
    <section
      className="section exercise-editor"
      aria-labelledby="exercise-work-title"
    >
      <h2 id="exercise-work-title">{t.title}</h2>
      <p>{t.intro}</p>
      <p role="status">
        {work.pending
          ? t.saving
          : work.dirty
            ? t.unsaved
            : work.message ||
              (work.confirmed.completed ? t.completed : t.initial)}
      </p>
      {work.error && (
        <div
          role="alert"
          tabIndex={-1}
          ref={errorRef}
          className="error-summary"
        >
          <p>{work.conflict ? t.conflict : work.error.message}</p>
          <p>{t.error}</p>
          <div className="actions">
            {work.retry && (
              <button className="button" onClick={() => void work.retry?.()}>
                {t.retry}
              </button>
            )}
            {work.conflict && (
              <>
                <button className="button" onClick={() => work.resolve(true)}>
                  {t.keep}
                </button>
                <button className="button" onClick={() => work.resolve(false)}>
                  {t.useSaved}
                </button>
              </>
            )}
            {[401, 403].includes(work.error.status) && (
              <Link target="_blank" rel="noopener noreferrer" href="/login">
                {en.login} {en.curriculum.newTab}
              </Link>
            )}
          </div>
        </div>
      )}
      {work.confirmed.completed && (
        <div className="card">
          <p>{t.completed}</p>
          {!reopening ? (
            <button
              className="button"
              disabled={work.locked}
              onClick={() => setReopening(true)}
            >
              {t.reopen}
            </button>
          ) : (
            <>
              <p>{t.reopenHelp}</p>
              <div className="actions">
                <button
                  className="button"
                  disabled={work.locked}
                  onClick={() => {
                    void work.save(false, true);
                    setReopening(false);
                  }}
                >
                  {t.confirmReopen}
                </button>
                <button className="button" onClick={() => setReopening(false)}>
                  {t.cancel}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <fieldset disabled={disabled} className="exercise-fields">
        <legend>{en.learning.practice}</legend>
        {requirements.exerciseId === 'd125-practice' && (
          <div className="card stack">
            <label htmlFor="work-transfer">{t.transfer}</label>
            <select
              id="work-transfer"
              value={work.draft.transferPath ?? ''}
              onChange={(event) =>
                change({
                  transferPath: (event.target.value ||
                    null) as ExerciseSubmission['transferPath'],
                })
              }
            >
              <option value="">{t.choose}</option>
              {(['go', 'java', 'existing_languages'] as const).map((path) => (
                <option key={path} value={path}>
                  {t[path]}
                </option>
              ))}
            </select>
            <p>{t.transferHelp}</p>
            {work.draft.transferPath === 'existing_languages' && (
              <>
                <label htmlFor="work-reflection">{t.reflection}</label>
                <textarea
                  id="work-reflection"
                  maxLength={2000}
                  value={work.draft.transferReflection}
                  onChange={(event) =>
                    change({ transferReflection: event.target.value })
                  }
                />
              </>
            )}
          </div>
        )}
        {requirements.tasks.map((task, index) => {
          const response = work.draft.tasks.find(
            (row) => row.taskId === task.id,
          );
          const options: readonly string[] =
            task.requirement_mode === 'alternative'
              ? alternativeRoutes[task.id as keyof typeof alternativeRoutes]
              : [];
          return (
            <fieldset className="card stack" key={task.id}>
              <legend>
                {index + 1}. {t[task.requirement_mode]}
              </legend>
              <p lang="sr-Latn" className="source">
                {tasks.find((row) => row.id === task.id)?.text}
              </p>
              <p className="muted" id={`help-${task.id}`}>
                <strong>{t.rule}: </strong>
                {task.completion_rule}
              </p>
              <label htmlFor={`decision-${task.id}`}>
                {index + 1}.{' '}
                {task.requirement_mode === 'conditional' ? t.decision : t.done}
              </label>
              {task.requirement_mode === 'conditional' ? (
                <select
                  id={`decision-${task.id}`}
                  aria-describedby={`help-${task.id}`}
                  value={response?.status ?? ''}
                  onChange={(event) =>
                    taskChange(
                      task.id,
                      event.target.value
                        ? {
                            status: event.target.value as
                              'done' | 'not_applicable',
                          }
                        : null,
                    )
                  }
                >
                  <option value="">{t.unchecked}</option>
                  <option value="done">{t.done}</option>
                  <option value="not_applicable">{t.notApplicable}</option>
                </select>
              ) : (
                <input
                  type="checkbox"
                  id={`decision-${task.id}`}
                  aria-describedby={`help-${task.id}`}
                  checked={response?.status === 'done'}
                  onChange={(event) =>
                    taskChange(
                      task.id,
                      event.target.checked ? { status: 'done' } : null,
                    )
                  }
                />
              )}
              {task.requirement_mode === 'alternative' && (
                <>
                  <label htmlFor={`choice-${task.id}`}>
                    {index + 1}. {t.choice}
                  </label>
                  <select
                    id={`choice-${task.id}`}
                    disabled={!response}
                    value={response?.choice ?? ''}
                    onChange={(event) =>
                      taskChange(task.id, { choice: event.target.value })
                    }
                  >
                    <option value="">{t.choose}</option>
                    {options.map((choice) => (
                      <option key={choice} value={choice}>
                        {t.choices[choice as keyof typeof t.choices]}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {(response?.status === 'not_applicable' ||
                (task.requirement_mode === 'alternative' && response)) && (
                <>
                  <label htmlFor={`reason-${task.id}`}>
                    {index + 1}. {t.reason}
                  </label>
                  <textarea
                    id={`reason-${task.id}`}
                    maxLength={2000}
                    value={response.reason}
                    onChange={(event) =>
                      taskChange(task.id, { reason: event.target.value })
                    }
                  />
                </>
              )}
            </fieldset>
          );
        })}
        <label htmlFor="work-scope">
          {t.scope}
          {requirements.requiresScope ? ' *' : ''}
        </label>
        <p id="work-scope-help">{t.scopeHelp}</p>
        <textarea
          id="work-scope"
          maxLength={2000}
          aria-describedby="work-scope-help"
          value={work.draft.selectedScope}
          onChange={(event) => change({ selectedScope: event.target.value })}
        />
        <label htmlFor="evidence">{t.evidence}</label>
        <p id="work-evidence-help">{t.evidenceHelp}</p>
        <textarea
          id="evidence"
          maxLength={2000}
          aria-describedby="work-evidence-help"
          value={work.draft.evidence}
          onChange={(event) => change({ evidence: event.target.value })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={work.draft.attested}
            onChange={(event) => change({ attested: event.target.checked })}
          />
          {t.attested}
        </label>
        <label htmlFor="work-result">{t.result}</label>
        <select
          id="work-result"
          value={work.draft.result ?? ''}
          onChange={(event) =>
            change({
              result: (event.target.value ||
                null) as ExerciseSubmission['result'],
            })
          }
        >
          <option value="">{t.unassessed}</option>
          <option value="needs_review">{t.review}</option>
          <option value="passed">{t.passed}</option>
        </select>
      </fieldset>
      {!work.confirmed.completed && (
        <>
          <div className="section" id="exercise-eligibility">
            <p>{evaluation.eligible ? t.eligible : t.incomplete}</p>
            {!evaluation.eligible && (
              <ul>
                {evaluation.issues.map((issue, index) => (
                  <li key={index}>
                    {issue.taskId
                      ? `${requirements.tasks.findIndex((task) => task.id === issue.taskId) + 1}. `
                      : ''}
                    {t.issues[issue.code]}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="actions">
            <button
              className="button"
              disabled={work.locked || !work.dirty}
              onClick={() => void work.save(false)}
            >
              {t.save}
            </button>
            <button
              className="button primary"
              aria-describedby="exercise-eligibility"
              disabled={work.locked || !evaluation.eligible}
              onClick={() => void work.save(true)}
            >
              {t.complete}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
