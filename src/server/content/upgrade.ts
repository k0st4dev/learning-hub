import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createBackup } from '../db/backup.ts';
import { AppError } from '../errors.ts';
import { readConfig } from '../config.ts';

export interface UpgradeOptions {
  dataDir: string;
  root: string;
  dryRun?: boolean;
  targetReleaseId?: string;
  userEmail?: string;
  mapPath?: string;
}

export interface TransferredLesson {
  stableKey: string;
  oldId: string;
  newId: string;
  status: string;
  startedAt: number;
  completedAt: number | null;
  updatedAt: number;
}

export interface TransferredExercise {
  stableKey: string;
  oldId: string;
  newId: string;
  status: string;
  startedAt: number;
  completedAt: number | null;
  criterionAttestedAt: number | null;
  result: string | null;
  evidenceText: string;
  selectedScope: string;
  rubricJson: string;
  revealedHintLevel: number;
  solutionRevealedAt: number | null;
  rewriteAttestedAt: number | null;
  updatedAt: number;
}

export interface TransferredTask {
  stableKey: string;
  oldId: string;
  newId: string;
  status: string;
  reason: string;
  updatedAt: number;
}

export interface TransferredPrep {
  stableKey: string;
  oldId: string;
  newId: string;
  completedAt: number;
}

export interface TransferredNote {
  id: string;
  stableKey: string;
  oldId: string;
  newId: string;
  bodyText: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface EnrollmentUpgradePlan {
  enrollmentId: string;
  userId: string;
  userEmail: string;
  sourceReleaseId: string;
  targetReleaseId: string;
  statsBefore: {
    requiredCompleted: number;
    requiredTotal: number;
    percentage: number;
  };
  statsAfter: {
    requiredCompleted: number;
    requiredTotal: number;
    percentage: number;
  };
  percentageChangeExplanation?: string;
  transferredLessons: TransferredLesson[];
  transferredExercises: TransferredExercise[];
  reattemptRequiredExercises: {
    stableKey: string;
    oldId: string;
    reason: string;
  }[];
  transferredTasks: TransferredTask[];
  transferredPrep: TransferredPrep[];
  transferredNotes: TransferredNote[];
  cursorResolution: {
    oldResumeItemId: string | null;
    newResumeItemId: string | null;
    oldLastOpenedItemId: string | null;
    newLastOpenedItemId: string | null;
    fallbackApplied: boolean;
  };
}

export interface UpgradeResult {
  dryRun: boolean;
  targetReleaseId: string;
  backupPath?: string;
  plans: EnrollmentUpgradePlan[];
}

interface CustomMigrationMap {
  sourceReleaseId?: string;
  targetReleaseId?: string;
  items?: Record<
    string,
    {
      equivalent?: boolean;
      materiallyChanged?: boolean;
    }
  >;
}

interface ContentItemRow {
  id: string;
  release_id: string;
  stable_key: string;
  kind: string;
  parent_id: string | null;
  order_index: number;
  title: string;
  body_markdown: string;
  required: number;
  content_hash: string;
  metadata_json: string;
}

interface UserProgressRow {
  enrollment_id: string;
  release_id: string;
  lesson_id: string;
  status: string;
  started_at: number;
  completed_at: number | null;
  updated_at: number;
}

interface ExerciseProgressRow {
  enrollment_id: string;
  release_id: string;
  exercise_id: string;
  status: string;
  started_at: number;
  completed_at: number | null;
  criterion_attested_at: number | null;
  result: string | null;
  evidence_text: string;
  selected_scope: string;
  rubric_json: string;
  revealed_hint_level: number;
  solution_revealed_at: number | null;
  rewrite_attested_at: number | null;
  updated_at: number;
}

interface TaskProgressRow {
  enrollment_id: string;
  release_id: string;
  task_id: string;
  status: string;
  reason: string;
  updated_at: number;
}

interface PreparationProgressRow {
  enrollment_id: string;
  release_id: string;
  preparation_item_id: string;
  completed_at: number;
}

interface NoteRow {
  id: string;
  enrollment_id: string;
  release_id: string;
  content_item_id: string;
  body_text: string;
  revision: number;
  created_at: number;
  updated_at: number;
}

export async function executeCurriculumUpgrade(
  options: UpgradeOptions,
): Promise<UpgradeResult> {
  const { dataDir, root, dryRun = false } = options;
  const resolvedDataDir = await realpath(dataDir).catch(() =>
    path.resolve(dataDir),
  );
  readConfig({ APP_DATA_DIR: resolvedDataDir }, root);

  const dbFile = path.join(resolvedDataDir, 'learning.sqlite');
  const stat = await lstat(dbFile).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
    throw new AppError(
      400,
      'DATABASE_INVALID',
      'Target database file not found or invalid.',
    );
  }

