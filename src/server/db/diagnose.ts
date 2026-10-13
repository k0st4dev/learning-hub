import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { readConfig } from '../config.ts';
import { reviewedMigrations } from './migrations.ts';
import { loadArchivedCurriculum } from '../content/import.ts';

const sha256 = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

export interface DiagnosticIssue {
  code: string;
  category:
    'storage' | 'integrity' | 'foreign_key' | 'schema' | 'release' | 'progress';
  table?: string;
  identifier?: string;
  message: string;
  remediation?: string;
}

export interface DiagnosticResult {
  ok: boolean;
  targetFile: string;
  timestamp: string;
  checks: {
    storage: boolean;
    integrity: boolean;
    foreignKeys: boolean;
    schema: boolean;
    release: boolean;
    progress: boolean;
  };
  counts?: {
    users: number;
    enrollments: number;
    lessonsCompleted: number;
    exercisesCompleted: number;
    tasksCompleted: number;
    notes: number;
    scorecards: number;
  };
  issues: DiagnosticIssue[];
  remediation?: string;
}

/** Diagnostic service for local SQLite learning database.
 * Implements spec §525 (progress consistency, repair only from backup/reconciliation),
 * §526 (database integrity failure, stop mutations, restore instructions),
 * and §529/§607 (db:diagnose CLI command). */
