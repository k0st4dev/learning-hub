# Project status

Updated: 2026-10-01. **M0–M2 complete; M3 step 4 complete.** The user requires confirmation after every M3 step. **Do not start step 5 without approval.**

## Completed

- M0: pinned local stack/runtime, native checks, licence notices, configuration guards and test harness.
- M1: reviewed schema, secure accounts/sessions/CSRF/throttles, isolated Day 1 completion workflow, transactional progress/reopening and restart/two-user demonstration. Evidence: docs/M1-VERIFICATION.md.
- M2: full immutable importer and authenticated reading preview: 6 phases, 26 weeks, 182 days, 182 lessons, 182 exercises, 548 tasks, 7 preparation items, 7 appendices, 14 scorecard dimensions, 364 required units.
- Exact original text/table/link audit passes: 2365 body paragraphs plus header/footer metadata, 197 tables, 2329 mappings and 19 hyperlink occurrences/12 URLs preserved.
- All 594 curriculum routes and 69 resource-detail routes pass actual served HTML checks. All mappings, anchors, coordinates and links present. Reading leaves progress and cursor unchanged.
- 64 tests pass. Import rollback, no-op, immutable rejection and student-data preservation pass. Strict TypeScript, ESLint and production build pass. Evidence: docs/M2-VERIFICATION.md, m2-source-audit.json and m2-served-audit.json.
- Browser registration/login/enrollment/preparation/Continue to Day 1 passed. Overview, Day 182 and scorecard inspected at desktop/mobile sizes; no document overflow. Auth forms now use POST before JavaScript hydration to prevent credentials in query strings.

## Decisions and immutable contracts

- M3 step 1: shared source-ordered navigation, numbered breadcrumbs/current page, Previous/Next for all 364 units and separate day navigation. First study returns to preparation; final exercise opens Progress. No progress/cursor writes. All 70 tests and 663 served-page checks pass, including navigation on 546 day/unit pages. Browser Day 1 study → exercise → Day 2 study and mobile reflow pass. Evidence: docs/M3-STEP1-VERIFICATION.md.

- M3 step 2: native expandable phase/week/day/study/exercise outline with all 578 entries, 214 expandable groups, current-path expansion and current-page marker. Shared pure model/labels; desktop sidebar and mobile stacking/collapse. All 78 tests pass; final browser keyboard/reflow checks at 1440×900 and 360×800 pass. TypeScript, ESLint and production build pass. All 663 served pages pass, including outline checks on 594 curriculum pages and sequence checks on 546 day/unit pages; all 2329 mappings and 19 original hyperlink occurrences preserved. Reading leaves progress/cursor unchanged. Evidence: docs/M3-STEP2-VERIFICATION.md and docs/m3-step2-served-audit.json.

- M3 step 3: daily orientation and Day/Study/Exercise links on all 546 day/unit views; day pages include original study, ordered tasks, contextual resources and expanded AI/criterion blocks. Shared source-only workspace model and resource cards. All 84 tests pass, including all 182 daily models and full 2329-mapping/19-hyperlink rendering. Focused HTTP audit: 17 pages, 62 mappings, 15 daily/sequence views and 16 outline views; progress/cursor unchanged. Desktop/mobile keyboard journey and reflow pass. TypeScript, ESLint and production build pass. Evidence: docs/M3-STEP3-VERIFICATION.md and docs/m3-step3-served-audit.json.

- M3 step 4: shared loading skeleton and distinct missing/setup/unpublished/unavailable recovery states. Pre-stream authenticated availability checks preserve pinned releases and set 404/503; strict Host/CSP/ownership checks remain. All 96 tests pass, including full source rendering and every published route availability. Focused HTTP audit passes 17 valid pages plus strict missing-route checks. Actual absent-database 503 and browser retry recovery verified; mobile missing-page recovery passes. Build/lint/types pass. Production runtime startup remains blocked by automatic approval review. Evidence: docs/M3-STEP4-VERIFICATION.md and docs/m3-step4-served-audit.json.

- User instructions govern engineering; manual assignments are curriculum content, not platform instructions.
- Requested Next/React/SQLite/Drizzle/better-sqlite3/Tailwind/Zod stack; Argon2id 64 MiB/3/p1/max two concurrent; opaque digest-only sessions. No new dependency or paid service in M2.
- Verified portable runtime: ../../work/toolchain/node-v24.21.0-win-x64. Do not bypass broken system npm trust.
- Official release se-26w-v1 manifest: 064d4412b280d54c7bf2fb229e7ec643eb3dc8ab85f9311bf9f9a5749c5cb265. Never change published normalized content, applied SQL or archive hashes to bypass validation.
- Normal setup imports into data/learning.sqlite or APP_DATA_DIR. Existing enrollments remain pinned; upgrades are explicit future operations.
- M1 demo remains separately in .tmp/m1-demo with its two-unit development-day1-v1 release; old accounts/progress preserved.
- Current preview at http://127.0.0.1:3000 uses APP_DATA_DIR=<repository>/.tmp/m2-preview with synthetic accounts. To resume it, set that absolute path then npm run dev. Ordinary setup/dev uses the normal data directory; see README.
- All 208 resource instructions remain exact. Parent-resource matches are added interpretations using original URLs; 57 unmatched instructions are explicitly unresolved. Live availability unchecked.
- Full-release content is a reading preview; full exercise/progress semantics remain M4–M5. Preparation already works. Guides/resources/tasks/scorecards add no required progress units.

## Open issues / final acceptance

- Separate production-server startup was rejected by automatic approval policy; development browser/HTTP evidence recorded. Production Playwright/axe remains pending because of host IPC restrictions.
- Real reboot, full browser-process shutdown, screen reader, macOS/Linux and disconnected-network checks remain final gates. A01–A26 are not declared fully passed.
- Existing two Turbopack filesystem-tracing warnings and ESLint 9 support warning remain tracked.
- Remaining M3 work includes full mobile navigation drawer and scorecard heading (currently first mapped cell). Change presentation labels without changing published data.
- Notes/search/scorecard entry/profiles/recovery/backup/update tooling remain later milestones.

## Exact next focused task

After explicit user approval, M3 step 5: mobile navigation drawer with the same primary destinations and course hierarchy. Follow specification section 15: accessible trigger, modal focus containment, Escape close and focus restoration. Preserve the existing outline, source content and read-only navigation. Test keyboard, mobile reflow and recovery, then stop and ask again. Keep M4 completion controls outside this increment.

Relevant files: IMPLEMENTATION_PLAN.md; archived product-specification.md; src/server/content/read.ts; src/components/curriculum-preview.tsx and full-curriculum-page.tsx; course catch-all; tests/integration/curriculum.test.ts. Import decisions and reproduction commands: docs/M2-VERIFICATION.md.
