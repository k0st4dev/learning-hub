# M6 step 12 — visible resource library

Date: 2026-10-08. Adds authenticated resource controls to `/resources`, above the retained original manual. This is a focused M6 increment; final MVP acceptance remains open.

## Behavior and boundaries

The initial server read uses the owned pinned-release service. Subsequent reads use the protected resource API with no-store and the expected-account header. A browser response schema checks rendered fields, local destinations, external HTTP(S) links, enrolled release and returned query. Canceled, stale or malformed replies cannot replace current results. Account/session/enrollment failures provide explicit recovery; transient failures retain filters and offer Retry.

The interface provides normalized literal search, 250 ms debounce, one-character Enter, providers, types, phases, weeks, days and contextual assignment labels. Filters combine on the same original assignment, with alternatives within each dimension. Pages show 25 resources in original title/ID order. Apply, clear-query, clear-filter, empty/out-of-range, loading, error and retry states are implemented. URL, Back/Forward and return from a detail page restore the query, selections and page; refresh also handles cached server snapshots. The existing shared unsaved-navigation protection remains in place.

Resource cards preserve original titles, descriptions, assignments, source locators, related contexts, original/reviewed URLs and availability wording. Native disclosures expose every assignment and the frozen added-label rationale, confidence, caveats and exact source evidence. Imported metadata is explicitly distinguished from presentation interpretations. Requiredness belongs to individual assignments and adds no completion units. Unknown providers and missing original links remain explicit.

The original manual blocks, tables, mappings, links and all resource detail destinations remain unchanged. Existing resource-filtered Search entry remains available. No curriculum/importer/schema/frozen artifact/dependency/private learner record/progress rule is changed. The eighteen parent-binding and fifteen named-mention proposals are not applied.

## Verification

- **441 unit/integration tests / 37 files pass in 73.96 seconds.** Fourteen new browser-component cases cover source escaping, source/effective distinction, URLs, initial reads, query/debounce/Enter, combined controls, clear/reset, pagination, Back/cached snapshots, error focus/retry, login/account/enrollment recovery, invalid data/query, unknown providers, stale replies and unmount cancellation. Real resource-route tests now validate all three pages against the rendered response schema. Final focused gate: **36 tests / 3 files**, including existing Search UI regression.
- Strict TypeScript, full ESLint, repository formatting, production build, original archive integrity, frozen-label reproduction and dependency licence/notice checks pass. The build retains the two previously tracked filesystem-tracing warnings. No new dependency or fee is introduced.
- [Actual HTTP audit](m6-step12-http-audit.json), rerun after the same-database preview restart, passes for two existing synthetic accounts: 30 resource API reads, all 69 resources/290 uses/19 original hyperlink uses per account, same-use filters, Unicode, validation/account guard, HEAD/rejected POST and login/logout. All durable learner/private/published-content fingerprints remain unchanged.
- UI mode additionally verifies **12 served library pages**, the complete 69-resource/290-assignment inventory and exact assignment text in server-rendered cards. Across the six full-inventory pages it checks **240 original manual source blocks and 72 original source links**, including original targets/new-tab protection. Provider/scope/type/requirement controls, initial filtered/empty/invalid states and selected URL values pass. API no-store is asserted; development HTML uses the framework's no-cache/must-revalidate behavior. This HTML audit does not substitute for interactive browser checks.
- Actual in-app browser: Day 113 + Optional supplement shows only The Odin Project; Required section shows only CS50. Back restores the previous requirement. All-resource Next reaches page 2 and Back restores page 1. Space toggles Course to four results; single-letter C + Enter updates the URL while retaining Course and returns four matches. A nonexistent query shows zero; Clear query returns the same four courses. Tab from the query focuses Apply filters. Original resource details open; settled Back restores Day 113/optional and its one result. Added-label disclosure shows imported metadata separately, exact Word table evidence and confidence.
- Measured desktop **1440×900 CSS viewport**, document scroll/client widths both 1428: no horizontal overflow. Basic narrow regression **360×800 CSS viewport**, document scroll/client widths both 348: no horizontal overflow; query-to-Apply keyboard focus works. Host zoom required viewport capability sizes 1800×1125 and 450×1000 respectively; actual DOM dimensions above were measured. Temporary override reset. [Desktop screenshot](m6-resource-library-ui.png) records the filtered result. The agent-created resource tab is retained as a deliverable; user tabs are preserved.
- Preview restarted using the same `.tmp/m2-preview` database and hidden portable-Node launcher PID **31572**, with no normal-data setup/reset. Existing synthetic fixture credentials stay ignored and are never printed or committed. Reloaded browser document verifies the latest build. Generated Next type declarations are excluded from the change.

The first post-restart audit invocation omitted `APP_DATA_DIR`; its guard refused the normal data path before opening a store. Setting the required existing preview path allowed the complete audit to pass. A browser assertion initially expected two single-letter matches; the visible query correctly returns four courses, consistent with literal original-content matching. No application workaround was made for either check.

Separate production startup/Playwright/axe, reboot/offline/screen-reader/target-OS and later milestone gates remain pending. This increment does not declare A01–A26 fully passed or live external link availability verified. GitHub publication remains the existing normal-PowerShell operator action.

Reproduce the usual test/type/lint/format/build/source/licence commands from README. With the same preview running and the existing ignored synthetic fixture present, set `APP_DATA_DIR` to the absolute `<repository>/.tmp/m2-preview`, then run:

```sh
node scripts/audit-resource-library.mjs --ui
node scripts/freeze-resource-labels.mjs --check
```

## Exact next task

Ask before **M6 step 13: reviewed labels and source evidence on individual resource detail pages**. Reuse the owned resource service, validated view and existing card/provenance presentation; keep original detail source blocks, mappings, URLs and unknown-link states. Verify library → detail → Back consistency, all 69 detail destinations, session/account/error recovery and unchanged two-user records. No parent regrouping/new mention destinations/schema/source/dependency/completion changes. The eighteen parent-binding and fifteen mention proposals still require separate approval and coverage integration. Handbook tools and final M6/MVP acceptance remain open.
