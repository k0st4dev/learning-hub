# M5 step 3 — acknowledged section and task resume

Verified 2026-10-05. This focused step is complete. The final MVP and full A01–A26 acceptance remain open.

## Behavior and decisions

Dedicated study and exercise pages now have explicit section navigation. The shared pinned-content allowlist contains Study/AI/criterion for lessons and Tasks/original task keys/AI/criterion/Evidence for exercises. Original source IDs remain unchanged and unique; product sections add separate AI/criterion/tasks IDs. The evidence destination appears only when the exercise editor is available. Day overview does not track sections; its Saved section link opens the dedicated unit.

Scroll, keyboard focus, section links and hash changes select the current section. Section changes are debounced for one second. Only the explicitly active incomplete unit can update its anchor. Reference and completed browsing cannot activate work. The new cursor mode changes resume fields and enrollment revision only; it leaves Last opened, task work, progress and transition history unchanged. Existing open/study behavior and historical receipt hashes are preserved.

Section saves share ownership, expected account, revision, transaction, idempotency, confirmed response, retry and conflict handling with exercise saves. A newer section waits for a pending write and then uses its acknowledged revision. Uncertain saves lock further writes and retry the identical receipt. Conflicts require explicit resolution and discard queued section writes. Unmount cancels an unacknowledged debounce. Manual progress saves cancel queued anchors and persist their anchor immediately in the same transaction. Exercise saves use the last edited task/field; scrolling to the Save button does not replace that action's task anchor. Existing lesson/reopen defaults remain intact.

Background section saves preserve drafts and typing focus; progress actions stay disabled during the request. An uncertain or rejected request locks editing through the existing feedback. Cursor open/anchor acknowledgments update local confirmed state without unnecessary page refreshes; the API still revalidates overview pages after every successful mutation. Section links use the router so later navigation does not restore an obsolete URL hash.

Saved section shows only server-confirmed state. Resume restores an allowlisted hash or the active unit's acknowledged section with scroll and keyboard focus after opening is acknowledged. It restores original task destinations with persisted checkboxes in the exercise editor, and handles the final evidence section even when the page cannot position it at the exact top. Unknown stored sections fall back to Study/Tasks. Exact pixels and unacknowledged text are not promised.

No dependency, licence, migration, published curriculum or source archive changed. Existing student records and release pins are preserved.

## Verification

- All 218 unit/integration tests across 19 files pass. Sixteen added cases cover exact one-second debounce/latest section, section links without hashchange, scroll selection, saved task/focus restore, incoming/unsupported hashes, final-section positioning, reference/completed exclusion, immediate action anchors, serialized writes, typing during background saves, uncertain exact retry, 401/403 locks, stale conflicts, unmount, owned allowlists, reference timestamps/history, no credit, database reopening/login and atomic exercise anchors. Existing source, account, receipt/rollback, completion/reopen and assessment tests remain green. Final relevant regression after typing-lock refinement: 40 tests across four files pass.
- Full source-rendering integration now also asserts unique allowlisted Study/AI/criterion/Tasks/original task destinations across all 364 required unit routes. All 2329 mappings and 19 original hyperlink occurrences remain exact. The ten archived source files verify unchanged: six phases, 26 weeks, 182 days, 548 tasks and seven preparation items.
- Strict TypeScript, ESLint, Prettier and production build pass. The two existing Turbopack filesystem-tracing warnings remain. Development streaming also emitted a Gzip drain-listener warning during browser/audit work; it did not fail requests and remains an upstream/runtime investigation for the integration gate. Licence verification retains 560 locked dependencies and 574 supplied notices.
- Actual HTTP/API audit in isolated `.tmp/m2-preview`: immediate task anchor plus durable draft/evidence; active anchor without credit/work/reference changes; exact duplicate receipts; stale and reused receipts; invalid/foreign task anchors; non-active cursor rejection; changed-account guard; two separate accounts; read-only GET; unique targets on exercise/study pages; logout/login. After stopping and starting the server, a fresh login restores the exact revision, task count, evidence, Day 17 task 2 anchor and Continue destination. Evidence: `m5-step3-http-audit.json`.
- Actual served-source/navigation regression: 20 pages, 77 mappings, 15 daily/sequence/context views, 19 outlines and 20 navigation shells pass, including unique section/task/evidence targets on ten dedicated unit pages, protected access, missing routes and unchanged progress on GET. This subset contains no original hyperlinks; full source/link coverage remains in integration and prior full served audits. Evidence: `m5-step3-served-audit.json`.
- Actual synthetic browser: Day 2 study → choose criterion → confirmed Saved section → open exercise for reference and inspect AI → Dashboard/Resume still returns study criterion. Save exercise task 3 → immediate Task 3 acknowledgment → Dashboard remains 2/364 → Resume returns `#d002-task-03` with keyboard focus and persisted task 2/3 checks. At 360×800, original task/section links remain usable; width 345 against viewport 360, with no horizontal overflow. Desktop verified at 1440×900.
- A second browser tab opens completed Day 1 for reference. The earlier Day 2 tab's next section save receives 409, focuses the conflict explanation, and requires explicit resolution; saved checks remain. Evidence: `m5-step3-stale-tab-mobile.png`. Task restoration screenshots: `m5-step3-task-resume-desktop.png` and `m5-step3-task-resume-mobile.png`.
- Browser logout → stop server → build → start server → fresh tab/login → Dashboard still 2/364 → Resume restores the last acknowledged Evidence section and both saved task checks. Evidence became the latest acknowledged section during the final viewport/scroll checks before logout; the prior task destination and the HTTP task-anchor restart fixture were verified separately. Fresh browser focus is Evidence; no completion was added and no real student data was reset.

## Reproduction

Start the development server with `APP_DATA_DIR` set to the repository's absolute `.tmp/m2-preview` path. From the repository, using the pinned Node runtime:

```sh
node scripts/audit-section-resume.mjs
node scripts/audit-served-curriculum.mjs --m5-step3
```

The first audit creates its reusable synthetic account on its first run only, and uses the existing synthetic UI account as the isolation control. It refuses the normal student-data directory. Stop/start the server without rerunning setup or resetting data, then:

```sh
node scripts/audit-section-resume.mjs --verify-restart
```

## Remaining work

M5 step 4: read-only recent activity from existing meaningful transition events. Browser Back/Forward draft handling and the M5 integration gate follow as separately approved steps. Production browser/axe, screen reader, real OS reboot, disconnected-network and cross-platform clean-install checks remain final gates. Notes and other learner tools remain later milestones.
