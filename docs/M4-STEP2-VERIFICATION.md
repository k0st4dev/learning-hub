# M4 step 2 — durable exercise decisions and server enforcement

Date: 2026-10-02. Implements the persistence contract for the step 1 evaluator using specification sections 2, 5–7 and 11. Interactive screens and checkpoint remediation remain later M4 steps.

## Reviewed storage decision

No migration is necessary. Existing `task_progress` rows store done/not_applicable plus plain-text reason. Missing rows mean unchecked. Exercise evidence and selected scope use their existing columns. The existing `rubric_json` stores a versioned `exerciseWork` namespace with permitted task choices, Day 125 transfer path/reflection and draft criterion attestation. Other rubric keys are preserved. Confirmed completion timestamps remain in their original columns; an incomplete draft never receives those timestamps. Older rows without the namespace retain their existing fields and are read without a destructive backfill.

This is student data, not a change to published curriculum. No importer, source, schema or release hash changed. The original M1 fixture contract remains supported in its separate release.

## Mutation and read contract

The existing authenticated, CSRF-protected `PUT /api/progress/exercises/:id` accepts a strict full-course envelope:

```text
{ kind: "exercise", itemId: "se-26w-v1:d125-practice",
  mutationId: UUID, expectedRevision: number, completed: boolean,
  submission: { tasks: [{ taskId: "d125-task-02", status: "not_applicable",
                         reason: "…", choice: "" }],
                evidence: "…", selectedScope: "…", attested: boolean,
                result: "passed" | "needs_review" | null,
                transferPath: "go" | "java" | "existing_languages" | null,
                transferReflection: "…" } }
```

The task list is the complete desired checklist for that exercise; omitted tasks become unchecked. Clients must send confirmed state plus edits with its revision. Invalid skips, foreign/duplicate IDs, nonempty unknown alternatives and reasonless Not applicable are rejected even for drafts. Incomplete but structurally valid work can be saved with `completed: false`. Completion requires the full evaluator to pass. `completed: false` on completed work explicitly reopens it, clears completion timestamps and updates derived totals/history. UI must explain this before submitting a reopen.

The server resolves the authenticated user's enrollment and pinned published release, joins original task rule metadata, and converts stable task keys to that release's database IDs. It derives scope requirements for reviewed external assignment sets from original day numbers (85, 89, 90, 96, 97, 103, 104, 110, 117, 123, 131, 135, 139, 152, 153, 160, 167, 174). Alternative/conditional scope checks from step 1 still apply. This requests assignment identifiers, without expanding the source workload or fetching external resources. Clients cannot supply requirement modes, ownership or scope policy.

Decisions, exercise fields, timestamps, cursor, events, revision and receipt commit in the existing IMMEDIATE transaction. Exact retry returns the original receipt; changed retry IDs/content and stale revisions follow existing 409 rules. The legacy checkbox/exercise payload is rejected for the full release, closing the prior shortcut around the new evaluator. It remains available only for `development-day1-v1`.

Owned snapshots now return each full-release exercise's reconstructed `submission` alongside its existing fields. Only the current enrollment's tasks are decoded. Unsupported saved namespace versions fail safely without erasing or resetting records. Completed timestamps are preserved when an already valid completion is saved again.

## Verification

- Twelve new SQLite integration cases cover all 548 imported rules, server-selected scope, alternative decisions, Day 125 reflection, close/reopen of the database and fresh login, incomplete drafts, optional/mixed/conditional work, failed checkpoints/final exam, forged payloads, legacy bypass rejection, two users, exact retries, stale saves, explicit reopening, preservation of unrelated exercises/rubric fields, injected write failure rollback and unavailable/corrupt data handling.
- Actual development HTTP test passes: missing reflection returns 422; valid Day 125 work completes exactly 1/364 units; exact retry returns the same response; stale revision returns 409; logout/login preserves the submission; a second account has no progress/tasks/evidence from the first. Evidence: `m4-step2-http-audit.json`. Uses synthetic accounts only in `.tmp/m2-preview`.
- All 164 tests across 14 files pass (60.30 seconds); ESLint, direct TypeScript checking and production build pass. The two existing filesystem-tracing warnings remain. Direct `tsc --noEmit` also caught two pre-existing unsupported Testing Library `exact` options in the mobile-navigation test; removing those options preserves its exact string-name matching and makes the complete test source typecheck pass.

Database reopen is verified here; this is not a new actual operating-system reboot or production-server restart demonstration. Previously documented production runtime, screen-reader and final cross-platform acceptance gates remain pending. No UI changed, so no new browser screenshot is claimed.

## Reproduction and next task

Run the unit/integration suite, lint, direct typecheck and build using the approved runtime. Focused database tests are in `tests/integration/exercise-work.test.ts`. With the isolated development preview running and APP_DATA_DIR set to its absolute `.tmp/m2-preview` path, run `node scripts/audit-exercise-work.mjs` for HTTP evidence.

Next, only after approval: M4 step 3 — expose the stored checklist decisions, permitted choices, conditional reasons, scope/evidence and Day 125 paths in the full-course exercise screen. Reuse this atomic contract, restore drafts from confirmed server state, preserve unsaved edits on failures/conflicts and require explicit reopening. Keep checkpoint remediation/final-exam guidance for its focused follow-up.
