import { environment, root } from './environment.mjs';
import { executeCurriculumUpgrade } from '../src/server/content/upgrade.ts';
import { AppError } from '../src/server/errors.ts';

try {
  let dryRun = false;
  let jsonOutput = false;
  let targetReleaseId;
  let userEmail;
  let mapPath;

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--target-release' && i + 1 < process.argv.length) {
      targetReleaseId = process.argv[++i];
    } else if (arg.startsWith('--target-release=')) {
      targetReleaseId = arg.slice('--target-release='.length);
    } else if (arg === '--user' && i + 1 < process.argv.length) {
      userEmail = process.argv[++i];
    } else if (arg.startsWith('--user=')) {
      userEmail = arg.slice('--user='.length);
    } else if (arg === '--map' && i + 1 < process.argv.length) {
      mapPath = process.argv[++i];
    } else if (arg.startsWith('--map=')) {
      mapPath = arg.slice('--map='.length);
    } else {
      throw new AppError(
        400,
        'UPGRADE_ARGUMENTS',
        'Use npm run curriculum:upgrade [-- --dry-run] [--target-release <id>] [--user <email>] [--map <path>] [--json]. APP_DATA_DIR selects the target installation.',
      );
    }
  }

  const config = environment();
  const result = await executeCurriculumUpgrade({
    dataDir: config.dataDir,
    root,
    dryRun,
    targetReleaseId,
    userEmail,
    mapPath,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const header = result.dryRun
      ? 'Curriculum Upgrade Plan (DRY RUN)'
      : 'Curriculum Upgrade Complete';
    console.log(`${header}: Target Release ${result.targetReleaseId}`);

    if (result.backupPath) {
      console.log(`Pre-upgrade backup created at: ${result.backupPath}`);
    }

    if (result.plans.length === 0) {
      console.log('No eligible enrollments found requiring upgrade.');
    } else {
      console.log(`\nEnrollment upgrades (${result.plans.length}):`);
      for (const plan of result.plans) {
        console.log(`\n  User: ${plan.userEmail} (${plan.userId})`);
        console.log(
          `  Release: ${plan.sourceReleaseId} -> ${plan.targetReleaseId}`,
        );
        console.log(
          `  Progress before: ${plan.statsBefore.requiredCompleted}/${plan.statsBefore.requiredTotal} (${plan.statsBefore.percentage}%)`,
        );
        console.log(
          `  Progress after: ${plan.statsAfter.requiredCompleted}/${plan.statsAfter.requiredTotal} (${plan.statsAfter.percentage}%)`,
        );
        if (plan.percentageChangeExplanation) {
          console.log(`  Explanation: ${plan.percentageChangeExplanation}`);
        }
        console.log(`  Transferred lessons: ${plan.transferredLessons.length}`);
        console.log(
          `  Transferred exercises: ${plan.transferredExercises.length}`,
        );
        if (plan.reattemptRequiredExercises.length > 0) {
          console.log(
            `  Exercises requiring reattempt: ${plan.reattemptRequiredExercises.length}`,
          );
          for (const rx of plan.reattemptRequiredExercises) {
            console.log(`    - ${rx.stableKey}: ${rx.reason}`);
          }
        }
        console.log(`  Transferred tasks: ${plan.transferredTasks.length}`);
        console.log(`  Transferred prep items: ${plan.transferredPrep.length}`);
        console.log(`  Transferred notes: ${plan.transferredNotes.length}`);
        if (plan.cursorResolution.fallbackApplied) {
          console.log(
            '  Cursor resolution: target item removed in new release; safely reset to start.',
          );
        }
      }
    }

    if (result.dryRun) {
      console.log(
        '\nDry run completed. No data was modified and no backups were taken.',
      );
      console.log('To apply the upgrade, re-run without --dry-run.');
    } else {
      console.log('\nUpgrade applied successfully.');
    }
  }

  process.exitCode = 0;
} catch (cause) {
  console.error(
    cause instanceof AppError
      ? cause.message
      : 'Curriculum upgrade could not complete. Verify setup, storage and target release.',
  );
  process.exitCode = 1;
}
