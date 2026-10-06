# M6 step 3 — monthly scorecard service/API

Date: 2026-10-06. **Backend increment complete in the tested local development/service scope.** The existing original scorecard page remains a reading view; its editor is the next separately approved step. Final MVP acceptance remains open.

## Source and contract

Specification sections 4–5, 8–10: original 14 dimensions, exact 0–3 scale, unassessed distinct from zero, student-timezone YYYY-MM default, private owned enrollment, no progress weighting, revision/conflict recovery and durable local storage.

- Definitions come from scorecard-definition metadata in the student's pinned published release. No duplicated curriculum labels, release edits, schema changes or dependencies.
- Dimension keys are the exact original labels, returned in source order alongside the original four scale labels. Ratings and evidence are sparse keyed maps: an omitted rating means unassessed; zero remains an explicit original rubric score. Empty maps deliberately clear assessment/evidence while retaining the record and timestamps.
- Each save is a complete snapshot of the selected month, not a patch. Both maps are required. Foreign keys, null/string/fraction/out-of-range ratings, forged ownership/release fields and malformed periods are rejected.
- Minor decisions: plain evidence is limited to 2,000 UTF-16 units per dimension, following the specification's general evidence bound. Text is preserved exactly; paths/URLs/HTML-looking text are not opened or executed. Valid calendar months 0001–9999 may be selected explicitly, without a date/progress lock.
- The current period uses the profile timezone and Gregorian calendar. Invalid profile timezone fails visibly with 503 rather than silently selecting a server-local month; explicitly selected valid months remain readable.
- Independent enrollment/month revision: absent record has revision 0/null timestamps; first save is revision 1; updates retain createdAt. A save and its enrollment-scoped, scorecard-domain receipt commit together under an immediate SQLite transaction.
- Source-ordered maps produce a canonical request hash. Exact retries return the original acknowledgment even after newer edits; fresh reads return the latest month. New stale requests return 409 with only the owned current state. Reused mutation IDs cannot replay note/progress responses. An original-account assertion protects stale read/write forms but never grants ownership.
- No learning credit, preparation/task/progress revision, cursor or activity-event changes.

## Endpoints

- GET /api/scorecards: current student-timezone month.
- GET /api/scorecards/:periodKey: selected month, including an absent historical month without creating records.
- PUT /api/scorecards/:periodKey: strict periodKey, mutationId, expectedStudentId, expectedRevision, ratings and evidence. Body month must match the URL.
- Reads accept optional expectedStudentId for stale-form detection. All endpoints enforce local Host/Origin and live sessions; writes require signed session-bound CSRF. Responses are no-store. Only scorecard PUT permits 262,144 request bytes, accommodating all fourteen maximum JSON-escaped evidence fields; other endpoint limits are unchanged.

## Verification

- **27 new tests**: 14 unit cases (calendar boundaries, UTC/year/month rollover, Ljubljana DST, New York repeated hour, invalid dates/zones/months, source ordering/zero) and 13 full-release integration/real-route cases.
- **321 tests / 28 files pass** with two workers, including full source rendering and existing progress/notes/auth regressions.
- Real database/service/route tests cover all original definitions, all fourteen scores, exact Unicode/inert text, unassessed versus zero, clear/update timestamps, timezone defaults, independent periods, two users, stale-account guards, missing enrollment, pinned definition/unavailable recovery, session revocation/expiry, canonical exact retries/stale conflicts, cross-note receipt collisions, atomic rollback, database reopen/fresh login and integrity/foreign-key checks.
- HTTP boundary tests cover no-store/current-month read-only state, selected-month save/read/replay/409, CSRF/Origin/Host/auth rejection, malformed JSON/path mismatch/oversized input, all fourteen 2,000-unit escaped fields and a safe 503 on simulated storage failure.
- Initial checks found a test header-union typing error and an expiry fixture violating the existing database timestamp constraint. Both test fixtures were corrected; focused 27-test and complete 321-test reruns pass. No constraint or timeout was weakened.
- Strict TypeScript, ESLint, formatting and optimized production build pass. Original source archive and dependency notices remain verified. The two existing Turbopack filesystem-tracing warnings remain tracked.
- Actual development HTTP save phase creates two uniquely named synthetic accounts only in .tmp/m2-preview, checks all fourteen scores/exact evidence, retry/conflict/validation/account separation and unchanged learning snapshots. Server stopped, production build completed, and the same preview database was reopened by a new development process. Verify phase signs in afresh, confirms exact records/receipt replay/second-account absence and unchanged learning snapshots. See [HTTP report](m6-step3-http-audit.json).

Reproduce against an isolated preview:

```sh
# Set APP_DATA_DIR to the absolute repository .tmp/m2-preview path.
node scripts/audit-scorecards.mjs save
# Stop/restart the application on the same preview database.
node scripts/audit-scorecards.mjs verify
```

The ignored .tmp/m6-scorecards-http-state.json stores synthetic credentials and expected states; never commit or print it. This audit does not reset student data. Normal data and the earlier M1/notes/exercise fixtures are preserved.

## Next scope and limits

After approval, implement the monthly scorecard editor: original scale/dimensions, explicit unassessed option, selected month, per-dimension evidence, confirmed save/retry/conflict feedback, draft/navigation protection and comparison only when the previous period exists. Reuse the notes/progress infrastructure and these service contracts. Review reminders after weeks 4/8/12/16/20/24/final exam remain part of the forthcoming scorecard experience.

No scorecard UI/browser/mobile pass is claimed in this backend step. Operator server restart is not a real OS reboot. Production Playwright/axe/startup, full browser shutdown, screen-reader/offline/target-OS installation and later-feature acceptance gates remain pending. A01–A26 are not all passed.
