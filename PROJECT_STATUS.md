# Project status

Updated: 2026-09-30. **M0–M2 complete; M3 step 1 complete.** The user now requires confirmation after every M3 step. **Wait for approval before step 2.**

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
- M3 navigation polish includes full outline, previous/next boundaries, route states and scorecard heading (currently first mapped cell). Change presentation labels without changing published data.
- Notes/search/scorecard entry/profiles/recovery/backup/update tooling remain later milestones.

## Exact next focused task

After explicit user approval, M3 step 2: implement a compact expandable course outline using src/server/content/navigation.ts. Show phase → week → day → study/exercise, expand the current path and mark the current page. Avoid showing all 182 days at once. Verify keyboard use, mobile reflow and access to every day. Preserve immutable content and read-only reference navigation. Stop, report and ask again before the following step. Daily workspace polish, route-state UX and the full mobile navigation drawer remain later M3 steps; do not mix in M4 or M6.

Relevant files: IMPLEMENTATION_PLAN.md; archived product-specification.md; src/server/content/read.ts; src/components/curriculum-preview.tsx and full-curriculum-page.tsx; course catch-all; tests/integration/curriculum.test.ts. Import decisions and reproduction commands: docs/M2-VERIFICATION.md.
