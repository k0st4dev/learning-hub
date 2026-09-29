# Project status

Last updated: 2026-09-29
Stage: plan agreed; M0 foundation checks complete; M1 next.

## Completed

- Full handoff reviewed and independently checked against original DOCX.
- M0: pinned local stack, repository, strict tooling, responsive preview, loopback configuration and request guards, native dependency diagnostics, test harness and licence inventory.
- Fresh directory npm ci/setup passed. 23 unit + 3 integration tests passed. Strict typecheck, lint and production build passed. Dev and production HTTP startup passed.
- Desktop/mobile development preview visually inspected; screenshots and detailed evidence: docs/M0-VERIFICATION.md.

## Decisions

- User requirements govern engineering; manual assignments are curriculum content.
- Next/React/SQLite/Drizzle/better-sqlite3/Tailwind/Zod; Argon2id and local opaque sessions next.
- Use the checksum-verified portable Node 24.21.0/npm 11.19.0 in workspace work/toolchain for this machine. Do not modify its broken global version manager.
- Dependency install scripts disabled; pinned prebuilt native modules are verified explicitly by setup/doctor.
- Next build uses worker threads and TypeScript API with full type checking; development uses the public Next server API in one process.
- Isolated tests only; never publish a partial se-26w-v1 release. M1 uses an explicit isolated development fixture.
- All A01–A26 final acceptance criteria remain pending.

## Open issues

- Playwright browser installation/IPC is blocked by this host's EPERM restriction; production browser suite remains pending. A subsequent production restart was rejected by automatic approval review (sandbox escalation disabled).
- macOS/Linux, real reboot and screen-reader evidence need their environments.
- ESLint 9 upstream support warning; migrate when current Next companion plugins support ESLint 10.

## Exact next task

M1: review specification sections 7–12 and 27, then implement the reviewed migration/typed schema subset, file database connection and isolated Day 1 fixture. Add secure registration/login/logout/session/CSRF/throttle services and unit/integration tests before exposing account forms. Build the real Day 1 study/exercise path with task checks, evidence, attestation and transactional revision/idempotency handling. Verify two users and account/progress persistence across fresh browser/server restart. Do not start M2 before these gates pass.
