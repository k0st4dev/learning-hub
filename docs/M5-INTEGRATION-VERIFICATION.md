# M5 integration — first audit

2026-10-06. **Integration audit increment completed; M5 gate remains open.** The user authorized the integration and prioritized desktop usage, reducing repeated mobile testing. This increment adds meaningful transaction/durability coverage and the acceptance matrix; it does not add learner features or change production code, dependencies, migrations or source content.

## New passing coverage

- The full immutable release is completed through **364 actual `mutateLearning` transactions**, with all 548 task decisions and permitted alternatives, including Day 125. Every intermediate course count/percentage is checked; 363/364 cannot display 100%. All six modules reach 100% only at completion. Unsetting a required final-exam task via a draft transaction then gives 363/364 (99%), 181 complete days, F6/week 26 13/14 (92%) and Day 182 1/2 (50%). Course reopening history, cleared completion/attestation timestamps and the explicit saved task anchor are checked. This replaces reliance on a fully complete read-model SQL fixture for that scenario; the older fixture still tests read presentation independently.
- A separate **owned test child process** opens a disk database containing the complete release and two synthetic accounts. The first account has Day 1's independent study/exercise completion. The child commits a Day 2 exercise draft with checked task/evidence and a saved task anchor, writes its acknowledgement only after the service returns, and leaves SQLite open. The parent forcibly terminates that exact child with SIGKILL, reopens the database, checks integrity/foreign keys, compares the complete snapshot with the acknowledged response and confirms fresh-login Continue at `d002-practice#d002-task-02`. The second account stays unchanged. Repeating the original mutation receipt returns the same result without new activity. No real data or preview accounts are touched; the guarded temporary directory is cleaned up.
- **244 tests across 24 files**, strict TypeScript and ESLint pass. New files pass Prettier. Existing tests retain canonical rollups, gap/skip-ahead/reference behavior, exact receipts, conflicts/ownership, checkpoint remediation, rollback injection, source rendering, authentication and draft navigation coverage.
- The ten-file archive integrity check passes: six phases, 26 weeks, 182 days, 548 tasks, seven preparation items, 12 original resources, 2365 source blocks and 2329 mappings. Licence checks preserve 560 locked dependencies and 574 supplied notice files.
- Fresh actual served audit passes **663 pages** (594 curriculum plus 69 resource destinations), every one of the 2329 source mappings and 19 original hyperlink uses, 546 daily/sequence views and 594 outlines. Strict missing-route/authentication checks pass; reading leaves progress/cursor unchanged. Evidence: m5-integration-served-audit.json. This reuses the existing `--m3-final` provenance/navigation auditor against the current M5 application; its legacy scope label is preserved. The reported mobile-shell count is static markup coverage, not a new interactive mobile/viewport campaign.
- Actual UI resource-click check: the synthetic UI account initially showed 2/364 on Dashboard. Resources → original MDN JavaScript Guide link was clicked through both the locator and documented accessibility action. The app stayed on Resources; the external destination was not inspected or claimed available. Returning to Dashboard and explicitly reloading from the server preserved 2/364, 1/182 complete days, 181 remaining lessons/exercises and the active `d002-practice#evidence` link. [Progress after resource click](m5-integration-resource-progress.png). This checks no automatic completion, not internet availability or an external course's policy.

The child-process test covers acknowledged **application-service writer termination**, not an OS reboot, power failure or a fully restarted Next/browser process. The previous actual development-server/logout/login/Day 2 browser journey remains in M5-STEP1-VERIFICATION.md; section restoration and history restart evidence remain in steps 3–5. Do not infer unperformed production or manual checks.

Relevant checks:

```sh
node node_modules/vitest/vitest.mjs run tests/unit tests/integration --configLoader=native
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --max-warnings=0
node scripts/verify-source.mjs
node scripts/licenses.mjs --check
```

For the served audit, first start the development server with `APP_DATA_DIR=<repository>/.tmp/m2-preview`, then run `node scripts/audit-served-curriculum.mjs --m3-final` with that same absolute data-directory setting. The audit creates only a synthetic preview account. Its legacy output is docs/m3-final-served-audit.json; this increment saved a copy as docs/m5-integration-served-audit.json and preserved the old evidence file. Never point this audit at normal student data.

## Gap found at this audit (subsequently repaired)

Specification sections 7 and 30 require immediate persistence of task checks and automatic transactional reopening when a required task is unchecked in a completed exercise. The current full-course editor changes task decisions in the local draft and waits for **Save draft**. It disables the whole exercise fieldset when complete, so a student must use explicit Reopen before unchecking a required task. This is safe from false Saved/completion claims and has unsaved-navigation protection, but it does **not** meet the specified task interaction.

The current full-course API already validates and atomically saves complete exercise submissions, including task decisions, evidence, cursor, revision, history and cleared completion timestamps. The next focused fix should reuse that path and its existing retry/conflict/account protections. It should immediately persist valid discrete task changes, retain incomplete applicability reasons/alternatives as visibly unsaved drafts, avoid saving text on every keystroke, and let a deliberate required-task unset reopen a completed exercise without losing evidence or other checks. Centralize draft validation; do not reopen a completed exercise merely because optional work changes. Add focused UI/service tests for pending, failed, duplicate, conflicting and completed-task changes, then rerun the gate. Do not introduce browser storage or a new permissive task API.

No production code was changed during this audit. The gap is recorded before implementing a separate focused repair, in keeping with the user's approval after each step. **Do not start M6 or label M5 complete until repaired and verified.**

## Next task and evidence

The separately approved repair is now implemented and verified in [M5-TASKS-VERIFICATION.md](M5-TASKS-VERIFICATION.md). The descriptions above record the gap at the original audit date. After the next approval, perform the final M5 integration closeout; do not start M6 yet. Reuse the passing desktop guard evidence rather than repeating long viewport sessions. Keep basic responsive regression; desktop and keyboard behavior are the primary demonstration. See M5-ACCEPTANCE-MATRIX.md for A01–A26 status. Production/axe, screen reader, real reboot, disconnected operation, target-OS installs, notes/search/scorecard/settings and operational tools remain explicitly pending.
