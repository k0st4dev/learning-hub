# M8 step 2 — verified stopped-server restore

Date: 2026-10-13. Scope: the public restore CLI, stopped-server enforcement, bundle verification, interactive target confirmation, safety backup, restored-session revocation, fresh CSRF secret generation, atomic swap with rollback, and rehearsal evidence. No schema, dependency, curriculum or learning-rule change.

## Implemented behavior

`npm run restore -- --file <backup>` requires a stopped application and refuses invalid flags, symlinked paths, incomplete `.partial` bundles, or running server processes. The target installation is selected by `APP_DATA_DIR` (or `./data`).

Before modifying any target data:

1. **Stopped-server enforcement:** Acquires the operation lease (`.local-operation.lock`) with operation `restore`. If an application server or password recovery process holds the lease, it fails immediately with `LOCAL_DATA_BUSY`. A port probe confirms the configured local port is not bound by an active server.
2. **Setup lock check:** Verifies that `.setup.lock` is not held by another maintenance task.
3. **Bundle verification:** Inspects the bundle directory containing `learning.sqlite`, `manifest.json` and `source-manifest.json`. Resolves realpaths and refuses symbolic links. Verifies that the database byte count and SHA-256 match `manifest.json`. Verifies `source-manifest.json` matches `manifest.json`. Opens the backup database read-only to verify SQLite `integrity_check` is `ok` and `foreign_key_check` is empty. Confirms that all applied migrations match the current application's reviewed migrations, and that the official curriculum release matches the immutable source archive.
4. **Interactive target confirmation:** Prompts the operator on an interactive TTY showing the target database path, backup bundle directory, and timestamp. Requires typing `RESTORE` to proceed. Refuses piped, non-TTY input or mismatched confirmation without touching target files.
5. **Safety backup:** If an existing target database is present, creates a verified safety backup bundle using the online backup service before any replacement occurs. If the target database was damaged or unopenable, an emergency raw copy is preserved under `backups/safety-damaged-*.sqlite` per specification §526 ("preserve original file, no automatic deletion or blank replacement").
6. **Session revocation on staged copy:** Copies the backup database to a private staging file (`0600` permissions) within the target directory. Removes all rows from the `session` table (`DELETE FROM session`), finalizes journal mode, and verifies staged integrity. Generates a fresh 32-byte (64 hex characters) `csrf-secret` file with `0600` permissions.
7. **Atomic replacement with rollback:** Replaces `learning.sqlite` and `csrf-secret` atomically, moving previous files to temporary filenames before replacement. Removes old WAL/SHM files. Opens the swapped database to verify integrity and ensure 0 active sessions remain. On any swap or verification failure, rolls back previous files to their exact original state.

## Automated and local checks

The integration test suite in `tests/integration/restore.test.ts` covers:

- Full end-to-end restore of an imported curriculum with two synthetic accounts, confirmed Day 1 study, exercise submission, private notes with Unicode characters (`čć`), and distinct Continue destinations.
- Revocation of all restored sessions (session count = 0); old session tokens are rejected.
- Fresh CSRF secret generation differing from both source and previous target secrets.
- Fresh authentication of both users using their original passwords.
- Exact preservation of learning snapshot, continue path, and private notes.
- Exact row-for-row fingerprint match across all non-session durable tables against the backup bundle.
- Refusal when the application server holds the local operation lease (`LOCAL_DATA_BUSY`).
- Refusal when the local server port is active (`SERVER_RUNNING`).
- Refusal when `.setup.lock` remains (`SETUP_RUNNING`).
- Clean cancellation and target preservation when confirmation is not `RESTORE`.
- Refusal of incomplete `.partial` bundles.
- Refusal of bundles with mismatched database checksums.
- Refusal of symlinked backup paths.
- Complete rollback of target database and secret when post-swap verification fails.
- Emergency safety backup preservation when the target database was corrupted.

All 10 integration tests pass in ~12 seconds.

A dedicated rehearsal script `scripts/audit-restore.mjs` executes a complete stopped-server restore and records machine-readable evidence in `docs/m8-step2-restore-audit.json`.

## Remaining gates

- M8 step 3: diagnostics CLI (`db:diagnose`) and script aliases.
- M8 step 4: curriculum and enrollment upgrade with dry run (A24).
- M8 step 5: M8 operational integration audit.
- M6/M7 native browser closeout and manual accessibility/theme checks remain open.
- Disconnected operation, real OS reboot, and final A01–A26 acceptance remain open.
