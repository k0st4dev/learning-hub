import { environment, root } from './environment.mjs';
import { diagnoseDatabase } from '../src/server/db/diagnose.ts';
import { AppError } from '../src/server/errors.ts';

try {
  let jsonOutput = false;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--json') {
      jsonOutput = true;
    } else {
      throw new AppError(
        400,
        'DIAGNOSE_ARGUMENTS',
        'Use npm run db:diagnose [--json]. APP_DATA_DIR selects the target installation.',
      );
    }
  }

  const config = environment();
  const result = await diagnoseDatabase(config.dataDir, root);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Database Diagnostics: ${result.targetFile}`);
    console.log(`Timestamp: ${result.timestamp}`);
    console.log(
      `[${result.checks.storage ? 'OK' : 'FAIL'}] Storage & file access`,
    );
    console.log(
      `[${result.checks.integrity ? 'OK' : 'FAIL'}] SQLite integrity check`,
    );
    console.log(
      `[${result.checks.foreignKeys ? 'OK' : 'FAIL'}] Foreign key constraints`,
    );
    console.log(
      `[${result.checks.schema ? 'OK' : 'FAIL'}] Schema migrations (_app_migration)`,
    );
    console.log(
      `[${result.checks.release ? 'OK' : 'FAIL'}] Curriculum release verification`,
    );
    console.log(
      `[${result.checks.progress ? 'OK' : 'FAIL'}] Progress and learner data consistency`,
    );

    if (result.counts) {
      console.log('\nSummary counts:');
      console.log(`  Users: ${result.counts.users}`);
      console.log(`  Enrollments: ${result.counts.enrollments}`);
      console.log(`  Lessons completed: ${result.counts.lessonsCompleted}`);
      console.log(`  Exercises completed: ${result.counts.exercisesCompleted}`);
      console.log(`  Tasks completed: ${result.counts.tasksCompleted}`);
      console.log(`  Notes: ${result.counts.notes}`);
      console.log(`  Scorecards: ${result.counts.scorecards}`);
    }

    if (result.issues.length > 0) {
      console.log(`\nIssues found (${result.issues.length}):`);
      for (const issue of result.issues) {
        const target = issue.table
          ? ` [table: ${issue.table}${issue.identifier ? `, id: ${issue.identifier}` : ''}]`
          : issue.identifier
            ? ` [${issue.identifier}]`
            : '';
        console.log(`  - [${issue.code}]${target}: ${issue.message}`);
        if (issue.remediation) {
          console.log(`    Remediation: ${issue.remediation}`);
        }
      }
    }

    if (result.remediation) {
      console.log(`\nRemediation guidance:`);
      console.log(`  ${result.remediation}`);
    }

    console.log(
      `\nStatus: ${result.ok ? 'All diagnostic checks passed (OK).' : 'Diagnostic checks failed (FAIL).'}\n`,
    );
  }

  process.exitCode = result.ok ? 0 : 1;
} catch (cause) {
  console.error(
    cause instanceof AppError
      ? cause.message
      : 'Diagnostic check could not run. Verify setup, storage and configuration.',
  );
  process.exitCode = 1;
}
