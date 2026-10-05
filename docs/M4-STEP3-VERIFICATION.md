# M4 step 3 — full-course exercise editor

Verified 2026-10-05. This focused step is complete; M4 and final MVP acceptance remain open.

## Delivered

All 182 published exercises use the shared editor and the M4 step 2 atomic API. Original Serbian task text and criterion remain unchanged; additional rule guidance is labelled separately. Required, optional, conditional, alternative and mixed decisions, reasons, selected scope, evidence, attestation, self-assessment and Day 125 transfer/reflection are supported. The shared evaluator gates completion; the server independently validates it.

Partial work saves explicitly. Confirmed completion locks editing until explicit Reopen/Confirm; Cancel writes nothing. Reading does not complete work. Saved responses restore from SQLite. Pending saves prevent duplicate clicks; uncertain saves retry the identical mutation receipt. Errors retain the draft. Revision conflicts offer explicit keep-draft/rebase or discard/use-saved choices, including preserving a draft when the other tab completed the exercise. Expired/changed accounts can sign in in another tab and retry without losing input. An expected student ID prevents a stale form from saving into another account after a session switch; ownership still derives exclusively from the server session.

No dependency, migration, published-content or licence changes. Unsaved changes warn on normal navigation links, reload/close and sign-out. Browser Back/Forward client-side history guarding is not implemented in this step and remains an integration follow-up; save explicitly before using browser history. Unsaved text is in memory, not durable browser storage.

## Evidence

- 175 unit/integration tests across 15 files pass. Eleven new editor tests cover draft restore, all five task modes, completion gating, explicit reopen/cancel, uncertain retry, validation focus, conflict resolution, completed-in-another-tab recovery, pending duplicate prevention, unsaved leave warnings and changed-account recovery. Integration coverage also rejects a mismatched expected account before any writes, and retains existing restart/two-user/rollback/published-rule tests.
- Strict TypeScript and ESLint pass. Production build passes with the two previously recorded dynamic filesystem tracing warnings.
- Source archive verification passes all ten files and unchanged inventory. Full source-rendering integration coverage retains all 2329 mappings and 19 hyperlink occurrences; no immutable release changes.
- Focused development HTTP regression passes 17 pages, 62 source mappings, 15 daily/navigation views, 16 outlines and 17 navigation shells. Authenticated access, missing-page statuses and unchanged progress on reading pass. This subset contains no original hyperlinks; full hyperlink coverage is in the integration suite. See m4-step3-served-audit.json.
- Actual browser, isolated .tmp/m2-preview database: Day 125 existing-language path; optional task unchecked, conditional task Not applicable with reason, reflection/scope/evidence; Save draft → reload → text restored → fulfill required criterion → complete → reload → completed/locked; Reopen → Cancel retains completion; Confirm reopen unlocks retained work; complete again succeeds.
- Actual browser second synthetic account: register → sign in → start course → same Day 125 exercise has empty evidence and no completion from the first account. Service integration separately verifies both users' records remain isolated.
- Mobile 360×800 and desktop 1440×900: no horizontal document overflow. Keyboard Tab from evidence reaches attestation with a visible focus outline. Screenshots: m4-step3-exercise-mobile.png and m4-step3-exercise-desktop.png. Viewport override reset afterward.

## Remaining gates

Detailed checkpoint remediation and final-exam guidance are the next focused step. Full study/progress/Continue integration follows in M5. Production browser/axe, screen reader, real OS reboot, complete browser shutdown, disconnected-network and macOS/Linux checks remain pending. This report does not declare A01–A26 passed.
