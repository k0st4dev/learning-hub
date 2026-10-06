# M6 step 2 — private note editor

Date: 2026-10-06. **M6 step 2 complete in the tested local development/service scope.** Implementation, automated/development HTTP checks and the recovered browser fresh-login/two-account UI gate pass. Stop for user approval before the scorecard step.

## Behavior and scope

One reusable editor appears on every enrolled full-release day, study lesson and exercise. Each has a separate owned note. Original curriculum, immutable release, schema, dependencies and licence inventory are unchanged.

- Exact plain text, including Unicode and HTML-looking text, stays inert in a labelled textarea; limit is 20,000 UTF-16 units.
- Save follows 800 ms of inactivity, blur, Save note now or intentional navigation. Saved requires the server acknowledgment. Serial saves retain text typed during a pending request.
- Failed requests preserve editable/copyable text and an exact retry payload. An old receipt is checked against the latest owned note before another draft can overwrite it. Conflicts require explicit review and replace/discard selection.
- Mount performs an uncached owned GET so cached Back/Forward server content cannot display an obsolete note as current. Typing during that read is preserved. Optional expectedStudentId on GET rejects account switches before reading another account's body.
- Shared link/Back/Forward/logout/study navigation asks editors to finish saving before leaving. A failed note flush opens an HTML dialog with Stay/Leave, Escape cancellation, focus containment and an accessible name. Existing exercise draft protection remains. Reload/browser close uses the native unsaved warning. No browser draft storage is added.
- Notes use their own revisions and never grant completion credit or write learning activity/cursor. Opening study/exercise pages still uses the existing independent Last opened operation.
- Note component keys have a note-specific prefix, preventing collision with the exercise editor. A browser duplicate-key warning discovered during verification was corrected.

## Verification

- Full suite: **294 tests / 26 files pass**, with two workers. The first unrestricted run had one existing full-source rendering timeout while other work was active; the bounded rerun passed without changing timeouts. Host contention is a possible explanation, not an established cause.
- Final focused regression after the component-key fix: **74 tests / 5 files pass** (notes editor, history protection, notes service/real routes, exercise and study editors).
- Strict TypeScript, ESLint and optimized production build pass. The two existing Turbopack filesystem-tracing warnings remain; recurring development Gzip listener warning remains tracked for M9.
- Development served audit: **20 routes, 15 note views, 77 mapped paragraphs, 15 daily/sequence views, 19 outlines**, authenticated/missing-route checks and unchanged learning state pass. This scoped audit contains no original hyperlink occurrence; full source/link evidence remains in the full suite and earlier 663-route audit. See [report](m6-step2-served-audit.json).
- Actual browser: Day 1 debounce/blur save, exact Unicode/inert HTML text, reload; distinct Day 2/day/study/exercise bodies; two-tab stale save, owned current version and explicit replacement; canceled/accepted Back, retained Forward and latest-note refresh; keyboard dialog Escape/Tab/Shift+Tab. Exercise note survives application stop, build, development-server restart on the same preview database and reload.

Screenshots: [saved exercise note](m6-notes-ui.png), [failed-save leave dialog](m6-notes-leave-dialog.png). All edits use synthetic preview accounts; normal student databases were preserved. Credentials remain only in ignored test fixtures.

## Browser recovery and closeout

The initial browser tab 21 stopped responding to control while clicking from a saved study note to Exercise. Dialog lookup returned no controllable dialog; DOM commands and closing that tab timed out. Another tab could edit/reload notes, but link/button activation and a new login form did not complete. The cause remains unestablished. At that point fresh-login and second-account UI verification were explicitly left pending.

The temporary healthy tabs were closed; stuck tab 21 could not be closed through the available tool. User MDN and Dashboard tabs were not changed. Temporary viewport override was reset. The resize observation still reported the default 1024px viewport, so no new mobile-size pass is claimed.

After the user's approval to finish verification, the recovered browser inventory no longer contained stuck tab 21. A fresh temporary tab 23 completed the following on the running preview:

1. Sign in as the original synthetic account; Day 1, study lesson and exercise each show their distinct previously saved text and Saved.
2. Navigate through the visible Study and Exercise links, then Sign out; all reach their expected pages.
3. Sign in as the second synthetic account; Day 1 has its own empty saved body, while study/exercise have no saved note. Save a distinct second-account day note; it remains separate from study/exercise.
4. Sign out and sign back in as the first account; its original day note is unchanged. Original lesson/exercise bodies were already confirmed in step 1.
5. Request a 360x800 viewport override, reload and wait for Saved. The measured CSS viewport is **288x640**, document width **276**, note field width **236**: no horizontal document overflow. Screenshot inspection confirms wrapped help/text and usable field. These are the actual observed dimensions, not a claim of 360 CSS pixels. Reset the override afterward.

The recovered UI gate passes without application code changes. No progress/completion action was invoked. Screenshot: [original account note after fresh login](m6-notes-login-verified.png). The temporary tab was closed; user tabs remain unchanged. Existing 294-test suite, 74-test final focused regression, type/lint/build/source/licence/format and served checks remain valid; this follow-up only updates evidence/documentation.

Next focused task, after separate user approval: M6 step 3 monthly scorecard backend/API. Keep scorecard, search and resource/template work outside this completed note step. Final MVP acceptance remains open.

For automated reproduction use the README test/type/lint/build commands. Against the isolated preview server, set APP_DATA_DIR to the absolute repository .tmp/m2-preview path and run:

```sh
node scripts/audit-served-curriculum.mjs --m6-step2
```

Production Playwright/axe, full browser-process shutdown, real OS reboot, screen reader, offline operation and target-OS installation remain final acceptance gates. A01–A26 are not all passed.
