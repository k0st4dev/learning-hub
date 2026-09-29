# M1 verification — 2026-09-29

Scope: an isolated working Day 1 slice, not the complete MVP or a claim that A01–A26 pass.

## Implemented

- Reference SQL migration and typed Drizzle schema; foreign keys, WAL, synchronous FULL, checksums, repeatable setup and verified pre-migration backup when updating an existing database.
- Canonical email uniqueness, Unicode password policy, offline blocklist, Argon2id 64 MiB/3/p1 with concurrency two. Login/logout, opaque server sessions, expiry and persisted throttles.
- Exact Host/Origin, signed session-bound CSRF, bounded JSON, safe errors, page/service authorization and ownership through the current session.
- Explicit enrollment, seven advisory preparation checks and deliberate deferral. Original Day 1 study direction, objective, AI policy, criterion and four task lines.
- Independent lesson/exercise completion, evidence and attestation, derived percentage, reopening, revisions, idempotent retries, rollback and activity events.
- Minimal dashboard/course/day/lesson/exercise/progress views, English interface and Serbian curriculum language tags, labelled keyboard controls and confirmed saves.

## Evidence

| Check                                                                                        | Result                                                                     |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Unit/file-database integration suite                                                         | 52 tests pass across seven files                                           |
| Strict TypeScript and ESLint                                                                 | Pass                                                                       |
| Production build                                                                             | Pass; two dynamic filesystem tracing warnings below                        |
| Native SQLite/Drizzle/Argon2id diagnostics                                                   | Pass                                                                       |
| Repeat demo setup after browser completion                                                   | Existing migration and immutable fixture retained                          |
| Browser register → login → preparation → lesson → four tasks → evidence/criterion → exercise | Pass on local development server                                           |
| Sign out → close test tab → server stops → new server → fresh tab → login                    | Pass; dashboard retains 2/2 and completed lesson/exercise                  |
| Continue after completed fixture                                                             | Redirects to /course/software-engineer/progress                            |
| Second account                                                                               | Separate enrollment starts at 0/2; first account retained 2/2              |
| Desktop 1440px / mobile 360px                                                                | Progress page inspected; widths 1425px / 345px, no horizontal overflow     |
| Keyboard                                                                                     | Account/learning actions exercised using Enter/Space and labelled controls |

Tests cover concurrent duplicate registration, encoded hash parameters/salts, digest-only sessions, expiry/throttling, two users, forged identity/release IDs, missing auth, Host/Origin/CSRF, bounded input, safe errors, completion gates, equal weights, reopening, retry/conflict rules, separate reference cursor and rollback after simulated receipt-write failure.

Screenshots: m1-restart-desktop.png and m1-restart-mobile.png. Test accounts/evidence are synthetic and isolated in .tmp/m1-demo.

## Remaining verification and scope

- Production Playwright/axe matrix pending: host blocks browser child-process IPC. The development browser journey is separate evidence.
- Full browser-process shutdown and real computer reboot were not performed. The test tab was closed and application server restarted. Cross-platform installation, screen-reader and disconnected-network acceptance remain final gates.
- Two Turbopack dynamic filesystem tracing warnings in configuration need review before standalone packaging; local build passes and no deployment occurred.
- Complete curriculum/provenance/resources (M2), navigation (M3), non-default tasks/checkpoints (M4), all-course resume/debounced section tracking (M5), notes/search/scorecards (M6), profile/password lifecycle (M7), recovery (M8), full accessibility (M9), final A01–A26 (M10) remain.
- Never label this fixture se-26w-v1 or claim full-course progress. Fixture setup refuses paths outside the repository .tmp directory.
