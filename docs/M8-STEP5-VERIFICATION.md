# M8 step 5 — consolidated operational integration audit

Date: 2026-10-13. Scope: consolidated operational integration audit verifying the end-to-end lifecycle interplay across online backup (`src/server/db/backup.ts`, `scripts/backup.mjs`), stopped-server restore (`src/server/db/restore.ts`, `scripts/restore.mjs`), database diagnostics (`src/server/db/diagnose.ts`, `scripts/diagnose.mjs`), and curriculum upgrade (`src/server/content/upgrade.ts`, `scripts/upgrade-curriculum.mjs`) per specifications §231–234, §268, §525, §526, §529, §607, and acceptance criteria A23 and A24.

## Audit Workflow and Lifecycle Interplay

The consolidated integration rehearsal script [`scripts/audit-operations-integration.mjs`](file:///home/kst/Documents/learningHub/learning-hub/scripts/audit-operations-integration.mjs) and integration test [`tests/integration/operations-audit.test.ts`](file:///home/kst/Documents/learningHub/learning-hub/tests/integration/operations-audit.test.ts) execute a complete multi-phase operational lifecycle in an isolated environment:

### Phase 1: Setup & Baseline Diagnostics (§525, §526)

- Initializes a fresh SQLite database and applies reviewed schema migrations (`0001`, `0002`).
- Imports the official immutable curriculum release (`se-26w-v1`).
- Registers and enrolls two distinct students: `alice@operations.test` and `bob@operations.test`.
- Populates learner state: Day 1 lesson completed, Day 1 exercise passed with full submission evidence, Day 2 exercise passed, Day 3 exercise cursor positioned, and private notes saved with UTF-8 characters (`čć`).
- Executes `diagnoseDatabase`: verifies `ok: true`, 0 issues, and accurate summary counts (2 users, 2 enrollments, 1 completed lesson, 2 completed exercises, 2 notes).

### Phase 2: Live Online Backup (§268, A23)

- Executes `createBackup` while the database is actively in use.
- Verifies the backup bundle structure: `learning.sqlite`, `manifest.json`, and `source-manifest.json`.
- Confirms `manifest.json` checksums, migration history (`["0001", "0002"]`), and curriculum release hash.
- Opens the backup database in read-only mode to verify SQLite integrity check (`ok`) and foreign key constraints (`[]`).

### Phase 3: Curriculum Upgrade with Second Release (§231–234, §268, A24)

- Publishes a second release (`se-26w-v2`) with equivalent units, a materially changed exercise (Day 2 practice), and a removed unit (Day 3 practice).
- **Enrollment Pinning (A24):** Confirms that existing students remain pinned to `se-26w-v1` upon release publication.
- **Dry-run Evaluation (§231):** Executes `executeCurriculumUpgrade` with `dryRun: true`. Confirms that the plan reports transferred and reattempt-required units without taking backups or modifying database rows.
- **Real Upgrade Execution (§233, §268):**
  - Creates an automatic pre-upgrade verified backup bundle in `APP_DATA_DIR/backups`.
  - Migrates enrollments to `se-26w-v2`.
  - Day 1 lesson and Day 1 exercise retain completed status (`completed`).
  - Materially changed Day 2 exercise requires a fresh reattempt (not completed in v2).
  - Private notes transfer by `stableKey`.
  - Removed Day 3 practice cursor target safely resets to `null`, enabling the application resume resolver.
  - Emits `release_migrated` event in `activity_event`.
- **Post-upgrade Diagnostics:** Executes `diagnoseDatabase` on the upgraded database; confirms 0 issues and valid progress referential integrity under `se-26w-v2`.

### Phase 4: Disaster Recovery & Rollback Restore (§526, A23)

- Simulates an operator rollback or disaster recovery using the pre-upgrade backup taken in Phase 2.
- Executes `executeRestore` onto the target database:
  - Creates an automatic safety backup of the upgraded database before modification.
  - Revokes all active sessions (`DELETE FROM session`).
  - Generates a fresh 32-byte (`0600` permissions) `csrf-secret`.
  - Atomically swaps database and secret files.
- Confirms restored database state:
  - Both students freshly log in with original passwords.
  - Enrollments revert cleanly to `se-26w-v1`.
  - Completed lessons, exercises, private notes, and continue resume targets match their exact pre-upgrade state.
- **Post-restore Diagnostics:** Executes `diagnoseDatabase` on the restored database; confirms `ok: true` and 0 issues.

### Phase 5: Diagnostic Detection & Actionable Remediation (§525, §526)

- Simulates corrupted database header data in a test clone.
- Executes `diagnoseDatabase`:
  - Fails with `ok: false`.
  - Flags `DATABASE_CORRUPT`.
  - Outputs actionable remediation guidance directing the operator to `npm run restore -- --file <backup-path>` and listing available verified backups.

## Verification Evidence

1. **Rehearsal Script Output:**
   - Script: `scripts/audit-operations-integration.mjs`
   - Generated report: [`docs/m8-step5-operations-audit.json`](file:///home/kst/Documents/learningHub/learning-hub/docs/m8-step5-operations-audit.json)
   - Status: `passed` across all 5 phases.

2. **Automated Operations Integration Suite:**
   - `vitest run tests/integration/backup.test.ts tests/integration/restore.test.ts tests/integration/diagnose.test.ts tests/integration/upgrade.test.ts tests/integration/operations-audit.test.ts`: 41/41 tests pass across 5 test suites.

3. **Core Quality Gates:**
   - Unit test suite (`npm test`): 364/364 tests pass across 34 files.
   - Typecheck (`npm run typecheck`): passes with 0 errors.
   - Lint (`npm run lint`): passes with 0 warnings (`--max-warnings=0`).
   - Format check (`npm run format:check`): passes cleanly with Prettier code style.
   - Production build (`npm run build`): Next.js Turbopack production build compiles successfully.

## Milestone 8 Completion Status

Milestone 8 (**Operations and curriculum updates**) is fully implemented and verified:

- **M8 Step 1:** Online SQLite backup service & CLI (`npm run backup`) — Verified.
- **M8 Step 2:** Stopped-server restore service & CLI (`npm run restore`) with session revocation & safety backup (A23) — Verified.
- **M8 Step 3:** Database diagnostics service & CLI (`npm run db:diagnose`) with referential consistency checks (§525, §526, §607) — Verified.
- **M8 Step 4:** Explicit curriculum upgrade with dry run, pre-upgrade backup, and completion mappings (`npm run curriculum:upgrade`, A24) — Verified.
- **M8 Step 5:** Consolidated operational integration audit across backup, restore, diagnose, and upgrade interplay — Verified.

## Remaining Project Gates

- Milestone 9: Responsive/accessibility and failure-state integration (themes, accessible menus/forms, keyboard navigation, 320px reflow, performance measurements).
- Milestone 10: Final delivery, clean installation across platforms, real OS reboot, and final A01–A26 acceptance review.
- M6/M7 native browser closeout and manual accessibility/theme checks remain open.
