# M5 step 4 — recent activity and Progress history

Verified 2026-10-06. This focused step is complete. The final MVP and full A01–A26 acceptance remain open.

## Behavior and decisions

Dashboard shows the latest five meaningful transitions after the current module/week/day panel, with a link to full Progress history. Progress shows newest-first history in pages of twenty events, Older activity and View newest activity. Paging is a read-only GET and does not create or change progress, active study, reference visits or completion dates.

The separate owned reader queries the authenticated student's enrollment only. It returns event ID/type/stable content key/time, without private event payloads or another student's identifiers. Ownership is also checked when resolving a pagination cursor. Invalid, repeated, missing or foreign cursors give the same unavailable-page message and a newest-history recovery link. Genuine database/read failures reach the existing error boundary, rather than appearing as empty history. New students have a distinct empty state; an empty older page has separate copy.

Events are ordered by occurrence time and descending SQLite insertion position for equal timestamps, including multiple events committed in one transaction. Keyset pagination uses an owned event UUID to resolve both values. Newer writes do not shift an already linked older page. The existing append-only event table needs no migration. The reader is intentionally separate from mutation snapshots and historical receipts; original request hashes and exact retry responses remain compatible.

All ten existing event types have centralized labels. Titles and links come only from the enrolled release's snapshot, preserving original language and `sr-Latn` markup. Required units link to their lesson/exercise; day events link to the day and course events to the overview. An unavailable archived item is explicitly labeled without an invented link. Each event has a semantic time element and the profile's selected timezone. Page views, task drafts, section anchors, reference visits and exact duplicate receipts do not add transitions. Reopening retains earlier completions in history while canonical current progress recalculates normally.

No dependency, licence, paid service, migration, published curriculum or source archive changed. Existing student data and release pins are preserved.

## Verification

- All **227 unit/integration tests across 21 files** pass. Nine new cases cover session/enrollment/query guards, empty versus failed reads, same-timestamp insertion order, latest-five reads, twenty-event paging, concurrent newer writes, complete/reopen/day/course history, duplicate receipts, database reopening/login, account isolation, pinned titles, all ten labels, dates/timezones, archived fallback, recovery/navigation and Dashboard section order. Existing full-release checkpoint tests now also assert retained Needs review/completion/reopening history and no exposed score/remediation payloads.
- Existing full source-rendering integration remains green: all 2329 mappings, 19 original hyperlink occurrences and unique section/task anchors on all 364 required units. Source-integrity verification confirms ten unchanged archived files, six phases, 26 weeks, 182 days, 548 tasks and seven preparation items. No separate all-663-route served rerun was necessary for this focused Dashboard/Progress addition; prior full served coverage remains recorded in M3.
- Strict TypeScript, ESLint, formatting and production build pass. Two existing Turbopack filesystem-tracing warnings remain; the tracked development Gzip listener warning also occurred during large streamed responses. No warning suppression or unrelated runtime changes were made. Licence verification retains 560 locked dependencies and 574 supplied notices.
- Actual isolated development HTTP/API audit passes: latest five match full history's first five; twenty-event pages; all **72 retained synthetic transitions across four pages**, with no overlap; original titles and profile timezone; exact receipt retries; no cursor-visit activity; malformed/repeated/unknown/foreign cursor recovery; unchanged current progress and reference/active state during reads; unchanged second-student records/history; logout/fresh login. The audit account accumulates retained transitions on reruns; nothing is reset. Evidence: `m5-step4-http-audit.json`.
- Stop development server → production build → start development server against the same SQLite directory → fresh login: exact revision, zero current completion credit and all twenty newest event IDs/types/titles/timestamps match the pre-restart report. `serverRestartAndFreshLogin` is passed. This is an application-process restart, not an actual computer reboot or production-server runtime test.
- Actual browser using the existing synthetic UI account: Dashboard displays five transitions; keyboard Enter on View full Progress history opens all eight existing completion/reopening/checkpoint events. Desktop 1440×900 and mobile 360×800 have no document horizontal overflow. Keyboard Tab advances between original day/lesson links. The account remains at 2/364 with Day 2 exercise active; browser history reads do not add completion. Screenshots: `m5-step4-activity-desktop.png` and `m5-step4-activity-mobile.png`. HTTP tests exercise actual older-page navigation; browser inspection used the smaller eight-event account. These are focused checks, not a complete screen-reader/axe certification.

The HTTP harness assembles only literal React `$RS` stream segments before querying HTML; it never executes page scripts. Initial audit attempts exposed this missing assembly in the harness, which is corrected. ESLint also required moving JSX construction outside the read's try/catch; only the synchronous data-read error is caught.

## Reproduction

Start the development server with `APP_DATA_DIR` set to the repository's absolute `.tmp/m2-preview` path. From the repository, using the pinned Node runtime:

```sh
node scripts/audit-activity.mjs
```

This creates its reusable synthetic account only when needed and uses the existing synthetic UI account as the isolation control. It refuses the normal student-data directory. Stop/start the server without rerunning setup, then:

```sh
node scripts/audit-activity.mjs --verify-restart
```

## Remaining work

After separate approval, M5 step 5 handles unsaved exercise drafts during browser Back/Forward, retaining current save/retry/conflict behavior. The M5 integration gate follows. Notes/search/scorecard entry/profiles/recovery/backup/update tooling remain later milestones. Production browser/axe, screen reader, actual OS reboot, disconnected-network and cross-platform clean installs remain final gates.
