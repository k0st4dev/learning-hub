# M7 step 1 — owned settings service and API

Verified 2026-10-12. This increment supplies the persistence/API foundation; the visible settings editor and theme application are the next separately approved step. Password change/session revocation and local recovery remain later work. M6 native-browser closeout and final A01–A26 acceptance remain open.

## Contract and decisions

- Authenticated `GET /api/settings` and `PUT /api/settings` work before course enrollment. Only the current session selects the account; `expectedStudentId` detects an account switch and cannot select another account.
- Writable fields: trimmed display name up to 80 characters, runtime-supported IANA timezone (canonicalized by Intl), and light/dark/system theme. Email is read-only. Strict server validation rejects unknown fields, invalid zones, numeric UTC offsets and unsupported themes.
- The desired-state submission includes a UUID mutation identifier and expected account settings revision. A changed save increments only that revision. A no-op preserves revision and timestamp. Stale writes return 409 with owned current state; reused identifiers with changed payloads return 409. Exact retries return the original acknowledgment without overwriting newer settings. The future editor must refresh current state after an uncertain old acknowledgment.
- Both routes return no-store responses. PUT uses existing local Host/Origin/CSRF protection and bounded JSON reads. Safe response projection omits password/session data. A failed receipt insertion rolls back the profile update in the same immediate transaction.
- Theme is stored only in this step. Existing date/period readers already use the account timezone. No course enrollment, learning revision, progress, note, scorecard, curriculum or completion write is introduced by settings saves.

## Database upgrade

Reviewed additive `0002_settings.sql` appends `app_user.settings_revision` and adds an account-owned settings receipt table. Original migration 0001 is unchanged. Receipt identity is separate from enrollment receipts so a newly registered user can save settings immediately.

The runner verifies every applied checksum and ordered history before applying pending migrations, creates and integrity-checks a SQLite backup for an existing database, applies pending DDL and history atomically, and checks foreign keys. Unknown/newer history or modified applied SQL stops setup. Failed migration tests demonstrate rollback. Existing databases must run the normal `npm run setup` before startup; preserve the same data directory. Setup remains repeatable and does not reset students. Receipt retention is not implemented in this increment.

The existing preview database was upgraded with the server stopped. All 25 preexisting table fingerprints and the CSRF secret were unchanged, apart from the explicitly new schema/history fields excluded from the comparison. The verified pre-upgrade backup is retained under the private data directory's `backups` folder. No credentials or student data are included in the report.

## Verification

- Focused settings/database/migration checks: 21 tests passed.
- Complete unit/integration suite: **546 tests, 45 files passed**, 125.79 seconds.
- Type checking, lint, production build, source archive and dependency-license checks passed. Build retains the existing two dynamic filesystem tracing warnings in configuration.
- All 10 source archive files retain their checksums and inventory: six phases, 26 weeks, 182 days, 548 task lines, 2365 source blocks and 2329 mappings. License check retains 560 locked dependencies and 574 supplied notices.
- Actual HTTP journey: create two synthetic accounts before enrollment, log in, save distinct name/timezone/theme values, retry exact saves, reject stale writes and email changes, stop the server, restart with the same database, log in afresh, recover exact confirmed settings and reject foreign account reads. See [machine-readable result](m7-step1-http-audit.json).
- Native browser interaction is not claimed; this step adds no visible editor. The previously recorded browser host failure and M6 manual checks remain open.

Reproduce the developer-only preview audit with `APP_DATA_DIR` pointing to the existing `.tmp/m2-preview`: `node scripts/audit-settings.mjs migrate`, start the app, `node scripts/audit-settings.mjs save`, restart the same app/data directory, then `node scripts/audit-settings.mjs verify`. The migrate phase is intended before the first upgrade; its preservation report is replaced when rerun. Synthetic credentials remain only in ignored `.tmp` storage.

Next: M7 step 2 settings page/editor and desktop/mobile navigation, with confirmed-save, conflict, retry, account-switch and unsaved-change behavior; apply theme deliberately in its planned UI scope. Ask before beginning, as requested by the user.
