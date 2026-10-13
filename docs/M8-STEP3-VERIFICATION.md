# M8 step 3 — database diagnostics and spec script aliases

Date: 2026-10-13. Scope: database diagnostics service (`src/server/db/diagnose.ts`), CLI command (`scripts/diagnose.mjs`), integration test coverage (`tests/integration/diagnose.test.ts`), and spec-required script aliases in `package.json` per specification §525, §526, §529, and §607. No schema, dependency, or curriculum changes.

## Implemented behavior

### 1. Database Diagnostics Service (`src/server/db/diagnose.ts`)

The `diagnoseDatabase(dataDir, root)` function performs deep health and referential integrity auditing on local SQLite installations:

- **Storage & file access:** Verifies that `learning.sqlite` exists within `APP_DATA_DIR` as a regular file and strictly rejects symbolic links to protect local storage integrity.
- **SQLite opening & integrity check (§526):** Safely handles corrupt, missing, or unreadable database files. Executes `PRAGMA integrity_check`. When unreadable or corrupted, halts without crashing and reports detailed remediation instructions pointing to `npm run restore -- --file <backup-path>` and the installation's backups directory.
- **Foreign key constraints:** Executes `PRAGMA foreign_key_check` and reports all violating child tables, rowids, parent tables, and foreign key IDs.
- **Schema migrations:** Queries `_app_migration` and compares recorded migration IDs and SHA-256 checksums against the application's `reviewedMigrations`.
- **Curriculum release verification:** Queries `course_release` and verifies that the installed release (`se-26w-v1`) source and manifest SHA-256 digests match the immutable source archive (`loadArchivedCurriculum`).
- **Progress & learner data consistency (§525):** Performs referential and invariant validation across student progress tables:
  - `enrollment`: references valid user, course, release, resume item, and last-opened item.
  - `user_progress`: references valid enrollment, content item, and lesson; status is valid enum; completion timestamp matches status.
  - `exercise_progress`: references valid enrollment, content item, and exercise; valid completion criteria, passing result, and non-empty evidence.
  - `task_progress`: references valid enrollment, content item, and task; valid status and non-empty reason if marked `not_applicable`.
  - `preparation_progress`: references valid enrollment and preparation item.
  - `note`: references valid enrollment and content item.
  - `scorecard`: references valid enrollment and contains valid JSON ratings and evidence.
- **Actionable reporting & remediation:** Outputs summary counts (users, enrollments, completed lessons/exercises/tasks, notes, scorecards), lists any detected anomalies with exact table/row identifiers, and provides remediation instructions: stop server mutations, restore from verified backup, or run an authorized reconciliation plan (§525–526).

### 2. Diagnostics CLI Script (`scripts/diagnose.mjs`)

Invoked via `npm run db:diagnose`:

- Default human-readable output reports each check as `[OK]` or `[FAIL]`, summarizes learner counts, lists issues with table/row identifiers, and provides remediation guidance.
- `--json` flag prints the full machine-readable `DiagnosticResult` JSON object.
- Returns exit code 0 if all checks pass (`ok: true`), and exit code 1 if any check fails (`ok: false`).

### 3. Specification Script Aliases (`package.json`)

Specification §607 mandates explicit script names for operational workflows. The following scripts and aliases are verified:

- `"content:validate": "node scripts/verify-source.mjs"` (alias alongside `"curriculum:verify-source"`)
- `"content:import": "node scripts/import-curriculum.mjs"` (alias alongside `"curriculum:import"`)
- `"content:audit": "python3 scripts/audit-original-source.py"`
- `"auth:reset-password": "node scripts/recover-password.mjs"` (alias alongside `"password:reset"`)
- `"db:diagnose": "node scripts/diagnose.mjs"`

Existing script names were retained for backward compatibility.

## Automated Verification Evidence

1. **Focused Integration Tests (`tests/integration/diagnose.test.ts`):** 11/11 tests pass:
   - Clean database with enrolled student and progress passes with `ok: true`, zero issues, and exit code 0.
   - Missing database file flags `DATABASE_MISSING` with restore instructions and backup location (§526).
   - Symlinked database file flags `DATABASE_SYMLINK`.
   - Corrupted SQLite file flags `DATABASE_CORRUPT` with restore instructions (§526).
   - Foreign key violation flags `FOREIGN_KEY_VIOLATION` with table, rowid, and parent table.
   - Altered migration checksum flags `SCHEMA_MIGRATION_MISMATCH`.
   - Altered release hash flags `RELEASE_MISMATCH`.
   - Invalid progress reference in `user_progress` flags `INVALID_PROGRESS_REFERENCE` with row identifier and reconciliation remediation (§525).
   - CLI execution `npm run db:diagnose` exits with code 0 on healthy database.
   - CLI execution `npm run db:diagnose -- --json` prints valid JSON.
   - CLI execution on damaged database exits with code 1 and outputs remediation guidance.

2. **Operations Test Suite:**
   - `vitest run tests/integration/diagnose.test.ts tests/integration/restore.test.ts tests/integration/backup.test.ts`: 32/32 tests pass.
   - Unit test suite (`npm test`): 364/364 tests pass across 34 test files.
   - Typecheck (`npm run typecheck`): passes with zero errors.
   - Lint (`npm run lint`): passes with zero warnings (`--max-warnings=0`).
   - Format check (`npm run format:check`): all files match Prettier code style.
   - Production build (`npm run build`): compiles successfully.
   - Content scripts (`npm run content:validate`, `npm run content:audit`): all 14 source audit checks pass.

## Remaining gates

- M8 step 4: curriculum and enrollment upgrade with dry run (`curriculum:upgrade`, A24).
- M8 step 5: consolidated M8 operational integration audit.
- M6/M7 native browser closeout and manual accessibility/theme checks remain open.
- Disconnected operation, real OS reboot, and final A01–A26 acceptance remain open.
