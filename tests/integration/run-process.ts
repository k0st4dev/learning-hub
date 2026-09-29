import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// File-backed output keeps diagnostics available without depending on OS pipe permissions.
export async function runProcess(args: string[], env = process.env) {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'learning-platform-process-'),
  );
  const stdoutFile = path.join(directory, 'stdout.txt');
  const stderrFile = path.join(directory, 'stderr.txt');
  const stdout = openSync(stdoutFile, 'w');
  const stderr = openSync(stderrFile, 'w');
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        env,
        stdio: ['ignore', stdout, stderr],
        windowsHide: true,
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Subprocess timed out'));
      }, 12000);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (result) => {
        clearTimeout(timer);
        resolve(result);
      });
    });
    return {
      code,
      stdout: await readFile(stdoutFile, 'utf8'),
      stderr: await readFile(stderrFile, 'utf8'),
    };
  } finally {
    closeSync(stdout);
    closeSync(stderr);
    if (
      path.dirname(directory) !== path.resolve(tmpdir()) ||
      !path.basename(directory).startsWith('learning-platform-process-')
    )
      throw new Error('Unexpected temporary path');
    await rm(directory, { recursive: true, force: true });
  }
}
