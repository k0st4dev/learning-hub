# M7 step 6 — authentication integration

Verified 2026-10-12 in automated/local-service scope. M7 profile, appearance, password change and trusted-owner recovery are implemented. Native browser closeout and final MVP acceptance remain open. This step consolidates evidence and repairs three gaps found during review.

## Repairs and additional checks

- Login/registration now clear password and confirmation fields after success or failure, on pagehide and on unmount. Email/display name survive failures. Pending controls lock and an immediate request guard prevents double submits. A response arriving after unmount cannot force navigation. Password managers, exact Unicode/spaces and existing return-path validation remain supported.
- A valid signed-in visitor to Login or Register redirects to Dashboard. Registration redirects consistently with Login; create another account after signing out. Absent, malformed, expired or revoked sessions retain the public forms. Setup/database unavailability does not prevent reading recovery help or the public form; writes still report the actual setup failure.
- The existing API retry delay is now retained by the client and displayed by the auth form. Only positive safe integer delays are accepted. Rate-limited requests clear secrets while preserving email and show the wait measured from that attempt.
- New tests cover those states, five-minute session-touch throttling without extending the 30-day maximum, persisted legacy Argon2id parameter upgrade, rollback of hash upgrade/session insertion, and a delayed login rehash racing password change. Existing tests cover duplicate registration, generic unknown-user errors/dummy hashing, limits, idle/absolute expiry, ownership, password change, CLI recovery and record preservation.

## Verification

- Focused new/updated auth integration: **22 tests in three files pass** (seven form, four client-error and eleven lifecycle cases).
- Final complete unit/integration run: **625 tests, 53 files pass**, 84.69 seconds. Final type checking, full lint and production build pass. Build retains the two existing filesystem tracing warnings.
- Source integrity/licence checks pass: all ten archived files, six phases, 26 weeks, 182 days, 548 task lines, 2365 blocks and 2329 mappings retain their inventory/checksums. 560 locked dependencies and 574 notices remain. No dependency, migration, importer, curriculum or learning-rule change.
- Actual post-build **local production HTTP**, followed by stop/restart on the same database: six existing synthetic accounts spanning settings, changed-password and recovered-password fixtures; 43 served pages/redirects, 38 private API reads, ten rejected foreign-account reads and eight expected unauthorized reads (idle/absolute/revoked session controls plus rotated/logout tokens). Signed-in Login/Register redirect correctly both before and after restart. Login rotates the current token, logout invalidates only its session, and a pre-login CSRF signature cannot authorize a post-login settings write.
- All six stored cookies authenticate after restarting **without another login**, preserving exact settings and private notes; the four enrolled accounts preserve their learning-state fingerprints and Continue routes. Twenty-five durable table fingerprints are unchanged. Integrity/FK checks pass. Temporary expiry-control sessions were removed in `finally`; existing real accounts were not written. See [HTTP evidence](m7-step6-http-audit.json).
- The developer audit is restricted to `.tmp/m2-preview` and verified synthetic email prefixes. Run `node scripts/audit-auth-integration.mjs prepare`, stop/restart the same app/data directory, then `node scripts/audit-auth-integration.mjs verify`. Raw credentials/tokens exist only in ignored local fixtures and are not printed or included in the report.

The M7 steps 1–5 reports remain the evidence for additive migration/preservation, conflict and exact retry handling, owned theme rendering, current-password checks/all-session revocation, and the actual Windows hidden-input/cancel/recovery demonstration. This integration does not reset passwords or re-seed curriculum.

## Relevant acceptance status

| Criterion               | Current evidence                                                                                                         | Remaining final gate                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| A01 registration/login  | Real synthetic signup/login journeys in earlier milestones; canonical duplicate race, safe return paths and tested forms | Native browser journey and final clean-install acceptance                                |
| A02 separate records    | Full service suite, six-account HTTP reads, foreign guards and unchanged durable records                                 | Native account-switch/cached-page closeout and final complete private-data demonstration |
| A03 secret handling     | Argon2id/salts/parameters, digest-only sessions, cookie flags, safe responses, form cleanup and actual non-echoed CLI    | Final browser data/log/DOM inspection                                                    |
| A04 auth lifecycle      | Login/logout/rotation, expiry/touch limits, persistent throttling, rehash/races, password change and real local recovery | Native password-manager/keyboard/form journey and supported-OS checks                    |
| A05 persistence         | Reopening, production app restarts, valid cookie persistence, password recovery and unchanged records                    | Actual computer reboot and final acceptance journey                                      |
| A19 curriculum coverage | Frozen source archive and earlier full Word/CSV/served-route mapping evidence unchanged                                  | Final integrated coverage rerun                                                          |

Other A01–A26 criteria continue under the existing acceptance matrix; none is declared finally passed merely because this suite passes. Backup/restore/update procedures, production browser/axe/contrast/screen reader/basic responsive/offline/OS installation and final delivery remain later work.

Supported browser reset/rebind still fails before page access with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. No native keyboard, screenshot, hydration, password-manager or responsive visual pass is claimed. Recorded M6 draft/viewport/tab checks remain unresolved; no cleanup is assumed. Existing browser checks must close before final delivery. Desktop remains prioritized with basic mobile regression as requested.

Next after confirmation: M8 step 1 verified online SQLite backup with release/source manifest metadata, integrity checks and README commands. This operations work is independent of the remaining browser host failure; preserve those manual gates. Do not start the next focused increment without the user's approval.
