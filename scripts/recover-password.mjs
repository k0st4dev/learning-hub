import { z } from 'zod';
import { environment, root } from './environment.mjs';
import {
  terminalPrompts,
  TerminalPromptError,
} from '../src/server/auth/terminal-prompts.ts';
import { executeRecovery } from '../src/server/auth/recovery-operation.ts';
import { AppError } from '../src/server/errors.ts';

let prompts;
try {
  if (process.argv.length !== 2)
    throw new TerminalPromptError(
      'Use npm run password:reset without arguments. Enter the account and new password only at the prompts.',
    );
  const config = environment();
  prompts = terminalPrompts();
  await executeRecovery(config, root, prompts, (text) =>
    process.stdout.write(text),
  );
} catch (cause) {
  // Unknown database/driver errors may contain query parameters. Never log them.
  const message = prompts?.signal.aborted
    ? 'Recovery canceled.'
    : cause instanceof z.ZodError
      ? cause.issues.map((issue) => issue.message).join(' ')
      : cause instanceof AppError || cause instanceof TerminalPromptError
        ? cause.message
        : 'Recovery could not complete. Preserve the data directory, check setup and retry.';
  console.error(message);
  process.exitCode = prompts?.signal.aborted ? 130 : 1;
} finally {
  prompts?.close();
}
