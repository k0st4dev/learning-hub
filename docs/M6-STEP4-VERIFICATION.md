# M6 step 4 — monthly scorecard editor

Date: 2026-10-06. This focused increment adds the private scorecard editor above the preserved original scorecard content. Final MVP acceptance remains open.

## Behavior and contract

Specification sections 4–5 and 8–10; original scorecard metadata from the student's pinned release. The service contract remains [M6 step 3](M6-STEP3-VERIFICATION.md).

- All 14 original dimension keys and four exact 0–3 labels are displayed in source order. Not assessed omits the rating key; zero is a real score. Optional evidence is plain text, bounded at 2,000 UTF-16 units per area.
- The server defaults to the owner's profile-timezone YYYY-MM. The month selector allows any valid supported period. Missing enrollment, invalid/repeated month parameters and unavailable saved data have recovery links while original source remains accessible.
- Save review is explicit. Debounce, blur and navigation never silently submit a scorecard. Saved means the local database acknowledged that complete monthly snapshot. New text entered during a request remains unsaved until another deliberate save.
- Independent monthly revisions, original-account assertions and exact mutation retries use the existing protected API. A stale tab retains its draft and displays only the owned current version; replacing or discarding is explicit. Retried older acknowledgments are followed by an owned fresh read before accepting them as current.
- Cached history refreshes the owned record without overwriting new typing. Network/session/storage failures keep an editable draft, retry/review controls and an original-account login link. No draft is put in browser storage.
- Shared unsaved navigation protection waits for an in-flight save, then offers Stay or deliberate discard. The reusable native modal is also used by notes, with its existing behavior retained. Escape stays; Tab/Shift+Tab are contained and closing restores invoking focus. Browser closure has the native unsaved warning.
- Previous-month comparison appears only for an existing record (revision > 0); absent ratings remain Not assessed. It compares confirmed values and excludes unsaved current typing. Comparison-load failure has its own retry without changing the current draft.
- No progress credit, cursor/activity writes, curriculum mutation, migration or dependency changes. Original table, mapping anchors and source labels remain below the added tool.

## Automated and served checks

- 15 new editor cases cover original fields/scale, inert evidence, zero versus unassessed, complete snapshots, owned fresh history reads, explicit saving, pending typing, exact retries, network/401/403/503, stale conflicts, deliberate replacement/discard, rejected foreign-period responses, previous-month presence/absence/retry, navigation/unload guards and calendar boundaries.
- Focused editor/notes/history regression: 40 tests / 3 files pass. The existing 14 notes cases pass after extracting the shared leave dialog.
- Final complete regression: **336 tests / 29 files pass**, with two workers in 55.75 seconds, including full immutable source rendering and auth/progress/notes/scorecard regressions.
- Strict TypeScript, ESLint, formatting and optimized production build pass. Source archive verifies all ten files, six phases, 26 weeks, 182 days, 548 tasks and 2,329 mappings. Dependency licences/notices verify 560 locked dependencies and 574 supplied notice files.
- The initial full run had 335 passing tests and one 60-second source-render timeout; an isolated rerun reproduced it. The source test now indexes mappings, blocks and DOM source nodes once, keeping the same destinations, exact-text/table/link/anchor assertions and 60-second limit. Its complete 25-test file passes in 47.89 seconds. No timeout or coverage requirement was relaxed.
- Initial editor test helper/type and React lint issues were corrected before verification. The served-audit expectation was updated from 19 to 20 outlines when adding the scorecard route; it now passes.
- [Served report](m6-step4-served-audit.json): 21 pages, 20 curriculum routes, 167 mapped paragraphs, all 14 dimensions, 15 notes/study/sequence/day views and strict missing states. Reading leaves progress and cursor unchanged. Full original hyperlink/source coverage belongs to the complete integration test rather than this focused route sample.

## Browser evidence

Only synthetic accounts in `.tmp/m2-preview` were changed; normal student data was preserved.

- Fresh first-account login loaded all fourteen saved ratings and exact Unicode/HTML-looking plain evidence. Explicit Git evidence save and page reload retained the text and assessed zero.
- Two tabs loaded the same revision. First saved Git 2; second tried 3 and received a visible conflict, retained 3 in its input and displayed the owned saved 2. Use saved review deliberately adopted 2.
- With unsaved evidence, keyboard month selection opened the leave modal. Default Stay focus, reverse/forward Tab wrapping, Escape, focus restoration to View month and retained draft were observed. Deliberate Leave opened the new month without autosaving the discarded text.
- September was initially absent. Explicit Git 0 save created that month; October comparison then showed September 0 versus October 2, while all other September areas remained Not assessed.
- Fresh second-account login showed fourteen empty ratings/evidence. Its Git 1/evidence save was independent of the first account.
- Native month `fill` changed the browser's displayed value without committing the controlled change in this automation host; ordinary arrow-key input successfully selected the month. A strict alert locator initially matched Next's route announcer too; scoping it to the scorecard resolved the observation. No application workaround or security bypass was added.

- The owned development process was stopped; the optimized build completed and a new development process reopened the same preview database. Fresh first-account login retained October Git 2/exact evidence and the September Git 0 comparison. Fresh second-account login retained only its own Git 1/evidence, with thirteen other dimensions unassessed/empty.
- Desktop screenshot shows the selected October month and confirmed Saved status: [UI evidence](m6-scorecard-ui.png).
- Basic narrow-screen check requested 360×800; the host measured 288×640 CSS pixels. Document width was 276, editor width 236, evidence field width 186.4 and month input width 164; no fieldset horizontal overflow. The temporary viewport override was reset.
- A tab cached the browser's connection-refused page during the operator restart, and the browser policy refused that data URL. A fresh tab at the normal local login URL recovered; no browser warning or policy was bypassed. Temporary working tabs were closed. This is application-process restart evidence, not an OS reboot or full browser shutdown.

## Limits and next focused task

Next, after approval: M6 step 5, original scorecard review reminders after weeks 4/8/12/16/20/24 and the final exam. Reuse owned current-month logic and existing checkpoint/progress models. Prompts must be advisory, add no credit or completion lock, and never overwrite assessments automatically. Search/resources/templates follow separately.

Production startup/Playwright/axe, real OS reboot/full browser shutdown, screen-reader/offline and clean target-OS installation gates remain pending as previously recorded. A01–A26 are not all passed. Existing build/filesystem and development streaming warnings remain tracked. Local commits still require normal PowerShell push because the agent's configured network proxy is blocked; no push was attempted here.

The old ignored `.tmp/m6-scorecards-http-state.json` expected snapshots precede these UI edits. Do not rerun its old verify phase against the modified fixtures. Use its synthetic credentials for focused UI checks or generate a new save/verify pair. Never print or commit the credential file.
