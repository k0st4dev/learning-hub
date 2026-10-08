# M6 step 5 — advisory scorecard review reminders

Date: 2026-10-08. This focused increment implements the scorecard reflection prompts in specification section 5. It does not finish all of M6 or final MVP acceptance.

## Behavior and decisions

- One shared pure model derives opportunities from the authenticated student's pinned-release progress and published week/assessment metadata. Review weeks are exactly 4, 8, 12, 16, 20 and 24; the final exam is a separate opportunity.
- Minor unspecified eligibility decision: a week is finished when all its required lesson/exercise units, including its published checkpoint, are confirmed complete. A passed checkpoint alone with unfinished work in that week does not produce a finished-week prompt. Earlier-week gaps do not lock a completed later week's prompt. Final-exam reflection requires the confirmed final exercise, independently of earlier gaps or its study lesson.
- Reopening required week work removes that week's opportunity; reopening the final exercise removes its final prompt. Needs review/unconfirmed drafts do not count as completed milestones. Existing unfinished-checkpoint reminders remain available.
- Dashboard, Course and Progress show the eligible opportunities in source week order, after existing activity and checkpoint/preparation sections. Week/day/module scopes show only their relevant opportunities. A completed checkpoint/final exercise page also offers the relevant reflection following server refresh after acknowledgment.
- The single link opens `/progress/scorecard`. Its existing authenticated server chooses the current month in the owner's timezone and reads that enrollment's existing month. A saved scorecard opens for deliberate revision. The reminder never creates another review, changes ratings/evidence, dismisses a milestone, adds learning credit or changes Continue.
- Repeat visits retain the optional reflection link. There are no wall-clock deadlines, prerequisite/date locks, background writes, new receipts, browser-storage fallbacks or private-note searches.
- New accounts and scopes without eligible work show no empty/decorative reminder. The shared notice uses existing responsive styles, semantic heading/list and a keyboard-accessible local link. Added English guidance remains separate from unchanged Serbian source content.
- No database migration, curriculum release, dependency or licence changes.

## Verification

- 15 new source-based model/component cases cover all six week triggers, other weeks/new accounts/missing scopes, confirmed work and reopening, actual assessment metadata, final-exam independence, stable ordering/repeat reads, all three overview placements, preserved exact credit and no mutation of input state.
- One new real-database integration case completes all fourteen Week 4 units through the existing learning service, then confirms repeated reminder/scorecard reads leave the existing month, revisions/receipts, progress and second user's records unchanged.
- Focused reminder/progress/activity/scorecard regression: **37 tests / 4 files pass**. Strict types and focused lint pass.
- [Actual HTTP report](m6-step5-http-audit.json): two new synthetic accounts only in `.tmp/m2-preview`; Week 4 and the final exercise confirmed through protected API calls. Seven served pages display the right scoped prompts. Repeated page visits and current-month scorecard opening retain the owner's prior Git 0/exact evidence and 15/364 units (4%); the second account retains zero progress and no scorecard/reminder.
- The audit's first final-exam fixture omitted the original alternative choice and then its selected scope. The API correctly rejected both incomplete fixtures with 422. The fixture now uses the reviewed prepared-bug choice and explicit scope; validation was not weakened. Existing student data and older fixtures were not reset.
- Initial full regression: 351 pass, one previously monolithic source-render test times out at 60 seconds. It now runs every mapped route in one of three disjoint batches, each retaining the 60-second limit, exact text/table/anchor/link/navigation assertions and global 2,329-mapping/19-link inventory. No source destination or assertion category is removed. Final complete regression: **354 tests / 30 files pass in 57.19 seconds**.
- Actual desktop browser verification passes: the Dashboard shows Week 4 and Final exam; keyboard Enter on the reminder opens the current-month editor with the prior Git 0 and exact evidence retained. Back returns to the same reminder. Temporary test tab closed; user tab preserved. [Inspected screenshot](m6-scorecard-review.png). Existing responsive card styles are reused; no extended mobile session was repeated.
- Final strict TypeScript, full ESLint, repository formatting and optimized build pass. Source archive integrity passes for all 10 files, 182 days, 548 tasks and 2,329 mappings. Licence verification preserves all 560 locked dependencies and 574 supplied notice files. The build retains the two already tracked filesystem-tracing warnings. Development preview restarted on the same database after build; /login returns 200.

Reproduce the HTTP check against the isolated preview:

```sh
# Set APP_DATA_DIR to the absolute repository .tmp/m2-preview path.
node scripts/audit-scorecards.mjs review
```

Ignored `.tmp/m6-scorecard-review-http-state.json` contains only synthetic credentials and expected saved state for UI verification. Never print or commit it. This mode preserves the older save/verify fixture files and reports.

## Next focused task and limits

After approval: M6 step 6, normalized curriculum search backend/API. Read specification section 17 and `/api/search` contract; scope to the owned pinned release, titles/topics/exercises/resources/guides, Serbian diacritics, safe snippets, filters, deterministic ranking and 20-result pagination. Keep private notes out of search. Implement its UI in a following approved increment. Resource filters and copyable handbook templates remain later M6 work.

Existing production-server/Playwright/axe, screen-reader/offline/real reboot/full browser shutdown and target-OS installation gates remain pending; A01–A26 are not all passed. Build/filesystem and development streaming warnings remain tracked. No GitHub push is claimed; the configured agent proxy remains blocked and no bypass was attempted.
