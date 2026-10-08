# M6 step 7 — curriculum search interface

Date: 2026-10-08. Implements specification sections 9/10/17 and the shared navigation/accessibility requirements. Search is complete in the tested development and service scope. Resource library filters, copyable handbook tools and final A01–A26 acceptance remain open.

## Delivered behavior

- Protected `/search` page, header/student-menu entry and Resources search form. The latter opens resource-filtered results through the existing shared leave guard. All results use the student's enrolled immutable published release.
- A 250 ms debounce starts after two characters; a one-character technical term requires deliberate Search/Enter. Query, repeated kind/module/week/day filters and page are ordinary URL state. Back/Forward and return from a result restore the actual address, including when Next restores an older server snapshot.
- All nine content kinds are available, with six original phase choices, 26 weeks and 182 days. AND between dimensions and OR within a dimension preserve the existing validated API contract. Scope lists permit up to eight values and expose native keyboard selection instructions.
- Twenty ranked matches per server page, grouped by content type in first-result order and ranked within each group. Result numbers preserve global server ranks. Original titles/snippets retain Serbian text; added day/study/exercise labels distinguish duplicate daily titles. Original breadcrumbs and safe local links remain available. Highlights use escaped React text and `mark`, including decomposed accents/Serbian normalization, never raw source HTML.
- Loading/live count, empty guidance, no-match clear actions, validation and retry with retained input. Manual submission errors receive focus. Empty guidance displays only the actual owned saved last-opened reference (zero or one); there is no fabricated history, new tracking table or progress/cursor mutation.
- Abort/sequence checks ignore old replies. No-store reads send `x-expected-student`: a mismatch returns 403 without selecting that identity or writing records. The UI validates the returned release, canonical criteria and local result links before displaying them. Session/account errors remove results and offer explicit sign-in/reload. The header is an additive account-switch safety guard; ownership still comes exclusively from the server session. Shared URLs contain no student identity.
- Existing note/exercise/scorecard draft protection applies to result/header navigation. Responsive wrapping and 44-pixel content-type labels preserve basic narrow use. No schema, dependency, source archive or published-release changes.

## Verification

- **397 tests / 33 files pass in 86.05 seconds**, including the complete existing source/rendered curriculum, authentication, 364-unit progress, restart, notes and scorecard regressions. The focused search/navigation gate passes **49 tests / four files**. Nineteen new cases cover URL parsing/Unicode/safe links, owned page context/account header, debounce/Enter, grouped markup, pagination/filters/history, error/focus/retry, stale responses, account/release changes, Resources draft guard and stale server snapshot restoration.
- Strict TypeScript, full ESLint, repository Prettier, optimized build, source archive inventory/integrity and licence check pass. All 560 locked dependencies and 574 supplied notice files remain. The existing two Turbopack filesystem-tracing warnings remain; no warning was suppressed.
- [Actual two-account HTTP audit](m6-step7-http-audit.json), repeated after stopping/building/restarting the development server on the same `.tmp/m2-preview` database: search/resource forms, 6/26/182 scope inventories, nine kinds, expected-account guard, Unicode equivalence, 20-plus-3 Git paging, invalid/empty/auth/filter cases and ten served result destinations pass. Full durable enrollment, progress, preparation, notes, scorecard, activity and receipt fingerprints remain unchanged. Authentication retains its normal session bookkeeping.
- Sixteen warm development HTTP samples after restart: median 10.11 ms, maximum 12.82 ms on Windows x64 / i7-13700. These are observations, not production performance acceptance.
- Actual browser: Git returns 23 results; next page shows the remaining three; Back returns page one. Opening the real Day 1 study lesson and returning retains Git; subsequent Exercises/week-one selection keeps Git in the URL. One-character C submitted with Enter returns results. A nonmatching query shows zero and Clear query restores guidance. The Resources form opens `/search?q=MDN&kind=resource` with highlighted original results.
- An existing history confirmation appeared on the study return and was explicitly accepted without editing the lesson. The search restore bug found during browser testing was fixed: an older cached initial server query could replace the address's Git when changing a filter after Back. A dedicated stale-mount regression now checks retained query/page/filter state.
- Browser draft check on an existing synthetic monthly account: type unconfirmed Git evidence, click header Search, choose Stay and verify the text remains, then explicitly discard the test text and reach Search. No Save was performed. The unchanged durable-record audit also passes afterwards.
- Desktop override requested 1440×900; the host's scaling measured 1152×720 CSS viewport and 1140 document width. Narrow override requested 360×800, measured 288×640, 276 document width and 186.4 input width: no horizontal document overflow. The override was reset, only the agent-created test tab was closed, and user tabs were preserved. [Inspected browser screenshot](m6-search-ui.png) records the real query/count/header.

Reproduce the automated checks:

```sh
npm exec vitest run tests/unit tests/integration --configLoader=native --maxWorkers=2
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run curriculum:verify-source
npm run licenses:check
# Running isolated preview only; APP_DATA_DIR = absolute .tmp/m2-preview:
node scripts/audit-search.mjs --ui
```

The HTTP script reuses existing ignored synthetic credentials in `.tmp/m6-scorecard-review-http-state.json` without printing or committing them. The existing verified portable Node runtime was used; runtime trust restrictions were not bypassed. The default script still preserves the earlier step-6 report; `--ui` writes this step's report.

## Next focused task and limits

After approval: M6 step 8, resource library filter/read model. Read specification section 16, immutable resource/resource-use metadata and existing catalog/detail reader. Implement owned pinned-release source/type/module/week/day/required-optional-reference filters, normalized resource query, 25-result stable title/ID pages, all resolved/unresolved mentions and context-specific requiredness. Validate combined filters and unchanged records/original URLs with focused tests. Keep the library UI and handbook copy tools as following separate increments.

Final MVP acceptance is incomplete. Production runtime/Playwright/axe, full screen-reader/viewport matrix, real reboot/full browser shutdown, offline and macOS/Linux installation evidence remain pending under previously documented host limits. The development Gzip listener warning remains tracked for M9. GitHub push remains a normal-PowerShell operator action; no restricted agent proxy retry/bypass was attempted.
