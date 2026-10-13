import { environment, root } from './environment.mjs';
import {
  terminalPrompts,
  TerminalPromptError,
} from '../src/server/auth/terminal-prompts.ts';
import { executeRestore } from '../src/server/db/restore.ts';
import { AppError } from '../src/server/errors.ts';

let prompts;
try {
  let fileArg;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--file' && i + 1 < process.argv.length) {
      fileArg = process.argv[++i];
    } else if (arg?.startsWith('--file=')) {
      fileArg = arg.slice('--file='.length);
    } else {
      throw new TerminalPromptError(
        'Use npm run restore -- --file <backup-path>. APP_DATA_DIR selects the target installation.',
      );
    }
  }
  if (!fileArg) {
    throw new TerminalPromptError(
      'Use npm run restore -- --file <backup-path>. APP_DATA_DIR selects the target installation.',
    );
  }

  const config = environment();
  prompts = terminalPrompts(process.stdin, process.stdout, 'Restore');
  const result = await executeRestore({
    dataDir: config.dataDir,
    root,
    backupPath: fileArg,
    prompts,
    output: (text) => process.stdout.write(text),
  });
  console.log(
    `Restore complete.\nTarget database: ${result.targetFile}\nRestored from: ${result.restoredFrom}\nSafety backup: ${result.safetyBackup ?? 'none'}\nAll sessions revoked; new CSRF secret generated.\nRestart the server to resume learning.`,
  );
} catch (cause) {
  const message = prompts?.signal.aborted
    ? 'Restore canceled.'
    : cause instanceof AppError || cause instanceof TerminalPromptError
      ? cause.message
      : 'Restore could not complete. Target data was preserved; verify setup and backup bundle before retrying.';
  console.error(message);
  process.exitCode = prompts?.signal.aborted ? 130 : 1;
} finally {
  prompts?.close();
}
