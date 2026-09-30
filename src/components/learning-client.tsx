'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { en } from '@/i18n/en';
import { RequestError, writeApi } from '@/lib/client-api';
import type { LearningState } from '@/server/learning/read';
import type { LearningMutation } from '@/server/learning/mutate';

const basePath = '/course/software-engineer';
type Change = LearningMutation extends infer T
  ? T extends LearningMutation
    ? Omit<T, 'mutationId' | 'expectedRevision'>
    : never
  : never;
export type LearningView =
  | 'dashboard'
  | 'course'
  | 'preparation'
  | 'day'
  | 'lesson'
  | 'exercise'
  | 'progress';
export function LearningClient({
  initialState,
  view,
  itemKey,
}: {
  initialState: LearningState | null;
  view: LearningView;
  itemKey?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<RequestError | null>(null);
  const retry = useRef<LearningMutation | null>(null);
  const item = state?.items.find((item) => item.stableKey === itemKey);
  const progress = state?.exerciseProgress.find(
    (p) => p.exerciseId === item?.id,
  );
  const [evidence, setEvidence] = useState(progress?.evidenceText ?? '');
  const [attested, setAttested] = useState(!!progress?.criterionAttestedAt);
  const [result, setResult] = useState<'passed' | 'needs_review'>(
    progress?.result === 'passed' ? 'passed' : 'needs_review',
  );
  const errorRef = useRef<HTMLDivElement>(null);
  async function send(payload: LearningMutation) {
    setPending(true);
    setError(null);
    setMessage('');
    retry.current = payload;
    const plurals = {
      task: 'tasks',
      lesson: 'lessons',
      exercise: 'exercises',
      preparation: 'preparation',
    };
    const url =
      payload.kind === 'orientation' || payload.kind === 'cursor'
        ? `/api/enrollment/${payload.kind}`
        : `/api/progress/${plurals[payload.kind]}/${encodeURIComponent(payload.itemId)}`;
    try {
      const response = await writeApi<{ data: LearningState }>(
        url,
        'PUT',
        payload,
      );
      setState(response.data);
      setMessage(en.learning.saved);
      retry.current = null;
      router.refresh();
      if (payload.kind === 'orientation') router.push('/continue');
      return response.data;
    } catch (cause) {
      if (cause instanceof RequestError && [400, 422].includes(cause.status))
        retry.current = null;
      setError(
        cause instanceof RequestError
          ? cause
          : new RequestError(en.learning.error, 0),
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }
  const save = (change: Change) => {
    if (!state || pending || retry.current) return;
    return send({
      ...change,
      expectedRevision: state.revision,
      mutationId: crypto.randomUUID(),
    });
  };
  async function start() {
    setPending(true);
    setError(null);
    try {
      await writeApi('/api/enrollment', 'POST', {});
      router.push(`${basePath}/preparation`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof RequestError
          ? cause
          : new RequestError(en.learning.error, 0),
      );
    } finally {
      setPending(false);
    }
  }
  const disabled = pending || (!!error && ![400, 422].includes(error.status));
  const status = (
    <>
      <p role="status" aria-live="polite">
        {pending ? en.learning.saving : message}
      </p>
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="error-summary"
        >
          <p>{error.message}</p>
          <div className="actions">
            {state && [0, 503].includes(error.status) && (
              <button
                className="button"
                disabled={pending}
                onClick={() => retry.current && void send(retry.current)}
              >
                {en.learning.retry}
              </button>
            )}
            <button className="button" onClick={() => window.location.reload()}>
              {en.learning.refresh}
            </button>
            {error.status === 401 && (
              <Link
                href={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}
              >
                {en.login}
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
  if (!state)
    return (
      <div className="stack">
        <p>{en.learning.empty}</p>
        <button className="button primary" onClick={start} disabled={pending}>
          {en.learning.start}
        </button>
        {status}
      </div>
    );
  const summary = (
    <section className="card">
      <h2>{en.learning.progress}</h2>
      <p>
        {state.completed}/{state.total} required units · {state.percent}%
      </p>
      <progress
        max={state.total}
        value={state.completed}
        aria-label={en.learning.progress}
      />
      <p>
        {state.enrollment.releaseId.startsWith('development-')
          ? en.learning.fixture
          : state.enrollment.releaseId}
      </p>
    </section>
  );
  const navigation = (
    <nav className="actions" aria-label="Course">
      <Link className="button primary" href="/continue">
        {en.learning.continue}
      </Link>
      <Link href={basePath}>{en.courseLabel}</Link>
      <Link href={`${basePath}/preparation`}>{en.learning.preparation}</Link>
      <Link href={`${basePath}/progress`}>{en.learning.progress}</Link>
    </nav>
  );
  if (
    !state.enrollment.releaseId.startsWith('development-') &&
    ['dashboard', 'course', 'progress'].includes(view)
  )
    return (
      <div className="stack">
        {summary}
        {navigation}
        <aside className="preview-notice">
          <strong>{en.curriculum.preview}</strong>
          <p>{en.curriculum.previewHelp}</p>
        </aside>
      </div>
    );
  if (['dashboard', 'course', 'progress'].includes(view))
    return (
      <div className="stack">
        {summary}
        {navigation}
        {state.completed === state.total && (
          <section className="notice">
            <h2>{en.learning.previewComplete}</h2>
            <p>{en.learning.nextRelease}</p>
          </section>
        )}
        <section className="card">
          <h2>Day 1</h2>
          <Link href={`${basePath}/days/d001`}>
            {en.learning.reference}:{' '}
            <span lang="sr-Latn">
              {state.items.find((i) => i.stableKey === 'd001')?.title}
            </span>
          </Link>
          <ul>
            {state.units.map((unit) => (
              <li key={unit.id}>
                {unit.kind === 'lesson'
                  ? en.learning.study
                  : en.learning.practice}
                :{' '}
                {unit.complete ? en.learning.completed : en.learning.incomplete}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  if (view === 'preparation') {
    const preparations = state.items
      .filter((item) => item.kind === 'preparation')
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return (
      <div className="stack">
        <p>{en.learning.prepHelp}</p>
        <p>
          {state.preparation.length}/{preparations.length} checked
        </p>
        <fieldset disabled={disabled}>
          <legend>{en.learning.source}</legend>
          {preparations.map((item) => (
            <label className="check-row" key={item.id}>
              <input
                type="checkbox"
                checked={state.preparation.some(
                  (p) => p.preparationItemId === item.id,
                )}
                onChange={(event) =>
                  void save({
                    kind: 'preparation',
                    itemId: item.id,
                    completed: event.target.checked,
                  })
                }
              />
              <span lang="sr-Latn">{item.bodyMarkdown}</span>
            </label>
          ))}
        </fieldset>
        {status}
        <div className="actions">
          <button
            className="button primary"
            disabled={
              disabled || state.preparation.length !== preparations.length
            }
            onClick={() =>
              void save({
                kind: 'orientation',
                acknowledged: true,
                deferred: false,
              })
            }
          >
            {en.learning.acknowledge}
          </button>
          <button
            className="button"
            disabled={disabled}
            onClick={() =>
              void save({
                kind: 'orientation',
                acknowledged: true,
                deferred: true,
              })
            }
          >
            {en.learning.defer}
          </button>
        </div>
      </div>
    );
  }
  const day = state.days[0]!;
  const lesson = state.units.find(
    (u) => u.dayId === day.itemId && u.kind === 'lesson',
  )!;
  const exercise = state.units.find(
    (u) => u.dayId === day.itemId && u.kind === 'exercise',
  )!;
  const selected = view === 'exercise' ? exercise : lesson;
  const selectedItem = state.items.find((i) => i.id === selected.id)!;
  const lessonData = state.lessons.find((l) => l.itemId === lesson.id)!;
  const lessonUrl = `${basePath}/days/d001/lessons/${lesson.key}`;
  const exerciseUrl = `${basePath}/days/d001/exercises/${exercise.key}`;
  const tasks = state.items
    .filter((i) => i.parentId === exercise.id && i.kind === 'task')
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const completedAt =
    selected.kind === 'lesson'
      ? state.lessonProgress.find((p) => p.lessonId === selected.id)
          ?.completedAt
      : state.exerciseProgress.find((p) => p.exerciseId === selected.id)
          ?.completedAt;
  const sourceSection = (id: string, title: string, text: string) => (
    <section id={id} className="section">
      <h2>{title}</h2>
      <p className="eyebrow">{en.learning.source}</p>
      <p className="source" lang="sr-Latn">
        {text}
      </p>
    </section>
  );
  return (
    <div className="learning-grid">
      <aside className="stack">
        <nav className="learning-nav" aria-label="Day 1">
          <Link href={lessonUrl}>{en.learning.study}</Link>
          <Link href={exerciseUrl}>{en.learning.practice}</Link>
          <Link href={`${basePath}/progress`}>{en.learning.progress}</Link>
          <Link href="/dashboard">{en.dashboard}</Link>
        </nav>
        {summary}
      </aside>
      <div>
        <p className="muted">
          {en.learning.sourceDate}: {day.sourceDate} · {en.learning.minutes}:{' '}
          {day.estimatedMinutes}
        </p>
        <p>
          {selected.complete ? en.learning.completed : en.learning.incomplete}
          {completedAt
            ? ` · ${new Date(completedAt).toISOString().slice(0, 10)}`
            : ''}
        </p>
        <button
          className="button"
          disabled={disabled}
          onClick={() =>
            void save({
              kind: 'cursor',
              itemId: selected.id,
              mode: 'study',
              anchor: selected.kind === 'lesson' ? 'study' : 'tasks',
            })
          }
        >
          {en.learning.studyThis}
        </button>
        {view !== 'exercise' ? (
          <>
            {sourceSection(
              'study',
              en.learning.study,
              lessonData.studyInstructionMarkdown,
            )}
            {lessonData.objectiveMarkdown && (
              <p className="source" lang="sr-Latn">
                {lessonData.objectiveMarkdown}
              </p>
            )}
            {sourceSection('ai', en.learning.ai, day.aiPolicyMarkdown)}
            {sourceSection(
              'criterion',
              en.learning.criterion,
              day.completionCriterionMarkdown,
            )}
            {status}
            <div className="actions section">
              <button
                className="button primary"
                disabled={disabled}
                onClick={() =>
                  void save({
                    kind: 'lesson',
                    itemId: lesson.id,
                    completed: !lesson.complete,
                  })
                }
              >
                {lesson.complete
                  ? en.learning.reopenLesson
                  : en.learning.completeLesson}
              </button>
              {lesson.complete && (
                <Link className="button" href={exerciseUrl}>
                  {en.learning.toExercise}
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <section id="tasks" className="section">
              <h2>{en.learning.tasks}</h2>
              <p className="eyebrow">{en.learning.source}</p>
              <fieldset disabled={disabled}>
                <legend className="sr-only">{en.learning.tasks}</legend>
                {tasks.map((task) => (
                  <label
                    className="check-row"
                    id={task.stableKey}
                    key={task.id}
                  >
                    <input
                      type="checkbox"
                      checked={state.tasks.some(
                        (p) => p.taskId === task.id && p.status === 'done',
                      )}
                      onChange={(event) => {
                        if (!event.target.checked) setAttested(false);
                        void save({
                          kind: 'task',
                          itemId: task.id,
                          done: event.target.checked,
                        });
                      }}
                    />
                    <span lang="sr-Latn">{task.bodyMarkdown}</span>
                  </label>
                ))}
              </fieldset>
            </section>
            {sourceSection('ai', en.learning.ai, day.aiPolicyMarkdown)}
            {sourceSection(
              'criterion',
              en.learning.criterion,
              day.completionCriterionMarkdown,
            )}
            <section id="evidence" className="section stack">
              <h2>{en.learning.evidence}</h2>
              <p>{en.learning.evidenceHelp}</p>
              <div className="field">
                <label htmlFor="evidence-text">{en.learning.evidence}</label>
                <textarea
                  id="evidence-text"
                  value={evidence}
                  maxLength={2000}
                  disabled={pending || exercise.complete}
                  onChange={(e) => setEvidence(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="result">{en.learning.result}</label>
                <select
                  id="result"
                  disabled={disabled || exercise.complete}
                  value={result}
                  onChange={(e) =>
                    setResult(e.target.value as 'passed' | 'needs_review')
                  }
                >
                  <option value="needs_review">
                    {en.learning.needsReview}
                  </option>
                  <option value="passed">{en.learning.passed}</option>
                </select>
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={attested}
                  disabled={disabled || exercise.complete}
                  onChange={(e) => setAttested(e.target.checked)}
                />
                {en.learning.attest}
              </label>
              {status}
              <div className="actions">
                {!exercise.complete && (
                  <button
                    className="button"
                    disabled={disabled}
                    onClick={() =>
                      void save({
                        kind: 'exercise',
                        itemId: selectedItem.id,
                        completed: false,
                        evidence,
                        attested: false,
                        result,
                      })
                    }
                  >
                    {en.learning.saveEvidence}
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={disabled}
                  onClick={async () => {
                    const saved = await save({
                      kind: 'exercise',
                      itemId: exercise.id,
                      completed: !exercise.complete,
                      evidence,
                      attested,
                      result,
                    });
                    if (saved && exercise.complete) setAttested(false);
                  }}
                >
                  {exercise.complete
                    ? en.learning.reopenExercise
                    : en.learning.completeExercise}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
