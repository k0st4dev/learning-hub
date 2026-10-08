# M6 step 11 — protected resource-library HTTP API

Date: 2026-10-08. Exposes the existing reviewed resource read/filter service through the local Next.js application. Visible library controls remain the next separately approved increment.

## Contract and scope

`GET /api/resources` runs in the Node.js runtime and returns `{ data: ResourceLibrary }`. It reuses the existing session, local Host/Origin request guard, strict resource URL parsing, owned pinned-release service and shared no-store response/error boundary. It accepts `q`, `page` and repeated `source`, `type`, `module`, `week`, `day`, `requirement` parameters. Scalar duplicates, unknown fields, submitted owner/release IDs and oversized/invalid values are rejected rather than silently ignored. The optional `x-expected-student` header detects a stale account; it cannot select an account.

The response preserves original resource/use metadata and separate effective labels, source evidence, caveats, ambiguity, full related contexts, matching use IDs, related days, filter options and interpretation version. Source keys come from returned options, including `provider/MDN` and `provider-unspecified`; type/requirement filtering uses effective tags. The same-use AND, within-dimension OR, literal normalized query and stable 25-result pagination are shared with the tested service. Raw fields and all 69 resources/290 uses/19 original hyperlink uses remain intact. Required labels add no course credit or external grading requirement.

Success and JSON error responses use `Cache-Control: no-store`. Statuses: 400 invalid query, 401 absent/invalid/expired/revoked session, 403 local request rejection/account change, 404 missing enrollment, 503 unavailable database/content/label binding. Failed reads return an error with request ID and no partial `data`. The framework supports HEAD through GET and rejects POST with 405; no write handler is provided. Normal session lifecycle maintenance remains possible, but curriculum/learning/private records are not changed by reads.

No importer, database schema, source/interpretation artifact, dependency, progress rule, existing Search handler, resource detail route or UI component is changed. The eighteen parent-binding and fifteen named-mention proposals remain separately scoped; this endpoint does not implement them.

## Verification

- **427 unit/integration tests / 36 files pass in 82.71 seconds**. The focused resource API/service/Search gate passes **38 tests / 3 files**. Eight new integration tests call the real route handler against a fully imported real SQLite database, with only the configured store provider replaced by the isolated test store.
- Tests compare all original raw resource/use fields, effective output and pagination to the existing service. Reviewed provider/type and requirement scopes cover optional TOP versus required CS50, Day 25 alternatives, Day 127 as-needed PostgreSQL, Day 146 used-topic conditions, Day 182 restrictions, unknown provider choices and impossible filters. Both Serbian spellings produce identical results while retaining the student's original query in the response.
- Validation covers scalar duplicates, zero/fractional/over-limit page, unknown fields, prototype key, wrong enums, empty/oversized source, excess array values, query character/word limits and submitted user/release identifiers. Authentication covers absent/invalid/expired/revoked sessions, unenrolled users, wrong Host/Origin and stale/empty expected-owner headers. Responses preserve no-store and contain no success data on failure.
- Distinct synthetic users have separate notes and 1/364 versus 0/364 confirmed work. Private note queries return no matches, no private note/user IDs are returned, and stable fingerprints across users/enrollments/progress/tasks/preparation/notes/scorecards/history/receipts and published content/source/mappings remain unchanged. Closed-database errors return 503; reopening the same database returns identical effective labels/provenance/results with unchanged fingerprints.
- Label drift is injected into one cloned read snapshot to test route propagation of 503 `RESOURCE_LABELS_UNAVAILABLE`, without rewriting the published release. The existing index is warm before this check; the real label validator receives that invalid snapshot. The following valid request recovers. All original malformed-artifact and immutable-content service tests continue passing.
- Direct strict TypeScript, full ESLint, formatting, diff checks, original archive integrity, frozen-label reproduction and dependency licence/notice checks pass. Production build passes with the same two existing filesystem-tracing warnings. Build output now includes `/api/resources`.
- [Real local HTTP audit](m6-step11-http-audit.json) passes after restarting the preview on the same `.tmp/m2-preview` database: two existing synthetic accounts, 30 valid resource reads, complete original 69/290/19 inventories per account, effective filters, Unicode, pages, query errors, expected-account guard, HEAD, rejected POST, login/logout and exact equality of public results between users. All durable learner/private/published-content fingerprints remain unchanged. Credentials are read only from the existing ignored synthetic fixture and never printed or included in reports.
- The preview launcher/listener were stopped only after runtime-path/start-time ownership checks; the replacement uses hidden launcher PID **52716** and the same data directory. `/login` returns 200. Generated type declarations are excluded from committed changes. No normal-data setup or account reset.

Two initial test assertions incorrectly compared the retained query spelling and referenced a nonexistent snapshot field; a header-fixture union also failed strict typing. They were corrected to preserve query fidelity and inspect actual confirmed units, without changing application behavior or weakening assertions. Final checks above pass.

No browser UI, new viewport/accessibility session, complete served-route audit, production startup/performance or final A01–A26 acceptance is claimed. Existing final production/axe, reboot/offline/screen-reader/target-OS and later-MVP gates remain open. GitHub publication remains the existing normal-PowerShell operator action.

Reproduce:

```sh
node node_modules/vitest/vitest.mjs run tests/unit tests/integration --configLoader=native --maxWorkers=2
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run curriculum:verify-source
node scripts/freeze-resource-labels.mjs --check
npm run licenses:check
```

With the preview already running and the existing synthetic fixture available, set `APP_DATA_DIR` to the absolute `<repository>/.tmp/m2-preview` path, then run `node scripts/audit-resource-library.mjs`. This developer audit deliberately refuses another data directory and does not create/reset accounts or learning records.

## Exact next task

Ask before M6 step 12: visible resource-library controls on `/resources`, using the existing service for the authenticated initial read and the new API for updates. Preserve the existing original source blocks/mappings, resource detail links and unsaved-work protection. Provide query/provider/type/phase/week/day/contextual requirement controls, clear filters, count/25-result pages, URL/Back restoration, original/added label distinction, unknown-link wording and loading/empty/error/retry/account-change states. Reuse Search request/navigation patterns and shared resource helpers. Verify desktop/keyboard behavior and basic narrow reflow, same-use semantics and unchanged two-user records. Parent regrouping/new mentions remain separate approval and coverage increments.
