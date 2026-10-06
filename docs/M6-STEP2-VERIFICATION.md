# M6 step 2 — private note editor

Date: 2026-10-06. Implementation and automated/development HTTP checks pass. Desktop note-save/conflict/history checks pass; the final fresh-login/two-account UI check remains pending after browser-control failure. Do not close this step or start the scorecard yet.

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

## Remaining gate and reproduction

Browser tab 21 stopped responding to control while clicking from a saved study note to Exercise. Dialog lookup returned no controllable dialog; DOM commands and closing that tab timed out. Another tab could edit/reload notes, but link/button activation and a new login form did not complete. The cause is unestablished. No fresh-login or second-account UI pass is claimed. Existing owned service/real-route isolation tests and M6 step 1 two-account restart/fresh-login HTTP audit pass; they do not replace the pending UI check.

The temporary healthy tabs were closed; stuck tab 21 could not be closed through the available tool. User MDN and Dashboard tabs were not changed. Temporary viewport override was reset. The resize observation still reported the default 1024px viewport, so no new mobile-size pass is claimed.

Next focused task: reopen the in-app browser, then verify saved notes after logout/fresh login, second-account separation, clean day/study/exercise link navigation and one basic narrow-screen reflow. Investigate only a reproducible application failure; do not bypass browser security or change progress semantics based on the control timeout. Stop for approval after this gate. Scorecard backend/API is the following separate step.

For automated reproduction use the README test/type/lint/build commands. Against the isolated preview server, set APP_DATA_DIR to the absolute repository .tmp/m2-preview path and run:

```sh
node scripts/audit-served-curriculum.mjs --m6-step2
```

Production Playwright/axe, full browser-process shutdown, real OS reboot, screen reader, offline operation and target-OS installation remain final acceptance gates. A01–A26 are not all passed.