  let customMap: CustomMigrationMap | null = null;
  if (options.mapPath) {
    const raw = await readFile(options.mapPath, 'utf8');
    customMap = JSON.parse(raw);
  }

  // Open database in readonly mode to plan upgrade
  const readonlyDb = new Database(dbFile, { readonly: true });
  const plans: EnrollmentUpgradePlan[] = [];
  let resolvedTargetReleaseId = options.targetReleaseId;

  try {
    // 1. Determine target release
    if (!resolvedTargetReleaseId) {
      const latestPublished = readonlyDb
        .prepare(
          "SELECT id FROM course_release WHERE course_id = 'software-engineer' AND status = 'published' ORDER BY published_at DESC LIMIT 1",
        )
        .get() as { id: string } | undefined;
      if (!latestPublished) {
        throw new AppError(
          404,
          'NO_PUBLISHED_RELEASE',
          'No published release found in database.',
        );
      }
      resolvedTargetReleaseId = latestPublished.id;
    } else {
      const release = readonlyDb
        .prepare(
          "SELECT id, status FROM course_release WHERE id = ? AND course_id = 'software-engineer'",
        )
        .get(resolvedTargetReleaseId) as
        { id: string; status: string } | undefined;
      if (!release || release.status !== 'published') {
        throw new AppError(
          404,
          'TARGET_RELEASE_NOT_PUBLISHED',
          `Target release '${resolvedTargetReleaseId}' is not published or does not exist.`,
        );
      }
    }

    // 2. Find eligible enrollments
    let enrollmentQuery = `
      SELECT e.id AS enrollment_id, e.user_id, e.release_id, e.resume_item_id, e.last_opened_item_id, u.email
      FROM enrollment e
      JOIN app_user u ON u.id = e.user_id
      WHERE e.course_id = 'software-engineer'
    `;
    const params: unknown[] = [];
    if (options.userEmail) {
      enrollmentQuery += ' AND (u.email = ? OR u.id = ?)';
      params.push(options.userEmail, options.userEmail);
    }
    const enrollments = readonlyDb.prepare(enrollmentQuery).all(...params) as {
      enrollment_id: string;
      user_id: string;
      release_id: string;
      resume_item_id: string | null;
      last_opened_item_id: string | null;
      email: string;
    }[];

    // Filter to those currently on an older/different release than target
    const eligible = enrollments.filter(
      (e) => e.release_id !== resolvedTargetReleaseId,
    );

    // 3. Plan each enrollment upgrade
    for (const e of eligible) {
      const sourceReleaseId = e.release_id;
      const targetReleaseId = resolvedTargetReleaseId!;

      const sourceItems = readonlyDb
        .prepare('SELECT * FROM content_item WHERE release_id = ?')
        .all(sourceReleaseId) as ContentItemRow[];
      const targetItems = readonlyDb
        .prepare('SELECT * FROM content_item WHERE release_id = ?')
        .all(targetReleaseId) as ContentItemRow[];

      const sourceById = new Map<string, ContentItemRow>(
        sourceItems.map((i) => [i.id, i]),
      );
      const targetByStableKey = new Map<string, ContentItemRow>(
        targetItems.map((i) => [i.stable_key, i]),
      );

      // Lessons in user_progress
      const userLessons = readonlyDb
        .prepare(
          'SELECT * FROM user_progress WHERE enrollment_id = ? AND release_id = ?',
        )
        .all(e.enrollment_id, sourceReleaseId) as UserProgressRow[];

      const transferredLessons: TransferredLesson[] = [];
      for (const row of userLessons) {
        const srcItem = sourceById.get(row.lesson_id);
        if (srcItem) {
          const tgtItem = targetByStableKey.get(srcItem.stable_key);
          if (tgtItem) {
            transferredLessons.push({
              stableKey: srcItem.stable_key,
              oldId: row.lesson_id,
              newId: tgtItem.id,
              status: row.status,
              startedAt: row.started_at,
              completedAt: row.completed_at,
              updatedAt: row.updated_at,
            });
          }
        }
      }

      // Exercises in exercise_progress
      const userExercises = readonlyDb
        .prepare(
          'SELECT * FROM exercise_progress WHERE enrollment_id = ? AND release_id = ?',
        )
        .all(e.enrollment_id, sourceReleaseId) as ExerciseProgressRow[];

      const transferredExercises: TransferredExercise[] = [];
      const reattemptRequiredExercises: {
        stableKey: string;
        oldId: string;
        reason: string;
      }[] = [];

      for (const row of userExercises) {
        const srcItem = sourceById.get(row.exercise_id);
        if (srcItem) {
          const tgtItem = targetByStableKey.get(srcItem.stable_key);
          if (tgtItem) {
            let materiallyChanged = false;
            if (customMap?.items?.[srcItem.stable_key]?.materiallyChanged) {
              materiallyChanged = true;
            } else if (customMap?.items?.[srcItem.stable_key]?.equivalent) {
              materiallyChanged = false;
            } else {
              materiallyChanged = srcItem.content_hash !== tgtItem.content_hash;
            }

            if (materiallyChanged) {
              reattemptRequiredExercises.push({
                stableKey: srcItem.stable_key,
                oldId: row.exercise_id,
                reason:
                  'Material exercise requirements changed between releases',
              });
            } else {
              transferredExercises.push({
                stableKey: srcItem.stable_key,
                oldId: row.exercise_id,
                newId: tgtItem.id,
                status: row.status,
                startedAt: row.started_at,
                completedAt: row.completed_at,
                criterionAttestedAt: row.criterion_attested_at,
                result: row.result,
                evidenceText: row.evidence_text,
                selectedScope: row.selected_scope,
                rubricJson: row.rubric_json,
                revealedHintLevel: row.revealed_hint_level,
                solutionRevealedAt: row.solution_revealed_at,
                rewriteAttestedAt: row.rewrite_attested_at,
                updatedAt: row.updated_at,
              });
            }
          }
        }
      }

      // Tasks in task_progress
      const userTasks = readonlyDb
        .prepare(
          'SELECT * FROM task_progress WHERE enrollment_id = ? AND release_id = ?',
        )
        .all(e.enrollment_id, sourceReleaseId) as TaskProgressRow[];

      const transferredTasks: TransferredTask[] = [];
      for (const row of userTasks) {
        const srcItem = sourceById.get(row.task_id);
        if (srcItem) {
          const tgtItem = targetByStableKey.get(srcItem.stable_key);
          if (tgtItem) {
            transferredTasks.push({
              stableKey: srcItem.stable_key,
              oldId: row.task_id,
              newId: tgtItem.id,
              status: row.status,
              reason: row.reason,
              updatedAt: row.updated_at,
            });
          }
        }
      }

      // Preparation in preparation_progress
      const userPrep = readonlyDb
        .prepare(
          'SELECT * FROM preparation_progress WHERE enrollment_id = ? AND release_id = ?',
        )
        .all(e.enrollment_id, sourceReleaseId) as PreparationProgressRow[];

      const transferredPrep: TransferredPrep[] = [];
      for (const row of userPrep) {
        const srcItem = sourceById.get(row.preparation_item_id);
        if (srcItem) {
          const tgtItem = targetByStableKey.get(srcItem.stable_key);
          if (tgtItem) {
            transferredPrep.push({
              stableKey: srcItem.stable_key,
              oldId: row.preparation_item_id,
              newId: tgtItem.id,
              completedAt: row.completed_at,
            });
          }
        }
      }

      // Notes in note
      const userNotes = readonlyDb
        .prepare(
          'SELECT * FROM note WHERE enrollment_id = ? AND release_id = ?',
        )
        .all(e.enrollment_id, sourceReleaseId) as NoteRow[];

      const transferredNotes: TransferredNote[] = [];
      for (const row of userNotes) {
        const srcItem = sourceById.get(row.content_item_id);
        if (srcItem) {
          const tgtItem = targetByStableKey.get(srcItem.stable_key);
          if (tgtItem) {
            transferredNotes.push({
              id: row.id,
              stableKey: srcItem.stable_key,
              oldId: row.content_item_id,
              newId: tgtItem.id,
              bodyText: row.body_text,
              revision: row.revision,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            });
          }
        }
      }

      // Cursor resolution
      let newResumeItemId: string | null = null;
      let newLastOpenedItemId: string | null = null;
      let fallbackApplied = false;

      if (e.resume_item_id) {
        const src = sourceById.get(e.resume_item_id);
        if (src) {
          const tgt = targetByStableKey.get(src.stable_key);
          if (tgt) {
            newResumeItemId = tgt.id;
          } else {
            fallbackApplied = true;
          }
        } else {
          fallbackApplied = true;
        }
      }

      if (e.last_opened_item_id) {
        const src = sourceById.get(e.last_opened_item_id);
        if (src) {
          const tgt = targetByStableKey.get(src.stable_key);
          if (tgt) {
            newLastOpenedItemId = tgt.id;
          } else {
            fallbackApplied = true;
          }
        } else {
          fallbackApplied = true;
        }
      }

      // Compute statistics before and after
      const oldRequiredItems = sourceItems.filter((i) => i.required === 1);
      const newRequiredItems = targetItems.filter((i) => i.required === 1);

      const oldRequiredTotal = oldRequiredItems.length;
      const newRequiredTotal = newRequiredItems.length;

      const oldCompletedCount =
        userLessons.filter((l) => l.status === 'completed').length +
        userExercises.filter((x) => x.status === 'completed').length;

      const newCompletedCount =
        transferredLessons.filter((l) => l.status === 'completed').length +
        transferredExercises.filter((x) => x.status === 'completed').length;

      const pctBefore =
        oldRequiredTotal > 0
          ? Math.floor((oldCompletedCount / oldRequiredTotal) * 100)
          : 0;
      const pctAfter =
        newRequiredTotal > 0
          ? Math.floor((newCompletedCount / newRequiredTotal) * 100)
          : 0;

      let explanation: string | undefined;
      if (pctAfter < pctBefore) {
        explanation = `Completion changed from ${pctBefore}% to ${pctAfter}%: new or changed required units in release ${targetReleaseId} require completion.`;
      }

      plans.push({
        enrollmentId: e.enrollment_id,
        userId: e.user_id,
        userEmail: e.email,
        sourceReleaseId,
        targetReleaseId,
        statsBefore: {
          requiredCompleted: oldCompletedCount,
          requiredTotal: oldRequiredTotal,
          percentage: pctBefore,
        },
        statsAfter: {
          requiredCompleted: newCompletedCount,
          requiredTotal: newRequiredTotal,
          percentage: pctAfter,
        },
        percentageChangeExplanation: explanation,
        transferredLessons,
        transferredExercises,
        reattemptRequiredExercises,
        transferredTasks,
        transferredPrep,
        transferredNotes,
        cursorResolution: {
          oldResumeItemId: e.resume_item_id,
          newResumeItemId,
          oldLastOpenedItemId: e.last_opened_item_id,
          newLastOpenedItemId,
          fallbackApplied,
        },
      });
    }
  } finally {
    readonlyDb.close();
  }

