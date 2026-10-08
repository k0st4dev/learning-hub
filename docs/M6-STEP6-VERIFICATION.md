# M6 step 6 — normalized curriculum search backend/API

Date: 2026-10-08. Implements specification section 17 and the GET /api/search contract in section 10. This increment completes the backend; search controls, grouped results and browser navigation are step 7. A19 and final A01–A26 remain open until UI and integration acceptance.

## Behavior and decisions

- Search derives the student and enrollment from the existing server session. It searches only that enrollment's published immutable release, never the newest available release or a submitted user/release identity. No enrollment returns 404; unavailable or retired pinned content returns 503. Existing local Host/Origin protections and no-store responses apply.
- All curriculum items, their substantive mapped source text and all resource records are indexed. This covers phase/day/lesson titles, week topics/objectives, study text, exercise/task instructions, preparation, handbook/appendix text and resources including unresolved mentions. Original resource URLs and related source assignments are included. Document furniture is excluded. Original display titles, plain source snippets and local reading destinations remain unchanged.
- The SQLite TEMP representation contains content only. Import derives it within the publication transaction, including identical no-op reseed; failed derivation rolls publication back. Each new connection rebuilds it lazily from the pinned published content on first search. No persistent schema migration, release hash, source file, dependency or student record changes. Backups do not need to preserve this disposable index.
- The connection cache is keyed by release/manifest and verifies the TEMP inventory, so a rolled-back caller transaction cannot leave a falsely valid cache. Every request rechecks published status. Private notes, passwords, profiles, saved exercise evidence and scorecards never enter the index.
- Matching uses NFKD, Unicode mark removal, lowercase and explicit Serbian đ → d. Original Serbian remains available in titles/snippets. English technical punctuation is literal. The query is trimmed and limited to 100 UTF-16 code units and eight whitespace-delimited words; every distinct word must match the title/body combination. There is no operator language, hosted service or FTS dependency. SQLite LIKE parameters escape percent, underscore and backslash.
- Ranking: exact title, prefix title, all words in the title, then body/combined matches. Ties follow the actual curriculum hierarchy preorder, then ID. Repeated words do not change the literal exact-title phrase. Pagination is fixed at 20, pages 1–10,000; an out-of-range valid page returns an empty result list with the unchanged total.
- Minor unspecified filter contract: repeated kind/module/week/day URL parameters combine with OR within a dimension and AND across dimensions. Module/week/day values are stable curriculum keys such as w04/d028; resource scopes come from all related source uses. Unknown stable keys yield no matches. Unknown parameters, duplicate q/page scalars, unsupported kinds, excessive filter values and malformed pages return 400 rather than selecting a foreign scope. Resource library type/source/requiredness filters remain a later increment with its separate 25-result contract.
- Each result supplies id, kind, original title, local href, original plain snippet and breadcrumb title/href pairs. Snippets use at most 180 code points plus boundary ellipses without splitting surrogate pairs. These fields must be rendered as escaped text by the following UI; no raw HTML is created. Empty/normalization-only queries return zero results for UI guidance. One-character technical terms are accepted for deliberate Enter submission; two-character debounce behavior belongs to step 7.
- Search and its destination URLs are ordinary reference reads. No progress, cursor, note, scorecard, receipt or activity writes occur. Authentication can retain its existing session bookkeeping.

## Verification

- **24 focused tests / 2 files pass**: Serbian/decomposed Unicode/English terms; bounded validation and literal wildcard escaping; safe original excerpts; every imported item's title/body/href, all substantive source mappings and every original resource URL; no-op import; all main searchable categories; AND matching; ranking/source-order/ID ties and disjoint pagination; combined filters including resource contexts; empty/no matches; owned release isolation and retired release rejection; private notes excluded for both users; protected actual GET handler/no-store/errors; unavailable database; connection restart and rollback recovery.
- A deliberately malformed TEMP schema makes import fail; no release/content rows are published and foreign-key checks remain clean. Synthetic ranking rows temporarily replace only derived TEMP rows, then restore the original inventory; published content is never edited.
- **Complete regression: 378 tests / 32 files pass in 72.70 seconds.** Existing full rendered curriculum coverage, authentication, progress persistence, notes, scorecards and navigation regressions pass. After strengthening original text/link coverage and using explicit .ts paths for Node's importer dependency graph, the focused 24 tests, strict types and optimized build passed again.
- Actual curriculum CLI dry-run and identical import pass against the isolated preview: imported=false, unchanged manifest 064d4412b280d54c7bf2fb229e7ec643eb3dc8ab85f9311bf9f9a5749c5cb265 and original Word SHA-256 5e5884f8f919b24d4924c6393ece6d36256f288529499c4e9e5e3d0921377513. No reseed reset was performed.
- Strict TypeScript, full ESLint, optimized build and source integrity pass. All 560 locked dependencies and 574 supplied notice files are preserved. The two existing Turbopack filesystem-tracing warnings remain tracked.
- [Actual HTTP audit](m6-step6-http-audit.json) uses two existing synthetic preview accounts, repeated after the same-database development-server restart. Unicode-equivalent results, pagination, filters, query validation, logout/auth failures and ten served result destinations pass. Hashes of all persisted enrollment, learning, notes, scorecard, activity and receipt records remain unchanged.
- The audit initially assumed a full second page of twenty Git matches. The preview has 23 total matches, so its assertion now checks the exact remaining page length and disjoint IDs; no search code was changed for that fixture correction.
- Sixteen warm development HTTP samples on Windows x64 / Intel Core i7-13700: median 22.3 ms, maximum 30.48 ms. These are local development observations, not production performance acceptance or universal timing guarantees.

Reproduce:

```sh
npm exec vitest run tests/unit/search.test.ts tests/integration/search.test.ts --configLoader=native --maxWorkers=2
# Against the running isolated preview only:
# APP_DATA_DIR = absolute repository .tmp/m2-preview path
node scripts/audit-search.mjs
```

The HTTP audit reads ignored .tmp/m6-scorecard-review-http-state.json credentials without printing them. It creates no new learner data and does not reset existing fixtures. Do not commit that credential file. The existing verified portable Node runtime was used on this host; the documented npm/runtime trust restriction was not bypassed.

## Exact next task and limits

After approval: M6 step 7, search UI. Reuse the typed query/result contract and API. Read specification sections 9/17, existing header/navigation, loading/recovery and unsaved-note/task/scorecard navigation controls. Add header/Resources entry, URL-restored query/filters/page, 250 ms debounce after two characters, one-character Enter, grouped escaped results/highlighting, breadcrumbs and paging. Cover empty guidance/recent references, no matches/clear filters, error/retry with preserved input, stale requests/account changes, keyboard and basic responsive behavior. Keep result navigation as reference browsing and preserve drafts/progress/cursor. Resource-specific filters and copyable handbook templates remain separately scoped later work.

No new search page or browser search UI is claimed here. Existing production-server/Playwright/axe, real reboot/full browser shutdown, screen reader, offline and target-OS installation evidence remain pending. Final MVP acceptance is not complete. GitHub push remains an operator step through normal PowerShell; the restricted agent proxy was not retried or bypassed.
