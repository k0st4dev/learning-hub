# M4 step 4 — assessment results, review notes and exam guidance

Verified 2026-10-05. This focused step is complete. Final MVP and A01–A26 acceptance remain open.

## Behavior and decisions

Published course-day metadata identifies all 25 weekly checkpoints and the final exam. Exercise pages prominently repeat the unchanged original pass criterion and AI policy. Assessment self-report uses Criteria met / Needs review. Score or rubric evidence and a remediation note are optional plain-text fields of up to 2000 characters, saved atomically with the exercise. The platform does not infer grades from free text or invent pass marks. Existing criterion attestation and server-side eligibility checks remain authoritative; Needs review cannot award exercise credit.

Day 7 shows the original 7/10 plus all three problems criterion and links Days 3–5 when review is selected. Day 28 preserves the average ≥4/5 and two-day review advice, with links to Weeks 1–4. Other assessments provide a clearly labelled navigation suggestion to their relevant week. All content remains available after an unsuccessful attempt. Day 182 prominently repeats the original first 120 minutes without resources and exact 45/45/30-minute tasks; times are guidance, with no countdown or proctoring.

Score evidence and remediation use additive fields in existing version-1 rubricJson.exerciseWork. Missing fields in earlier saves default to empty strings. No SQL migration, immutable curriculum, dependency or licence change. Unrelated rubric keys remain preserved. Empty new fields are omitted from receipt hashing, preserving replay of requests saved under the previous schema. Assessment notes submitted on ordinary practice are rejected. A transition into Needs review records one checkpoint_needs_review activity event; repeated saves while still Needs review do not duplicate it. Lesson completion is independent.

## Verification

- 182 unit/integration tests across 15 files pass. Seven new cases cover all 26 published assessment definitions; UI result/score/note saves on Days 7, 28, 35 and 182; exact criteria/AI/timing; failed-credit prevention; review links; restart/login persistence; independent lesson credit; meaningful review activity events; earlier saved fields and receipt compatibility; forged practice/oversized notes. Existing ownership, rollback, optional/alternative/mixed, Day 125, retry/conflict and full source-rendering tests also pass.
- Strict TypeScript, ESLint and production build pass. The existing two dynamic filesystem tracing warnings remain.
- Source archive integrity passes all ten files; full source-rendering integration retains all 2329 mappings and 19 original hyperlink occurrences.
- Actual development HTTP audit passes 40 routes, 154 mappings, 38 daily/sequence views, 39 outlines and 40 navigation shells, including all 26 assessment exercise pages. Original criteria/AI, assessment inputs and final-exam timing checked; authenticated access, strict missing-route status and unchanged progress on reading pass. This route subset contains no original hyperlinks. Evidence: m4-step4-served-audit.json.
- Actual API audit: save Needs review without credit, identical retry, forged completion rejection, logout/login restoration and two-user isolation pass. Evidence: m4-step4-http-audit.json; repeat with APP_DATA_DIR=<repo>/.tmp/m2-preview and scripts/audit-assessment-work.mjs against the development server.
- Actual browser on the synthetic m4-ui-20261005 account: Day 7 save score/remediation → acknowledged save → reload → Needs review and exact text restored; completion disabled; Days 3–5 accessible. Then Day 182 opens freely and displays exact independent-attempt guidance. Mobile 360×800 has no horizontal document overflow or timer. Screenshot evidence: m4-step4-checkpoint-desktop.png and m4-step4-final-exam-mobile.png. Temporary viewport override reset.

The existing development process initially retained the previous exercise schema and rejected the additive fields. Restarting that same isolated server refreshed its modules; the API and browser saves then passed. No student data reset. Restart the development server when changing server-side schemas, rather than relying solely on hot reload.

## Remaining work

Checkpoint reminders/rollups on the dashboard, day/week and progress pages and full study/Continue behavior belong to M5. Browser-history unsaved navigation protection remains an integration follow-up. Production runtime browser/axe, screen reader, real OS reboot, disconnected-network and cross-platform clean-install checks remain final gates. No complete A01–A26 pass is claimed.