export async function diagnoseDatabase(
  dataDir: string,
  root: string,
): Promise<DiagnosticResult> {
  const timestamp = new Date().toISOString();
  const checks = {
    storage: true,
    integrity: true,
    foreignKeys: true,
    schema: true,
    release: true,
    progress: true,
  };
  const issues: DiagnosticIssue[] = [];

  let resolvedDataDir: string;
  try {
    resolvedDataDir = await realpath(dataDir);
  } catch {
    resolvedDataDir = path.resolve(dataDir);
  }

  try {
    readConfig({ APP_DATA_DIR: resolvedDataDir }, root);
  } catch {
    // Config read failure noted, but continue checks if possible
  }

  const targetFile = path.join(resolvedDataDir, 'learning.sqlite');
  const backupsDir = path.join(resolvedDataDir, 'backups');

  // 1. Storage & file checks
  let fileStat;
  try {
    fileStat = await lstat(targetFile);
  } catch (error: unknown) {
    checks.storage = false;
    checks.integrity = false;
    checks.foreignKeys = false;
    checks.schema = false;
    checks.release = false;
    checks.progress = false;
    issues.push({
      code: 'DATABASE_MISSING',
      category: 'storage',
      identifier: targetFile,
      message: `Database file does not exist: ${targetFile} (${error instanceof Error ? error.message : String(error)})`,
      remediation: `Run npm run setup for initial setup, or restore from a verified backup using npm run restore -- --file <backup-path>. Backups directory: ${backupsDir}`,
    });
    return {
      ok: false,
      targetFile,
      timestamp,
      checks,
      issues,
      remediation: `Database file is missing. Stop mutations. Restore from a verified backup with npm run restore -- --file <backup-path>. Backups are located in: ${backupsDir}`,
    };
  }

  if (fileStat.isSymbolicLink()) {
    checks.storage = false;
    issues.push({
      code: 'DATABASE_SYMLINK',
      category: 'storage',
      identifier: targetFile,
      message: `Database file is a symbolic link, which is not permitted for database storage.`,
      remediation: `Use a regular file in the configured data directory. Replace symlink with original database file.`,
    });
  } else if (!fileStat.isFile()) {
    checks.storage = false;
    issues.push({
      code: 'DATABASE_NOT_FILE',
      category: 'storage',
      identifier: targetFile,
      message: `Database path is not a regular file.`,
      remediation: `Ensure APP_DATA_DIR contains a regular learning.sqlite file.`,
    });
  }

  // 2. Open SQLite & Integrity check (§526)
  let database: Database.Database | undefined;
  try {
    database = new Database(targetFile, {
      readonly: true,
      fileMustExist: true,
    });
  } catch (cause: unknown) {
    checks.integrity = false;
    checks.foreignKeys = false;
    checks.schema = false;
    checks.release = false;
    checks.progress = false;
    issues.push({
      code: 'DATABASE_CORRUPT',
      category: 'integrity',
      identifier: targetFile,
      message: `Local data could not be opened: ${cause instanceof Error ? cause.message : String(cause)}`,
      remediation: `Local data could not be opened (§526). Stop mutations and preserve the original database file. Restore from a verified backup using: npm run restore -- --file <backup-path>. Backups are located in: ${backupsDir}`,
    });
    return {
      ok: false,
      targetFile,
      timestamp,
      checks,
      issues,
      remediation: `Local data could not be opened (§526). Stop mutations and preserve the original database file. Restore from a verified backup using: npm run restore -- --file <backup-path>. Backups are located in: ${backupsDir}`,
    };
  }

  try {
    let isIntegrityOk = false;
    let integrityResult: unknown;
    try {
      database.pragma('busy_timeout = 5000');
      integrityResult = database.pragma('integrity_check', { simple: false });
      isIntegrityOk =
        Array.isArray(integrityResult) &&
        integrityResult.length === 1 &&
        (integrityResult[0] as { integrity_check?: string }).integrity_check ===
          'ok';
    } catch (cause: unknown) {
      checks.integrity = false;
      checks.foreignKeys = false;
      checks.schema = false;
      checks.release = false;
      checks.progress = false;
      issues.push({
        code: 'DATABASE_CORRUPT',
        category: 'integrity',
        identifier: targetFile,
        message: `Database integrity check failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        remediation: `Local data could not be opened (§526). Stop mutations and preserve the original database file. Restore from a verified backup using: npm run restore -- --file <backup-path>. Backups are located in: ${backupsDir}`,
      });
      return {
        ok: false,
        targetFile,
        timestamp,
        checks,
        issues,
        remediation: `Local data could not be opened (§526). Stop mutations and preserve the original database file. Restore from a verified backup using: npm run restore -- --file <backup-path>. Backups are located in: ${backupsDir}`,
      };
    }

    if (!isIntegrityOk) {
      checks.integrity = false;
      issues.push({
        code: 'INTEGRITY_CHECK_FAILED',
        category: 'integrity',
        identifier: targetFile,
        message: `SQLite integrity check failed: ${JSON.stringify(integrityResult)}`,
        remediation: `Database integrity failed. Stop mutations and preserve original file (§526). Restore from backup with npm run restore -- --file <backup-path>. Backups directory: ${backupsDir}`,
      });
    }

    // 3. Foreign Key Checks
    try {
      const fkRows = database.pragma('foreign_key_check') as {
        table: string;
        rowid: number;
        parent: string;
        fkid: number;
      }[];
      if (Array.isArray(fkRows) && fkRows.length > 0) {
        checks.foreignKeys = false;
        for (const row of fkRows) {
          issues.push({
            code: 'FOREIGN_KEY_VIOLATION',
            category: 'foreign_key',
            table: row.table,
            identifier: String(row.rowid),
            message: `Foreign key constraint failed in table '${row.table}' at rowid ${row.rowid} referencing parent table '${row.parent}' (fkid ${row.fkid}).`,
            remediation: `Stop mutations. Restore from a verified backup or execute a reconciliation plan before allowing server writes (§525).`,
          });
        }
      }
    } catch (cause: unknown) {
      checks.foreignKeys = false;
      issues.push({
        code: 'FOREIGN_KEY_CHECK_ERROR',
        category: 'foreign_key',
        message: `Could not run foreign_key_check: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    // 4. Schema Migrations Check
    try {
      const migrationTable = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='_app_migration'",
        )
        .get();
      if (!migrationTable) {
        checks.schema = false;
        issues.push({
          code: 'SCHEMA_MIGRATIONS_TABLE_MISSING',
          category: 'schema',
          table: '_app_migration',
          message: `_app_migration table is missing. Database has not been migrated.`,
          remediation: `Run npm run setup to initialize and migrate database.`,
        });
      } else {
        const history = database
          .prepare('SELECT id, checksum FROM _app_migration ORDER BY id')
          .all() as { id: string; checksum: string }[];
        const expected = await Promise.all(
          reviewedMigrations.map(async (entry) => ({
            id: entry.id,
            checksum: sha256(
              await readFile(path.join(root, 'drizzle', entry.file)),
            ),
          })),
        );
        if (JSON.stringify(history) !== JSON.stringify(expected)) {
          checks.schema = false;
          issues.push({
            code: 'SCHEMA_MIGRATION_MISMATCH',
            category: 'schema',
            table: '_app_migration',
            message: `Schema migration history does not match reviewed application migrations. Found: ${JSON.stringify(history)}, Expected: ${JSON.stringify(expected)}`,
            remediation: `Database schema does not match this application version. Preserve your database and use its compatible application version or run setup.`,
          });
        }
      }
    } catch (cause: unknown) {
      checks.schema = false;
      issues.push({
        code: 'SCHEMA_CHECK_ERROR',
        category: 'schema',
        message: `Could not check schema migrations: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    // 5. Curriculum Release Check
    try {
      const releaseTable = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='course_release'",
        )
        .get();
      if (!releaseTable) {
        checks.release = false;
        issues.push({
          code: 'COURSE_RELEASE_TABLE_MISSING',
          category: 'release',
          table: 'course_release',
          message: `course_release table is missing. Curriculum has not been imported.`,
          remediation: `Run npm run setup or npm run content:import to import curriculum.`,
        });
      } else {
        const plan = await loadArchivedCurriculum(root);
        const releases = database
          .prepare(
            'SELECT id, course_id, version, status, source_filename, source_sha256, manifest_sha256 FROM course_release ORDER BY id',
          )
          .all() as {
          id: string;
          course_id: string;
          version: string;
          status: string;
          source_filename: string;
          source_sha256: string;
          manifest_sha256: string;
        }[];
        const official = releases.find((r) => r.id === plan.releaseId);
        if (!official) {
          checks.release = false;
          issues.push({
            code: 'RELEASE_MISSING',
            category: 'release',
            table: 'course_release',
            identifier: plan.releaseId,
            message: `Official curriculum release '${plan.releaseId}' is not present in course_release table.`,
            remediation: `Run npm run content:import to import release ${plan.releaseId}.`,
          });
        } else if (
          official.manifest_sha256 !== plan.manifestSha256 ||
          official.source_sha256 !== plan.source.source.sha256
        ) {
          checks.release = false;
          issues.push({
            code: 'RELEASE_MISMATCH',
            category: 'release',
            table: 'course_release',
            identifier: plan.releaseId,
            message: `Installed curriculum release '${plan.releaseId}' checksums differ from immutable source archive. Found source_sha256=${official.source_sha256}, manifest_sha256=${official.manifest_sha256}. Expected source_sha256=${plan.source.source.sha256}, manifest_sha256=${plan.manifestSha256}.`,
            remediation: `Installed curriculum differs from immutable release. Restore from verified backup or reimport from immutable archive.`,
          });
        }
      }
    } catch (cause: unknown) {
      checks.release = false;
      issues.push({
        code: 'RELEASE_CHECK_ERROR',
        category: 'release',
        message: `Could not check curriculum release: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    // 6. Progress and Learner Data Consistency Checks (§525)
    try {
      // Check enrollment referential consistency
      const invalidEnrollments = database
        .prepare(
          `SELECT en.id, en.user_id, en.course_id, en.release_id, en.resume_item_id, en.last_opened_item_id
           FROM enrollment en
           LEFT JOIN app_user u ON u.id = en.user_id
           LEFT JOIN course c ON c.id = en.course_id
           LEFT JOIN course_release cr ON cr.id = en.release_id AND cr.course_id = en.course_id
           LEFT JOIN content_item resume_ci ON resume_ci.id = en.resume_item_id AND resume_ci.release_id = en.release_id
           LEFT JOIN content_item last_ci ON last_ci.id = en.last_opened_item_id AND last_ci.release_id = en.release_id
           WHERE u.id IS NULL OR c.id IS NULL OR cr.id IS NULL
              OR (en.resume_item_id IS NOT NULL AND resume_ci.id IS NULL)
              OR (en.last_opened_item_id IS NOT NULL AND last_ci.id IS NULL)`,
        )
        .all() as { id: string; user_id: string }[];

      if (invalidEnrollments.length > 0) {
        checks.progress = false;
        for (const row of invalidEnrollments) {
          issues.push({
            code: 'INVALID_PROGRESS_REFERENCE',
            category: 'progress',
            table: 'enrollment',
            identifier: row.id,
            message: `Enrollment '${row.id}' contains invalid references to user, course, release or content items.`,
            remediation: `Progress needs repair. Repair only from backup or reconciliation plan (§525). Restore command: npm run restore -- --file <backup-path>.`,
          });
        }
      }

      // Check user_progress consistency
      const invalidUserProgress = database
        .prepare(
          `SELECT up.enrollment_id, up.release_id, up.lesson_id, up.status, up.completed_at
           FROM user_progress up
           LEFT JOIN enrollment e ON e.id = up.enrollment_id AND e.release_id = up.release_id
           LEFT JOIN content_item ci ON ci.id = up.lesson_id AND ci.release_id = up.release_id
           LEFT JOIN lesson l ON l.item_id = up.lesson_id
           WHERE e.id IS NULL OR ci.id IS NULL OR l.item_id IS NULL
              OR up.status NOT IN ('started', 'completed')
              OR (up.status = 'completed' AND up.completed_at IS NULL)
              OR (up.status = 'started' AND up.completed_at IS NOT NULL)`,
        )
        .all() as {
        enrollment_id: string;
        release_id: string;
        lesson_id: string;
        status: string;
      }[];

      if (invalidUserProgress.length > 0) {
        checks.progress = false;
        for (const row of invalidUserProgress) {
          issues.push({
            code: 'INVALID_PROGRESS_REFERENCE',
            category: 'progress',
            table: 'user_progress',
            identifier: `enrollment=${row.enrollment_id}, lesson=${row.lesson_id}`,
            message: `user_progress record references nonexistent lesson, enrollment, or has invalid status/completion timestamp.`,
            remediation: `Progress needs repair. Repair only from backup or reconciliation plan (§525). Restore command: npm run restore -- --file <backup-path>.`,
          });
        }
      }

      // Check exercise_progress consistency
      const invalidExerciseProgress = database
        .prepare(
          `SELECT ep.enrollment_id, ep.release_id, ep.exercise_id, ep.status, ep.completed_at, ep.criterion_attested_at, ep.result, ep.evidence_text
           FROM exercise_progress ep
           LEFT JOIN enrollment e ON e.id = ep.enrollment_id AND e.release_id = ep.release_id
           LEFT JOIN content_item ci ON ci.id = ep.exercise_id AND ci.release_id = ep.release_id
           LEFT JOIN exercise ex ON ex.item_id = ep.exercise_id
           WHERE e.id IS NULL OR ci.id IS NULL OR ex.item_id IS NULL
              OR ep.status NOT IN ('started', 'completed')
              OR (ep.status = 'completed' AND (ep.completed_at IS NULL OR ep.criterion_attested_at IS NULL OR ep.result != 'passed' OR length(trim(ep.evidence_text)) = 0))
              OR (ep.status = 'started' AND ep.completed_at IS NOT NULL)`,
        )
        .all() as {
        enrollment_id: string;
        release_id: string;
        exercise_id: string;
        status: string;
      }[];

      if (invalidExerciseProgress.length > 0) {
        checks.progress = false;
        for (const row of invalidExerciseProgress) {
          issues.push({
            code: 'INVALID_PROGRESS_REFERENCE',
            category: 'progress',
            table: 'exercise_progress',
            identifier: `enrollment=${row.enrollment_id}, exercise=${row.exercise_id}`,
            message: `exercise_progress record references nonexistent exercise or enrollment, or has invalid completion attestation.`,
            remediation: `Progress needs repair. Repair only from backup or reconciliation plan (§525). Restore command: npm run restore -- --file <backup-path>.`,
          });
        }
      }

      // Check task_progress consistency
      const invalidTaskProgress = database
        .prepare(
          `SELECT tp.enrollment_id, tp.release_id, tp.task_id, tp.status, tp.reason
           FROM task_progress tp
           LEFT JOIN enrollment e ON e.id = tp.enrollment_id AND e.release_id = tp.release_id
           LEFT JOIN content_item ci ON ci.id = tp.task_id AND ci.release_id = tp.release_id
           LEFT JOIN exercise_task et ON et.item_id = tp.task_id
           WHERE e.id IS NULL OR ci.id IS NULL OR et.item_id IS NULL
              OR tp.status NOT IN ('done', 'not_applicable')
              OR (tp.status = 'not_applicable' AND length(trim(tp.reason)) = 0)`,
        )
        .all() as {
        enrollment_id: string;
        task_id: string;
        status: string;
      }[];

      if (invalidTaskProgress.length > 0) {
        checks.progress = false;
        for (const row of invalidTaskProgress) {
          issues.push({
            code: 'INVALID_PROGRESS_REFERENCE',
            category: 'progress',
            table: 'task_progress',
            identifier: `enrollment=${row.enrollment_id}, task=${row.task_id}`,
            message: `task_progress record references nonexistent task or has invalid status/reason.`,
            remediation: `Progress needs repair. Repair only from backup or reconciliation plan (§525). Restore command: npm run restore -- --file <backup-path>.`,
          });
        }
      }

      // Check note consistency
      const invalidNotes = database
        .prepare(
          `SELECT n.id, n.enrollment_id, n.release_id, n.content_item_id
           FROM note n
           LEFT JOIN enrollment e ON e.id = n.enrollment_id AND e.release_id = n.release_id
           LEFT JOIN content_item ci ON ci.id = n.content_item_id AND ci.release_id = n.release_id
           WHERE e.id IS NULL OR ci.id IS NULL`,
        )
        .all() as { id: string }[];

      if (invalidNotes.length > 0) {
        checks.progress = false;
        for (const row of invalidNotes) {
          issues.push({
            code: 'INVALID_PROGRESS_REFERENCE',
            category: 'progress',
            table: 'note',
            identifier: row.id,
            message: `Note '${row.id}' references nonexistent enrollment or content item.`,
            remediation: `Progress needs repair. Repair only from backup or reconciliation plan (§525). Restore command: npm run restore -- --file <backup-path>.`,
          });
        }
      }

      // Check scorecard consistency
      const invalidScorecards = database
        .prepare(
          `SELECT s.id, s.enrollment_id
           FROM scorecard s
           LEFT JOIN enrollment e ON e.id = s.enrollment_id
           WHERE e.id IS NULL OR json_valid(s.ratings_json) = 0 OR json_valid(s.evidence_json) = 0`,
        )
        .all() as { id: string }[];

      if (invalidScorecards.length > 0) {
        checks.progress = false;
        for (const row of invalidScorecards) {
          issues.push({
            code: 'INVALID_PROGRESS_REFERENCE',
            category: 'progress',
            table: 'scorecard',
            identifier: row.id,
            message: `Scorecard '${row.id}' references nonexistent enrollment or contains invalid JSON ratings/evidence.`,
            remediation: `Progress needs repair. Repair only from backup or reconciliation plan (§525). Restore command: npm run restore -- --file <backup-path>.`,
          });
        }
      }
    } catch (cause: unknown) {
      checks.progress = false;
      issues.push({
        code: 'PROGRESS_CHECK_ERROR',
        category: 'progress',
        message: `Could not check learner progress consistency: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    // Counts summary
    const safeCount = (query: string): number => {
      try {
        const row = database?.prepare(query).get() as
          { count: number } | undefined;
        return row?.count ?? 0;
      } catch {
        return 0;
      }
    };

    const counts = {
      users: safeCount('SELECT COUNT(*) AS count FROM app_user'),
      enrollments: safeCount('SELECT COUNT(*) AS count FROM enrollment'),
      lessonsCompleted: safeCount(
        "SELECT COUNT(*) AS count FROM user_progress WHERE status = 'completed'",
      ),
      exercisesCompleted: safeCount(
        "SELECT COUNT(*) AS count FROM exercise_progress WHERE status = 'completed'",
      ),
      tasksCompleted: safeCount(
        "SELECT COUNT(*) AS count FROM task_progress WHERE status = 'done'",
      ),
      notes: safeCount('SELECT COUNT(*) AS count FROM note'),
      scorecards: safeCount('SELECT COUNT(*) AS count FROM scorecard'),
    };

    const ok = issues.length === 0 && Object.values(checks).every(Boolean);
    const topRemediation = ok
      ? undefined
      : `One or more diagnostic checks failed. Stop server mutations (§525-526). If data is corrupted or progress references are invalid, restore from a verified backup using: npm run restore -- --file <backup-path>. Backups directory: ${backupsDir}`;

    return {
      ok,
      targetFile,
      timestamp,
      checks,
      counts,
      issues,
      remediation: topRemediation,
    };
  } finally {
    database?.close();
  }
}
