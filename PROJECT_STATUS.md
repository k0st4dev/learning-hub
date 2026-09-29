# Project status

Updated: 2026-09-29. M0 complete. M1 working Day 1 slice complete within its isolated development-fixture scope. **Stop after M1 at the user's request; resume M2 when they return in the morning.**

## Completed

- Full handoff reviewed and independently compared with original DOCX.
- M0: pinned stack/toolchain, local guards, test harness, notices, clean install/native checks. Commit 12e98ce.
- M1: reference migration/typed schema, immutable Day 1 fixture, secure accounts/sessions/throttles/CSRF, preparation, dashboard/lesson/exercise, evidence and transactional progress/revisions/idempotency/reopening.
- 52 unit/integration tests, strict TypeScript, lint and production build pass. Repeat setup preserves records.
- Browser completion/restart/re-login passed with 2/2 retained. Second account starts at 0/2. Continue resolves to fixture completion. Desktop/mobile evidence: docs/M1-VERIFICATION.md.

## Decisions

- User instructions govern engineering; manual assignments are curriculum content.
- Requested Next/React/SQLite/Drizzle/better-sqlite3/Tailwind/Zod stack; Argon2id 64 MiB/3/p1/max two concurrent; opaque digest-only sessions.
- Use verified portable Node 24.21.0/npm 11.19.0 in workspace work/toolchain. Do not bypass broken global npm trust.
- Dependency lifecycle scripts disabled; setup tests supplied native prebuilds. No paid/cloud runtime dependencies.
- Canonical origin http://127.0.0.1:3000. Fixture .tmp/m1-demo remains separate from ordinary student data; preserve it for preview records.
- Fixture release development-day1-v1 has two required units. Official full release is not imported.
- Checksummed SQL/fixture JSON retain exact bytes through .gitattributes. Never edit applied migrations/published bodies.
- Next build uses worker threads/TypeScript API; development uses public Next server API in one process.

## Open issues / final acceptance

- Production Playwright IPC restricted; full browser/axe matrix pending. Development browser evidence recorded separately.
- Real reboot, full browser-process shutdown, screen-reader, macOS/Linux and disconnected-network checks pending. All final A01–A26 statuses remain pending until complete release verification.
- Two Turbopack filesystem-tracing warnings: review before standalone packaging. ESLint 9 support warning tracked until compatible Next lint plugins support ESLint 10.
- Full content, profiles/password change/recovery, notes/search/scorecards and multi-day navigation/scroll anchors belong to later agreed milestones.

## Exact next task when resumed

M2 only: read specification section 12 and plan import checks. Build complete immutable importer/source archive from supplied JSON, mappings and original DOCX into the existing reference schema. Preserve 6 phases, 26 weeks, 182 days, 548 task lines, 7 preparation items, appendices/tables, 14 scorecard dimensions and 19 hyperlink uses/12 URLs. Validate original text/provenance and 364-unit denominator before publishing. Test import rollback, identical no-op, changed-release rejection and student-record preservation. Extend authenticated reading routes enough to audit imported coverage; broad navigation polish is M3. Reuse existing services; do not reread/regenerate the entire repository.

Startup from repository: npm run setup:demo then npm run dev:demo, with verified portable runtime first on PATH on this host. Preserve .tmp/m1-demo. Full instructions in README.
