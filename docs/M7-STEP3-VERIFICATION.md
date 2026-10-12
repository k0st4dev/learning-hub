# M7 step 3 — password change and session revocation

Verified 2026-10-12. This increment implements the owned service and `POST /api/auth/password`; the Settings password form is the next separately approved step. Local interactive recovery and remaining authentication acceptance checks follow later. M6 browser closeout and final A01–A26 acceptance remain open.

## Contract

`changePassword(store, token, input)` requires a valid current session, current password, new password and `expectedStudentId`. The extra account guard detects a stale tab/account switch; identity always comes from the session. No submitted ID selects a target account. The request is a strict object and rejects extra fields.

The existing new-password policy is reused: 15–128 Unicode code points, at most 512 UTF-8 bytes, bundled common-password rejection, no trimming/normalization, Argon2id with a fresh salt, 64 MiB memory, three iterations and parallelism one. Current-password input is bounded to 512 UTF-8 bytes. Hash operations retain the existing two-operation concurrency limit.

The service verifies the current hash, computes the new hash asynchronously, then rechecks both the session and unchanged credential inside an immediate SQLite transaction. Updating the hash, revoking all currently unrevoked sessions for the owner and clearing the owner's password-change failures are atomic. Existing revoked timestamps are preserved; the calling session is revoked along with the others. Other accounts retain their hashes and sessions. Learning/private/content tables and settings revisions are untouched. The account's general `updated_at` changes; the settings DTO consequently reports that new timestamp without changing the saved settings or settings revision.

There is no secret-bearing mutation receipt or automatic replay. Success returns an empty 204 and clears the session and CSRF cookies. A repeat using the revoked session returns 401. An uncertain response must be resolved by signing in with the chosen new password, then using the former password if the change was not committed; never silently submit another change. The future UI must explain this and clear password fields after requests.

Wrong current passwords return 400 with an inline field error. Expired/revoked authentication returns 401, an account switch returns 403, and an independently changed credential returns 409. The route uses the existing exact local Host/Origin, session-bound CSRF, bounded JSON, no-store responses and sanitized error boundary. Passwords, hashes and tokens are absent from response bodies and reports.

## Security decisions and related repair

Password-change guesses use independent persisted AuthThrottle keys: five failures per account and ten per installation in 15 minutes, then a temporary 15-minute block with retry information. Success clears the account's password-change failures; the installation count remains. These keys do not consume login limits. This applies the existing login-sized limits to the newly introduced credential-checking endpoint without a schema change.

The existing login path required a race repair: a password could change during asynchronous verification/rehashing, allowing an old credential to issue a session after revocation or replace the new hash. Login now compares the originally verified hash with the current stored hash inside the session-insertion transaction, rechecks throttling there and performs any rehash in that transaction. A changed credential receives the normal generic incorrect-credentials response. A deterministic overlapping-login test confirms no session is issued from the old hash after password change.

## Evidence

- Focused password/authentication suite: **20 tests passed**. Fourteen new cases cover unique correctly configured Argon2id replacement, all-owner session revocation, peer isolation, close/reopen/fresh login, exact spaces/Unicode, common/short/oversized password rejection, strict unknown fields, missing/revoked sessions and account guard, persistent throttle/unblock/peer independence, transactional rollback, overlapping stale login, session revoked during hashing, and actual route/CSRF/cookie/secret checks.
- Complete unit/integration suite: **568 tests, 47 files passed**, 93.98 seconds.
- Type checking, full lint, production build, source archive, licences and formatting passed. Build retains the existing two filesystem tracing warnings. All ten archived source files and the six-phase/26-week/182-day/548-task inventory are unchanged; 560 locked dependencies and 574 supplied notices remain preserved.
- Actual HTTP on the existing preview database: two uniquely named synthetic accounts, separate enrollment and notes, two owner sessions, empty 204 and cookie clearing, rejection of both revoked sessions, a normal server stop/restart, old-password rejection, new-password login, preserved peer login and exact confirmed notes/learning state/Continue/settings values. Seventeen durable table fingerprints remain unchanged from immediately before password change through the restart verification. See [HTTP evidence](m7-step3-http-audit.json).
- Developer reproduction: with `APP_DATA_DIR` pointing to the existing `.tmp/m2-preview`, run `node scripts/audit-password-change.mjs save`, stop/restart the same application/data directory, then `node scripts/audit-password-change.mjs verify`. Credentials and old tokens exist only in ignored local fixtures and are never printed or committed. Existing real accounts are not edited.

This step adds no visible password form. Native browser checks remain pending because the previously recorded browser tool cannot initialize. No final password recovery, desktop/mobile visual, production browser, OS reboot or complete MVP acceptance is claimed.

Next after user confirmation: M7 step 4 Settings password form with current/new password fields, password-manager/paste/Show password support, inline errors, safe pending/error handling, secret cleanup and login-required/uncertain-outcome behavior. Local recovery and integration checks remain separate increments.
