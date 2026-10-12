import { PassThrough, Writable } from 'node:stream';
import { expect, it, vi } from 'vitest';
import { terminalPrompts } from '../../src/server/auth/terminal-prompts';

function terminal() {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: vi.fn(),
  });
  let transcript = '';
  const output = Object.assign(
    new Writable({
      write(chunk, _encoding, callback) {
        transcript += chunk.toString();
        callback();
      },
    }),
    { isTTY: true },
  );
  return { input, output, transcript: () => transcript };
}
it('uses visible account prompts, suppresses secret paste/redraw echo and preserves exact Unicode/spaces', async () => {
  const io = terminal();
  const prompts = terminalPrompts(io.input, io.output);
  try {
    const email = prompts.ask('Email: ');
    io.input.write('owner@example.test\r');
    expect(await email).toBe('owner@example.test');
    expect(io.transcript()).toContain('owner@example.test');
    const password = ' Private čć 😀 passphrase ';
    const secret = prompts.ask('Secret: ', true);
    io.input.write('\x1b[200~' + password + '\x1b[201~\r');
    expect(await secret).toBe(password);
    expect(io.transcript()).not.toContain(password);
    expect(io.transcript()).not.toContain('Private');
    expect(io.transcript()).toContain('Secret: ');
    io.input.write('unsolicited-after-secret');
    expect(io.transcript()).not.toContain('unsolicited-after-secret');
  } finally {
    prompts.close();
  }
  expect(io.input.setRawMode).toHaveBeenLastCalledWith(false);
});
it('cancels hidden input on Ctrl+C and restores terminal mode', async () => {
  const io = terminal();
  const prompts = terminalPrompts(io.input, io.output);
  try {
    const secret = prompts.ask('Secret: ', true);
    const rejected = expect(secret).rejects.toThrow();
    io.input.write('never echoed\x03');
    await rejected;
    expect(prompts.signal.aborted).toBe(true);
    expect(io.transcript()).not.toContain('never echoed');
  } finally {
    prompts.close();
  }
  expect(io.input.setRawMode).toHaveBeenLastCalledWith(false);
});
it('cancels on input close and rejects noninteractive/redirected streams', async () => {
  const io = terminal();
  expect(() => terminalPrompts(new PassThrough(), io.output)).toThrow(
    'interactive terminal',
  );
  expect(() => terminalPrompts(io.input, new PassThrough())).toThrow(
    'interactive terminal',
  );
  const prompts = terminalPrompts(io.input, io.output);
  const secret = prompts.ask('Secret: ', true);
  const rejected = expect(secret).rejects.toThrow();
  io.input.end();
  await rejected;
  prompts.close();
  expect(prompts.signal.aborted).toBe(true);
});
