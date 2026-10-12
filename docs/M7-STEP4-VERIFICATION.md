# M7 step 4 — Settings password form

Verified 2026-10-12 in automated and local-service scope. Settings now includes a separate password form using the M7 step 3 service. Local interactive password recovery, native browser closeout and final authentication/MVP acceptance remain open.

## Behavior

The form accepts current and new password only, with Show passwords, native paste, current-password/new-password autocomplete and a hidden account-email username hint for password managers. The existing specification reserves confirmation for registration; no extra confirmation field is introduced. The request carries the server-rendered expected account guard and is always owned by the current session.

Browser/server size validation shares a small pure function: 15–128 Unicode code points and at most 512 UTF-8 bytes. Input length permits 128 astral characters; passwords are not trimmed or normalized. The bundled compromised-password list and Argon2 implementation remain server-only. Validation errors link to labeled fields and focus the error summary. The server remains authoritative.

Before sending, the form invokes shared leave protection for other editors. Unsaved profile changes require Stay or an explicit discard decision; Stay retains both drafts and sends no password request. Password entry itself does not trigger a discard prompt when deliberately submitting it. Ordinary navigation protects entered passwords, and pending requests block duplicate submission, logout/navigation and accidental browser close.

Once sending begins, both visible password fields are cleared and Show passwords resets. Passwords remain only in that request's local variables for transport, never in React state, retry receipts, URL/history or browser storage. Fields also clear on pagehide/unmount. Failed server requests show relevant field/session/account/conflict/throttle guidance and require entering passwords afresh for another deliberate attempt.

An empty 204 confirms success; the old session has already been revoked and cookies cleared by the service. The form replaces the current route with `/login?returnTo=%2Fsettings&passwordChanged=1`, refreshes authentication, and the login page shows an informational password-changed notice. No password is included in that URL. A fallback login link retains confirmed success if navigation itself fails. The query notice is display-only and is not proof of account state.

Network failures, server failures or unexpected acknowledgments produce an uncertain-result state. Submission is disabled and no replay payload is retained. Guidance says to sign in with the chosen new password, then try the previous password only if the new password is rejected as incorrect. This handles a committed change whose response was lost without blindly submitting another change. Common/invalid passwords, expired authentication, foreign accounts, concurrent changes and rate limits are tested separately.

## Evidence

- Seventeen new mounted-form cases pass: password-manager/show/exact Unicode/space submission; three size failures; early secret cleanup, pending deduplication/navigation; inline server errors and summary focus; four auth/account/conflict/throttle failures; three uncertain outcomes; Stay/pagehide; both unsaved-profile decisions; and navigation failure/unmount cleanup. The final seventeen-test rerun also verifies the account-email autocomplete hint is present and is not sent as an extra API field.
- Full unit/integration suite: **585 tests in 48 files passed**, 80.77 seconds. That full run preceded the final hidden username-hint insertion; the final focused form suite passes after that small addition. Password service, stale-login/session-revocation and preservation tests remain part of the full suite.
- Type checking, full lint, production build, source archive integrity, licence and formatting checks pass. The existing two filesystem tracing build warnings remain. No new dependency, migration, curriculum edit or seed change. Ten source archive files, six phases, 26 weeks, 182 days and 548 task lines retain their checksums; 560 locked dependencies and 574 notices remain preserved.
- Actual HTTP evidence: two existing synthetic accounts, Settings/dashboard/resources with both owned themes and menu links, initially empty password fields, exact labels/autocomplete/account hint, anonymous protection and the login success notice. Durable data fingerprints are unchanged. See [page evidence](m7-step4-http-audit.json). The existing password-change restart verification is also rerun against the same database, preserving old-token rejection, fresh new-password login, private notes/learning/Continue/settings and peer access.
- Reproduce the page audit with `node scripts/audit-settings-page.mjs step4` and the existing `.tmp/m2-preview` data directory. Historical step 2 reports are retained; the explicit step4 mode writes its own report. `node scripts/audit-password-change.mjs verify` uses the existing ignored password fixture without another password change.

Native browser control still fails during initialization: `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. No actual keyboard, hydration/password-manager integration, screenshot, responsive visual or computed-contrast pass is claimed. Mounted DOM/HTTP evidence does not replace those checks. Prior M6 browser closeout and final A01–A26 gates remain pending.

Next after user confirmation: M7 step 5 interactive local password-recovery CLI and documentation, with non-echoed prompts, existing password policy, atomic session revocation, student-record preservation and recovery/rollback tests. Remaining authentication integration and native-browser acceptance follow separately.
