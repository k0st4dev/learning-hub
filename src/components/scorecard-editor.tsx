'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  scorecardPeriodSchema,
  scorecardStateSchema,
  type ScorecardState,
} from '@/domain/scorecards';
import { allowLearningLeave } from '@/lib/learning-leave';
import { useLeaveDialog } from './use-leave-dialog';
import { useScorecardSave, scorecardDraft } from './use-scorecard-save';
import { SavedTime } from './progress-summary';

export function priorScorecardPeriod(period: string) {
  const [year, month] = period.split('-').map(Number) as [number, number];
  if (year === 1 && month === 1) return null;
  return month === 1
    ? String(year - 1).padStart(4, '0') + '-12'
    : String(year).padStart(4, '0') + '-' + String(month - 1).padStart(2, '0');
}
function ratingText(card: ScorecardState, key: string) {
  const value = card.ratings[key];
  return value === undefined
    ? 'Not assessed'
    : value + ' — ' + card.scale[value];
}
export function ScorecardEditor({
  studentId,
  timezone,
  initial,
}: {
  studentId: string;
  timezone: string;
  initial: ScorecardState;
}) {
  const router = useRouter();
  const leave = useLeaveDialog(
    'Leave with an unsaved review?',
    'This review has unconfirmed changes. Stay here to copy or save your draft. Leaving discards unconfirmed changes; an in-flight request may already have committed.',
  );
  const card = useScorecardSave(studentId, initial, leave.confirm);
  const [month, setMonth] = useState(initial.periodKey);
  const [monthError, setMonthError] = useState('');
  const [previous, setPrevious] = useState<ScorecardState | null>(null);
  const [comparisonError, setComparisonError] = useState('');
  const prior = priorScorecardPeriod(initial.periodKey);
  const [comparisonPending, setComparisonPending] = useState(!!prior);
  const [comparisonAttempt, setComparisonAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!prior) return;
    void (async () => {
      try {
        const response = await fetch(
          '/api/scorecards/' +
            prior +
            '?expectedStudentId=' +
            encodeURIComponent(studentId),
          { cache: 'no-store' },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            'Could not load the previous month. Your current draft is unchanged.',
          );
        const saved = scorecardStateSchema.parse(result.data);
        if (
          saved.periodKey !== prior ||
          JSON.stringify(saved.dimensions) !==
            JSON.stringify(initial.dimensions) ||
          JSON.stringify(saved.scale) !== JSON.stringify(initial.scale)
        )
          throw new Error('Previous review is unavailable.');
        scorecardDraft(saved, initial.dimensions);
        if (active) setPrevious(saved.revision > 0 ? saved : null);
      } catch (cause) {
        if (active) {
          setPrevious(null);
          setComparisonError(
            cause instanceof Error
              ? cause.message
              : 'Previous review is unavailable.',
          );
        }
      } finally {
        if (active) setComparisonPending(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [prior, studentId, initial.dimensions, initial.scale, comparisonAttempt]);
  return (
    <section
      className="section stack scorecard-editor"
      id="scorecard-editor"
      aria-labelledby="scorecard-editor-title"
    >
      <h2 id="scorecard-editor-title">
        Your monthly review — {initial.periodKey}
      </h2>
      <p>
        Private to your account. Use the original 0–3 scale below. Not assessed
        is separate from 0. This review does not add course completion credit.
      </p>
      <p className="muted">
        Current month follows your profile timezone: {timezone}. Save
        deliberately after reviewing your work.
      </p>
      <form
        method="get"
        className="actions"
        onSubmit={async (event) => {
          event.preventDefault();
          setMonthError('');
          if (!scorecardPeriodSchema.safeParse(month).success) {
            setMonthError('Choose a valid month (YYYY-MM).');
            return;
          }
          if (month === initial.periodKey) return;
          if (await allowLearningLeave())
            router.push(
              '/progress/scorecard?period=' + encodeURIComponent(month),
            );
        }}
      >
        <div className="field">
          <label htmlFor="scorecard-month">Review month</label>
          <input
            id="scorecard-month"
            type="month"
            name="period"
            required
            value={month}
            min="0001-01"
            max="9999-12"
            onChange={(e) => setMonth(e.target.value)}
            aria-describedby={monthError ? 'scorecard-month-error' : undefined}
          />
        </div>
        <button className="button" disabled={card.pending}>
          View month
        </button>
      </form>
      {monthError && (
        <p id="scorecard-month-error" role="alert">
          {monthError}
        </p>
      )}
      <p role="status" id="scorecard-status">
        {card.pending
          ? 'Saving…'
          : card.checking
            ? 'Checking saved review…'
            : card.error
              ? 'Could not save'
              : card.dirty
                ? 'Unsaved changes — choose Save review'
                : card.confirmed.revision
                  ? 'Saved'
                  : 'Not assessed — no review saved'}
      </p>
      {card.confirmed.updatedAt !== null && (
        <p>
          Last confirmed save:{' '}
          <SavedTime value={card.confirmed.updatedAt} timezone={timezone} />
        </p>
      )}
      <p className="muted">
        Evidence is optional plain text, up to 2,000 characters per area. You
        can enter an artifact description or a local path; files are not
        uploaded or opened.
      </p>
      {initial.dimensions.map((key, i) => (
        <fieldset className="card stack" key={key}>
          <legend>
            {i + 1}. {key}
          </legend>
          <label htmlFor={'scorecard-rating-' + i}>Rating — {key}</label>
          <select
            id={'scorecard-rating-' + i}
            value={card.draft.ratings[key] ?? ''}
            onChange={(e) =>
              card.change(
                key,
                e.target.value === '' ? null : Number(e.target.value),
              )
            }
          >
            <option value="">Not assessed</option>
            {initial.scale.map((label, value) => (
              <option key={value} value={value}>
                {value} — {label}
              </option>
            ))}
          </select>
          <label htmlFor={'scorecard-evidence-' + i}>Evidence — {key}</label>
          <textarea
            id={'scorecard-evidence-' + i}
            rows={3}
            maxLength={2000}
            value={card.draft.evidence[key] ?? ''}
            onChange={(e) => card.change(key, null, e.target.value)}
          />
        </fieldset>
      ))}
      <button
        className="button primary"
        disabled={
          card.checking ||
          card.pending ||
          !!card.retry ||
          !!card.conflict ||
          !card.dirty ||
          [401, 403].includes(card.error?.status ?? 0)
        }
        onClick={() => {
          void card.save();
        }}
      >
        Save review
      </button>
      <p className="muted">
        Saved means the local database confirmed this version. Keep or copy
        unsaved text before signing in again or closing the browser.
      </p>
      {card.error && (
        <div className="error-summary stack" role="alert">
          <p>{card.error.message}</p>
          <p>
            Your editable draft remains above. Review the saved version before
            replacing it.
          </p>
          {card.retry && (
            <button
              className="button"
              disabled={card.pending}
              onClick={() => {
                void card.retrySave();
              }}
            >
              Retry the same review save
            </button>
          )}
          {card.conflict ? (
            <>
              <h3>Latest saved review — {card.conflict.periodKey}</h3>
              <div
                className="table-scroll"
                role="region"
                aria-label="Latest saved review"
                tabIndex={0}
              >
                <table>
                  <caption>Saved version to review before replacing</caption>
                  <thead>
                    <tr>
                      <th scope="col">Area</th>
                      <th scope="col">Rating</th>
                      <th scope="col">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initial.dimensions.map((key) => (
                      <tr key={key}>
                        <th scope="row">{key}</th>
                        <td>{ratingText(card.conflict!, key)}</td>
                        <td className="whitespace-pre-wrap">
                          {card.conflict!.evidence[key] ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="actions">
                <button
                  className="button"
                  disabled={card.pending}
                  onClick={() => {
                    void card.resolve(true);
                  }}
                >
                  Save my draft over this version
                </button>
                <button
                  className="button"
                  disabled={card.pending}
                  onClick={() => {
                    void card.resolve(false);
                  }}
                >
                  Use saved review and discard my draft
                </button>
              </div>
            </>
          ) : (
            <button
              className="button"
              disabled={card.pending}
              onClick={() => {
                void card.review();
              }}
            >
              Review latest saved review
            </button>
          )}
          {[401, 403].includes(card.error.status) && (
            <Link href="/login" target="_blank" rel="noopener noreferrer">
              Sign in to the original account in a new tab
            </Link>
          )}
        </div>
      )}
      {comparisonPending ? (
        <p role="status">Checking previous month…</p>
      ) : comparisonError ? (
        <div role="alert">
          <p>{comparisonError}</p>
          <button
            className="button"
            onClick={() => {
              setComparisonPending(true);
              setComparisonError('');
              setComparisonAttempt((value) => value + 1);
            }}
          >
            Retry previous month
          </button>
        </div>
      ) : previous ? (
        <section className="stack" aria-labelledby="scorecard-comparison-title">
          <h3 id="scorecard-comparison-title">
            Previous month — {previous.periodKey}
          </h3>
          <p>
            Compare confirmed ratings; unsaved edits above are excluded. A
            missing rating remains Not assessed.
          </p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Monthly comparison"
            tabIndex={0}
          >
            <table>
              <caption>
                Confirmed reviews: {previous.periodKey} and {initial.periodKey}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">{previous.periodKey}</th>
                  <th scope="col">{initial.periodKey}</th>
                </tr>
              </thead>
              <tbody>
                {initial.dimensions.map((key) => (
                  <tr key={key}>
                    <th scope="row">{key}</th>
                    <td>{ratingText(previous, key)}</td>
                    <td>{ratingText(card.confirmed, key)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p>No saved review for the previous month. No comparison is shown.</p>
      )}
      {leave.dialog}
    </section>
  );
}
