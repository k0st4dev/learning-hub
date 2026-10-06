# M5 task persistence and automatic reopening repair

2026-10-06. Focused repair of the gap found in the first M5 integration audit, against specification sections 7 and 30. The final M5 integration closeout still requires the user's next approval; this is not final MVP acceptance.

## Behavior and implementation

- Valid check/uncheck, applicability and alternative selections save automatically through the existing owned full-submission API. Incomplete required reasons or unselected alternatives remain visibly unsaved; reason text saves on blur, not every keystroke. Other text edits retain Save draft. An automatic task save includes the current valid work snapshot.
- Completed task decisions remain editable. Removing required work sends an incomplete submission with attestation cleared, retaining evidence, assessment and other decisions. The existing transaction clears completion/criterion timestamps and updates ancestor counts, active task and reopening history together. Checking the task again does not automatically complete the exercise; criterion confirmation and Mark exercise complete remain explicit.
- Optional-only changes which leave the completion criterion satisfied preserve completion, original timestamps and another unit's active study location. Completed evidence/assessment fields remain read-only until explicit reopening.
- Task writes serialize behind pending section writes with the acknowledged revision. Newer evidence typed during that section save remains unsaved rather than being erased by an older task acknowledgement. Navigation guards cover dirty/pending work. Unknown outcomes retry the identical mutation; validation remains editable; ownership and conflicts retain their existing explicit recovery. Queues cancel on conflict/account/validation failure, discarded drafts and page unmount. An uncertain section write retries before its queued task is sent.
- Draft decision validation is shared by client and server without loosening server policy. No new task endpoint, schema/migration, curriculum release, browser draft storage, dependency or paid service.

## Verification

- **258 tests / 24 files pass.** Added 14 cases covering immediate task saves and restoration, Strict Mode single dispatch, invalid reason/alternative drafts, reason blur/no duplicate blur, pending/no false Saved/duplicate controls, network/422/account failures, conflict discard, required completed unset, optional completed edits, queued section revision/typing/retry/conflict/unmount, and real transactional optional preservation followed by required reopening. Existing full 364-unit completion and acknowledged writer-termination recovery tests still pass.
- Final focused editor/section regression: **43 tests pass** after the additional handler guard and Strict Mode check. Strict types and ESLint pass. Production build passes with the two previously recorded tracing warnings. Source archive verification preserves all 10 files, 182 days, 548 tasks and 2329 mappings; licence check preserves 560 locked dependencies and 574 notice files. Formatting passes.
- Focused actual development HTTP regression: **20 pages**, 77 mappings, 15 daily/navigation/study views, 19 outlines, authentication and missing routes pass, with unchanged confirmed progress/cursor. Basic mobile-shell assertions pass; no extended mobile campaign was repeated. Evidence: [served audit](m5-task-served-audit.json). The reused script retains its legacy M5 section scope label; the prior step 3 report was preserved.
- Actual desktop browser at **1024×576**, synthetic preview account only: the completed Day 1 exercise exposes editable task checks and read-only evidence. Unchecking task 1 shows Saving until acknowledgement, then 1/2 (50%), active Task 1, no completed card, cleared attestation, unchanged evidence and other three checks. Reload and actual development-server stop/restart/reload preserve that state. Keyboard Space checks the task again and saves it, but criterion confirmation is still required. Explicit confirmation/completion restores 2/2; Dashboard shows 2/364 and both exercise/day reopening and recompletion history.
- The original synthetic work was restored: Day 1 complete, Day 2 task 1 unchecked/task 2 and 3 checked, empty Day 2 evidence, active `d002-practice#evidence`, 2/364 total. Day 2 uncheck/check also saved immediately without awarding completion. The screenshot shows the restored next location: [Continue after the journey](m5-task-journey.png). Test transitions intentionally remain in history. Separate activity/anchor fixtures and normal student data were not reset.

Reproduce automated checks with the pinned Node runtime:

```sh
node node_modules/vitest/vitest.mjs run tests/unit tests/integration --configLoader=native
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --max-warnings=0
node node_modules/prettier/bin/prettier.cjs --check .
node scripts/run-next.mjs build
node scripts/verify-source.mjs
node scripts/licenses.mjs --check
```

The server restart above is not an OS reboot or a full browser-process shutdown. Production startup/Playwright/axe, screen reader, disconnected operation, target-OS installs and later milestone acceptance remain pending. The existing development Gzip listener warning remains recorded. A01–A26 are not all declared passed. Next focused task: approved final M5 integration closeout, using existing full coverage evidence and only additional checks warranted by this repair; do not start M6 yet.
