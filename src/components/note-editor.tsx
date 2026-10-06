'use client';
import Link from 'next/link';
import { noteCharacterLimit, type NoteState } from '@/domain/notes';
import { useNoteSave } from './use-note-save';
import { useLeaveDialog } from './use-leave-dialog';
export function NoteEditor({
  studentId,
  initial,
  kind,
}: {
  studentId: string;
  initial: NoteState;
  kind: 'day' | 'lesson' | 'exercise';
}) {
  const leave = useLeaveDialog(
    'Leave with an unsaved note?',
    'This note has unconfirmed text. Stay here to copy it or retry saving. Leaving discards the unconfirmed text.',
  );
  const note = useNoteSave(studentId, initial, leave.confirm);
  const context =
    kind === 'day' ? 'day' : kind === 'lesson' ? 'study lesson' : 'exercise';
  return (
    <section id="notes" className="section stack" aria-labelledby="notes-title">
      <h2 id="notes-title">Private notes</h2>
      <p id="notes-help">
        Your notes for this {context}. Only your account can read them. Notes
        for the day, study lesson and exercise are separate. They do not add
        completion credit.
      </p>
      <label htmlFor="note-body">My note</label>
      <textarea
        id="note-body"
        rows={8}
        maxLength={noteCharacterLimit}
        value={note.draft}
        aria-describedby="notes-help note-count note-status"
        onChange={(event) => note.change(event.target.value)}
        onBlur={() => {
          void note.flush();
        }}
      />
      <p id="note-count" className="muted">
        {note.draft.length.toLocaleString('en-US')} / 20,000 characters
      </p>
      <p id="note-status" role="status">
        {note.pending
          ? 'Saving…'
          : note.checking
            ? 'Checking saved note…'
            : note.error
              ? 'Could not save'
              : note.dirty
                ? 'Unsaved changes — waiting to save'
                : note.confirmed.revision
                  ? 'Saved'
                  : 'No note saved yet'}
      </p>
      <p className="muted">
        Saves after a short pause or when you leave the field. Saved means
        confirmed by this local installation. Keep or copy unconfirmed text
        before closing the browser.
      </p>
      <div className="actions">
        <button
          className="button"
          disabled={
            note.pending || !!note.retry || !!note.conflict || !note.dirty
          }
          onClick={() => {
            void note.save();
          }}
        >
          Save note now
        </button>
      </div>
      {note.error && (
        <div className="error-summary stack" role="alert">
          <p>{note.error.message}</p>
          <p>
            Your draft remains in My note. You can select and copy it before
            signing in or leaving.
          </p>
          {note.retry && (
            <button
              className="button"
              disabled={note.pending}
              onClick={() => {
                void note.retrySave();
              }}
            >
              Retry the same note save
            </button>
          )}
          {note.conflict ? (
            <>
              <label htmlFor="note-saved-version">Latest saved note</label>
              <textarea
                id="note-saved-version"
                rows={5}
                readOnly
                value={note.conflict.body}
              />
              <p>
                Saving your draft replaces the saved text shown above. A newer
                change will require another review.
              </p>
              <div className="actions">
                <button
                  className="button"
                  disabled={note.pending}
                  onClick={() => {
                    void note.resolve(true);
                  }}
                >
                  Save my draft over this version
                </button>
                <button
                  className="button"
                  disabled={note.pending}
                  onClick={() => {
                    void note.resolve(false);
                  }}
                >
                  Use saved note and discard my draft
                </button>
              </div>
            </>
          ) : (
            <button
              className="button"
              disabled={note.pending}
              onClick={() => {
                void note.reviewSaved();
              }}
            >
              Review latest saved note
            </button>
          )}
          {[401, 403].includes(note.error.status) && (
            <Link href="/login" target="_blank" rel="noopener noreferrer">
              Sign in to the original account in a new tab
            </Link>
          )}
        </div>
      )}
      {leave.dialog}
    </section>
  );
}
