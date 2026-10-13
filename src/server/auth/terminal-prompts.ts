import { createInterface } from 'node:readline/promises';
import { Readable, Writable } from 'node:stream';
export class TerminalPromptError extends Error {}
type TerminalInput = Readable & {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
};
type TerminalOutput = Writable & { isTTY?: boolean };
/** Suppress all readline output during secrets, including paste/redraw echo. */
export function terminalPrompts(
  input: TerminalInput = process.stdin,
  output: TerminalOutput = process.stdout,
  operation = 'Password recovery',
) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function')
    throw new TerminalPromptError(
      `${operation} requires an interactive terminal. Piped input, redirected output and password arguments are not supported.`,
    );
  let hidden = false;
  const muted = new Writable({
    write(chunk, encoding, callback) {
      if (!hidden) output.write(chunk, encoding);
      callback();
    },
  });
  const controller = new AbortController();
  const readline = createInterface({
    input,
    output: muted,
    terminal: true,
    historySize: 0,
    prompt: '',
  });
  readline.on('SIGINT', () =>
    controller.abort(new Error('Recovery canceled.')),
  );
  readline.on('close', () => {
    if (!controller.signal.aborted)
      controller.abort(new Error('Recovery canceled.'));
  });
  return {
    signal: controller.signal,
    async ask(prompt: string, secret = false) {
      controller.signal.throwIfAborted();
      hidden = secret;
      try {
        if (secret) output.write(prompt);
        return await readline.question(secret ? '' : prompt, {
          signal: controller.signal,
        });
      } finally {
        // Keep unsolicited input muted while the caller hashes/commits.
        // A subsequent visible question explicitly unmutes in ask().
        if (secret) output.write('\n');
      }
    },
    close() {
      readline.close();
      muted.end();
    },
  };
}