  // If dry-run, return plan immediately without taking backups or modifying data
  if (dryRun) {
    return {
      dryRun: true,
      targetReleaseId: resolvedTargetReleaseId!,
      plans,
    };
  }

  if (plans.length === 0) {
    return {
      dryRun: false,
      targetReleaseId: resolvedTargetReleaseId!,
      plans: [],
    };
  }

  // 4. Take verified pre-upgrade backup (§231, §268)
  const backupResult = await createBackup(resolvedDataDir, root);

  // 5. Apply migration transaction in database
  const writableDb = new Database(dbFile);
  try {
    writableDb.pragma('busy_timeout = 5000');
    // Disable foreign keys temporarily during staged child row transfer
    writableDb.pragma('foreign_keys = OFF');

    writableDb.transaction(() => {
      const now = Date.now();

      for (const plan of plans) {
        // Update enrollment
        writableDb
          .prepare(
            `
          UPDATE enrollment
          SET release_id = ?,
              revision = revision + 1,
              resume_item_id = ?,
              last_opened_item_id = ?,
              resume_updated_at = ?
          WHERE id = ?
        `,
          )
          .run(
            plan.targetReleaseId,
            plan.cursorResolution.newResumeItemId,
            plan.cursorResolution.newLastOpenedItemId,
            now,
            plan.enrollmentId,
          );

        // Delete old child progress rows
        writableDb
          .prepare('DELETE FROM user_progress WHERE enrollment_id = ?')
          .run(plan.enrollmentId);
        writableDb
          .prepare('DELETE FROM exercise_progress WHERE enrollment_id = ?')
          .run(plan.enrollmentId);
        writableDb
          .prepare('DELETE FROM task_progress WHERE enrollment_id = ?')
          .run(plan.enrollmentId);
        writableDb
          .prepare('DELETE FROM preparation_progress WHERE enrollment_id = ?')
          .run(plan.enrollmentId);
        writableDb
          .prepare('DELETE FROM note WHERE enrollment_id = ?')
          .run(plan.enrollmentId);

        // Insert transferred user_progress
        const insertUp = writableDb.prepare(`
          INSERT INTO user_progress (enrollment_id, release_id, lesson_id, status, started_at, completed_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const up of plan.transferredLessons) {
          insertUp.run(
            plan.enrollmentId,
            plan.targetReleaseId,
            up.newId,
            up.status,
            up.startedAt,
            up.completedAt,
            up.updatedAt,
          );
        }

        // Insert transferred exercise_progress
        const insertEp = writableDb.prepare(`
          INSERT INTO exercise_progress (enrollment_id, release_id, exercise_id, status, started_at, completed_at, criterion_attested_at, result, evidence_text, selected_scope, rubric_json, revealed_hint_level, solution_revealed_at, rewrite_attested_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const ep of plan.transferredExercises) {
          insertEp.run(
            plan.enrollmentId,
            plan.targetReleaseId,
            ep.newId,
            ep.status,
            ep.startedAt,
            ep.completedAt,
            ep.criterionAttestedAt,
            ep.result,
            ep.evidenceText,
            ep.selectedScope,
            ep.rubricJson,
            ep.revealedHintLevel,
            ep.solutionRevealedAt,
            ep.rewriteAttestedAt,
            ep.updatedAt,
          );
        }

        // Insert transferred task_progress
        const insertTp = writableDb.prepare(`
          INSERT INTO task_progress (enrollment_id, release_id, task_id, status, reason, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const tp of plan.transferredTasks) {
          insertTp.run(
            plan.enrollmentId,
            plan.targetReleaseId,
            tp.newId,
            tp.status,
            tp.reason,
            tp.updatedAt,
          );
        }

        // Insert transferred preparation_progress
        const insertPp = writableDb.prepare(`
          INSERT INTO preparation_progress (enrollment_id, release_id, preparation_item_id, completed_at)
          VALUES (?, ?, ?, ?)
        `);
        for (const pp of plan.transferredPrep) {
          insertPp.run(
            plan.enrollmentId,
            plan.targetReleaseId,
            pp.newId,
            pp.completedAt,
          );
        }

        // Insert transferred notes
        const insertNote = writableDb.prepare(`
          INSERT INTO note (id, enrollment_id, release_id, content_item_id, body_text, revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const n of plan.transferredNotes) {
          insertNote.run(
            n.id,
            plan.enrollmentId,
            plan.targetReleaseId,
            n.newId,
            n.bodyText,
            n.revision,
            n.createdAt,
            n.updatedAt,
          );
        }

        // Insert activity_event with type 'release_migrated'
        writableDb
          .prepare(
            `
          INSERT INTO activity_event (id, enrollment_id, item_stable_key, type, occurred_at, payload_json)
          VALUES (?, ?, NULL, 'release_migrated', ?, ?)
        `,
          )
          .run(
            randomUUID(),
            plan.enrollmentId,
            now,
            JSON.stringify({
              fromRelease: plan.sourceReleaseId,
              toRelease: plan.targetReleaseId,
              transferredLessons: plan.transferredLessons.length,
              transferredExercises: plan.transferredExercises.length,
              reattemptRequiredExercises:
                plan.reattemptRequiredExercises.length,
              transferredTasks: plan.transferredTasks.length,
              transferredNotes: plan.transferredNotes.length,
            }),
          );
      }
    })();

    // Re-enable foreign keys and verify integrity
    writableDb.pragma('foreign_keys = ON');
    const fkErrors = writableDb.pragma('foreign_key_check') as unknown[];
    if (fkErrors.length > 0) {
      throw new Error(
        `Curriculum upgrade produced foreign key violations: ${JSON.stringify(fkErrors)}`,
      );
    }
    const integrity = writableDb.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(
        `Curriculum upgrade integrity check failed: ${integrity}`,
      );
    }

    return {
      dryRun: false,
      targetReleaseId: resolvedTargetReleaseId!,
      backupPath: backupResult.directory,
      plans,
    };
  } finally {
    writableDb.close();
  }
}
