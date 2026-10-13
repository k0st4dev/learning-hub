# M8 step 4 — curriculum upgrade and enrollment migration with dry-run

Date: 2026-10-13. Scope: curriculum upgrade service (`src/server/content/upgrade.ts`), CLI command (`scripts/upgrade-curriculum.mjs`), `package.json` script (`curriculum:upgrade`), integration test coverage (`tests/integration/upgrade.test.ts`), and documentation in `README.md` per specification §231–234, §268, §607, and A24. No schema migrations or extra dependencies added.

## Implemented behavior

### 1. Curriculum Upgrade Service (`src/server/content/upgrade.ts`)

The `executeCurriculumUpgrade({ dataDir, root, dryRun, targetReleaseId, userEmail, mappingFilePath })` service safely manages curriculum migrations across published releases:

- **Dry-run evaluation (§231):** Evaluates prospective migrations, computes item mappings, identifies transferred and reattempt-required units, and verifies cursor fallback without taking backups or modifying any database records.
- **Pre-upgrade verified backup (§268):** In non-dry-run executions, creates an automatic SQLite online backup bundle in `APP_DATA_DIR/backups` and verifies database integrity, foreign keys, migrations, and manifests before applying any enrollment changes.
- **Strict equivalence mapping by stableKey (§232):** Matches content items between source and target releases strictly by `stableKey`. Does not guess or correlate by title, index, date, or paragraph. Supports optional operator mapping files (`--map <path>`) for explicit stableKey mappings or overrides.
- **Completion transfer and reattempt enforcement (§233):**
  - **Equivalent lessons:** Completed lessons with identical or equivalent content maintain `completed` status in the target release.
  - **Equivalent exercises:** Completed exercises with identical content hash and structure retain completion and submission evidence in the target release.
  - **Materially changed exercises:** Exercises whose content hash or structure changed materially between releases require a fresh reattempt and do not transfer completion status to the target release.
- **Student notes transfer:** Student private notes attached to items in the source release transfer to target release items matching `stableKey`.
- **Cursor fallback (§233):** If the student's `resume_item_id` target exists in the target release, it is updated to the corresponding target item ID; if the resume item was removed in the new release, it safely resets to `null`, enabling the application's resume resolver to compute the next valid study target.
- **Audit event logging:** Records a `release_migrated` event in `activity_event` with payload containing `fromRelease`, `toRelease`, and timestamps.
- **Enrollment pinning and release isolation (A24):** Importing or publishing a new release does not alter existing student enrollments; students remain pinned to their release until an explicit operator upgrade is performed.

### 2. Upgrade CLI Script (`scripts/upgrade-curriculum.mjs`)

Invoked via `npm run curriculum:upgrade`:

- Default dry-run mode: `npm run curriculum:upgrade -- --dry-run` outputs a human-readable table summarizing target release, eligible students, transferred units, required reattempts, cursor adjustments, and backup status.
- Real execution: `npm run curriculum:upgrade` prints the verified pre-upgrade backup directory and migration summary.
- Flags supported:
  - `--dry-run`: Evaluate prospective plan without modifying database or taking backups.
  - `--target-release <id>`: Target release ID (defaults to latest published release).
  - `--user <email>`: Limit upgrade to a single student email.
  - `--map <path>`: Optional JSON file with custom stableKey mappings.
  - `--json`: Machine-readable JSON output of `UpgradeResult`.
- Returns exit code 0 on success, and exit code 1 with clean error messages on failure.

### 3. Specification Script Alias (`package.json`)

Added `"curriculum:upgrade": "node scripts/upgrade-curriculum.mjs"` to `package.json` per specification §607.

## Automated Verification Evidence

1. **Integration Tests (`tests/integration/upgrade.test.ts`):** 7/7 tests pass:
   - Dry-run evaluates prospective upgrade without taking backups or modifying database rows (§231).
   - Creates pre-upgrade verified backup before applying enrollment changes (§268).
   - Transfers equivalent completed units and requires reattempt for materially changed exercises (§233).
   - Safely falls back cursor when resume target was removed in new release (§233).
   - Records `release_migrated` activity event during upgrade.
   - Does not silently change enrollments when new release is imported (A24).
   - Runs CLI `scripts/upgrade-curriculum.mjs` with `--dry-run` and reports plan.

2. **Full Operations Test Suite:**
   - `vitest run tests/integration/diagnose.test.ts tests/integration/restore.test.ts tests/integration/backup.test.ts tests/integration/upgrade.test.ts`: 39/39 tests pass across all 4 suites.
   - Unit test suite (`npm test`): 364/364 tests pass across 34 test files.
   - Typecheck (`npm run typecheck`): passes with zero errors.
   - Lint (`npm run lint`): passes with zero warnings (`--max-warnings=0`).
   - Format check (`npm run format:check`): all files match Prettier code style.
   - Production build (`npm run build`): compiles successfully.

## Remaining gates

- M8 step 5: consolidated M8 operational integration audit.
- M6/M7 native browser closeout and manual accessibility/theme checks remain open.
- Disconnected operation, real OS reboot, and final A01–A26 acceptance remain open.
