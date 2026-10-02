# M4 step 1 — pure exercise eligibility

Date: 2026-10-02. Scope: specification sections 2 (source interpretations), 5–6 (scope/evidence/completion), 11 (completion invariant) and 23 (table-driven tests). M4 is not complete.

## Implemented

`src/domain/exercise-requirements.ts` provides a pure, strictly typed evaluator shared by future client/server adapters. It returns eligibility plus structured blocking issue codes, without changing progress or accessing files, URLs or submitted code.

- Required tasks must be done. Mixed tasks attest their required clause; the existing original wording and interpretation describe the optional clause separately.
- Optional tasks may be absent and do not block. Only conditional tasks may use Not applicable, with a nonblank reason. Optional work is left unchecked rather than falsely saved as Not applicable.
- All 16 alternative tasks have reviewed permitted choice IDs. A done task requires a permitted choice and nonblank selected scope. The deferred Odin plan, known course database fallback and login-only capstone also require a reason/plan. These choices do not waive other tasks.
- Current/equivalent assignment choices on Days 78, 103 and 134 require selected scope when done. An explicit trusted `requiresScope` flag supports other external assignment selections; the future course adapter must derive it from course context, never student input.
- Day 125 records Go, Java or existing-language transfer. Go/Java require both the optional syntax task and implementation task. Existing-language transfer leaves the optional task unchecked, records implementation as Not applicable with a reason, and requires reflection, scope, evidence and the required transfer-focus attestation. A false done state cannot substitute for this path.
- Every completion requires nonblank evidence, criterion attestation and passed result. Needs review/null result remains ineligible, including checkpoints and final exam. This is self-assessment against the original criterion, not automatic grading or validation of evidence contents.
- Strict Zod parsing rejects unknown fields, malformed types/statuses, oversized strings and forged payload shapes. Unknown/duplicate task IDs, unauthorized skips/choices and cross-exercise transfer data are blocking. Evidence/scope bounds are 2000 characters; the same bound is used for reasons/reflections as a documented local input choice.

The registry belongs to immutable `se-26w-v1`; an unknown release or unsupported alternative rule fails closed. Runtime requirements must come from the authenticated learner's pinned release. It is **not yet wired into the M1 API**, and callers must never construct trusted requirements from client JSON. No database/schema/import/source changes or new dependencies were made.

## Verification

The 50 new tests use the complete validated source JSON. They check all 548 tasks and all 182 positive exercise cases, independently remove each required/mixed task, and table-test all 33 non-default rules (16 alternative, 13 conditional, two optional and two mixed). Additional cases cover Day 125 paths, checkpoint Days 7/28, final Day 182, scope/reason/evidence boundaries, payload forgery, duplicate/foreign IDs and input immutability.

Run the focused checks with `npx vitest run tests/unit/exercise-requirements.test.ts --configLoader=native`, or use the approved local runtime directly. Final verification: all 152 tests across 13 files pass (55.40 seconds); ESLint, strict TypeScript and production build pass. The same two existing filesystem-tracing warnings remain. Production runtime and final accessibility/reboot gates retain their previously documented pending status. No browser retest is needed because no UI or runtime API behavior changes in this increment. M3's complete served content audit remains applicable; full interactive acceptance A10–A11/A17–A18 remains pending.

## Next step, after approval

M4 step 2: define the persistence adapter and validated mutation contract for rule decisions, selected scope, evidence and transfer reflection. Derive requirements from owned enrollment/release data; map stable task IDs explicitly; decide and document storage in the existing task reason / selected scope / rubric fields before changing anything. Reuse transactions, revisions, idempotency and reopening from M1. Prove forged completion rejection, account isolation, retry/conflict behavior and save/reload persistence before exposing the new UI. Keep checkpoint remediation and broader learning screens in later focused steps.
