import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  mkdir,
  mkdtemp,
  rm,
  access,
  writeFile,
  readFile,
} from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { authRepository } from '../../src/server/auth/repository';
import { digest } from '../../src/server/auth/crypto';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import { acquireOperationLock } from '../../src/server/db/operation-lock';
import { readConfig } from '../../src/server/config';
import {
  register,
  login,
  currentUser,
  requireStudent,
} from '../../src/server/auth/service';
import {
  recoverPassword,
  recoveryAccount,
} from '../../src/server/auth/recovery';
import {
  executeRecovery,
  type RecoveryPrompts,
} from '../../src/server/auth/recovery-operation';
import * as passwords from '../../src/server/auth/passwords';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import { startCourse, mutateLearning } from '../../src/server/learning/mutate';
import { snapshot, continuePath } from '../../src/server/learning/read';
import { saveNote, readNote } from '../../src/server/learning/notes';
const root = process.cwd(),
  password = 'A quiet river under bright stars',
  next = ' Recovered password čć 😀 with spaces ';
let directory: string, store: Store, token: string, id: string;
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/recovery-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  await register(store, {
    email: 'owner@example.test',
    password,
    confirmation: password,
  });
  token = (await login(store, { email: 'owner@example.test', password })).token;
  id = requireStudent(store, token).id;
});
afterEach(async () => {
  vi.restoreAllMocks();
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('recovery-test-')
  )
    throw new Error('Unsafe test directory');
  await rm(directory, { recursive: true, force: true });
});
const input = () => ({
  email: ' OWNER@example.test ',
  newPassword: next,
  expectedStudentId: id,
});
const user = () =>
  store.native.prepare('SELECT * FROM app_user WHERE id=?').get(id) as Record<
    string,
    unknown
  >;
const sessions = () =>
  store.native.prepare('SELECT * FROM session ORDER BY rowid').all();
async function config() {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return readConfig(
    {
      APP_DATA_DIR: directory,
      PORT: String(port),
      APP_ORIGIN: 'http://127.0.0.1:' + port,
    },
    root,
  );
}
function prompts(
  answers = ['owner@example.test', 'RESET', next],
): RecoveryPrompts {
  return {
    signal: new AbortController().signal,
    ask: vi.fn(async () => answers.shift() ?? ''),
  };
}
it('recovers one account without its old password, revokes all owner sessions and preserves peer and full learning data', async () => {
  const second = (await login(store, { email: 'owner@example.test', password }))
    .token;
  await register(store, {
    email: 'peer@example.test',
    password,
    confirmation: password,
  });
  const peer = (await login(store, { email: 'peer@example.test', password }))
    .token;
  const peerRows = store.native
    .prepare('SELECT * FROM app_user WHERE id<>?')
    .all(id);
  const plan = await loadArchivedCurriculum(root);
  importCurriculum(store, plan.source);
  startCourse(store, token);
  mutateLearning(store, token, {
    kind: 'orientation',
    acknowledged: true,
    deferred: true,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });
  mutateLearning(store, token, {
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
    expectedRevision: 1,
    mutationId: randomUUID(),
  });
  saveNote(store, token, {
    itemId: 'se-26w-v1:d001',
    body: 'Recovery must preserve this private note',
    expectedStudentId: id,
    expectedRevision: 0,
    mutationId: randomUUID(),
  });
  const tables = [
    'enrollment',
    'user_progress',
    'exercise_progress',
    'task_progress',
    'preparation_progress',
    'note',
    'scorecard',
    'activity_event',
    'mutation_receipt',
    'settings_receipt',
    'course_release',
    'content_item',
    'source_block',
    'source_mapping',
    'resource',
    'resource_use',
    'exercise_task',
  ];
  const rows = () =>
    tables.map((table) =>
      store.native.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
    );
  const before = rows(),
    learning = snapshot(store, token),
    resume = continuePath(learning),
    old = user();
  await recoverPassword(store, input());
  expect(user().password_hash).not.toBe(old.password_hash);
  expect(user().settings_revision).toBe(old.settings_revision);
  expect(rows()).toEqual(before);
  expect(
    store.native.prepare('SELECT * FROM app_user WHERE id<>?').all(id),
  ).toEqual(peerRows);
  expect(currentUser(store, token)).toBeNull();
  expect(currentUser(store, second)).toBeNull();
  expect(currentUser(store, peer)).not.toBeNull();
  store.native.close();
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  await expect(
    login(store, { email: 'owner@example.test', password }),
  ).rejects.toMatchObject({ status: 401 });
  const fresh = (
    await login(store, { email: 'owner@example.test', password: next })
  ).token;
  expect(snapshot(store, fresh)).toEqual(learning);
  expect(continuePath(snapshot(store, fresh))).toBe(resume);
  expect(readNote(store, fresh, 'se-26w-v1:d001').body).toContain(
    'Recovery must preserve',
  );
});
it.each([
  { newPassword: 'short' },
  { newPassword: '😀'.repeat(129) },
  { newPassword: '\u0800'.repeat(200) },
  { oldPassword: password },
  { expectedStudentId: 'foreign' },
  { email: 'absent@example.test' },
])(
  'rejects bad input or wrong target without changing credentials %j',
  async (change) => {
    const before = user(),
      prior = sessions();
    await expect(
      recoverPassword(store, { ...input(), ...change }),
    ).rejects.toThrow();
    expect(user()).toEqual(before);
    expect(sessions()).toEqual(prior);
  },
);
it('rolls back hash, revocations and account-throttle cleanup together', async () => {
  const before = user(),
    prior = sessions();
  store.native.exec(
    "CREATE TRIGGER fail_recovery BEFORE UPDATE OF revoked_at ON session BEGIN SELECT RAISE(ABORT,'recovery rollback test'); END",
  );
  await expect(recoverPassword(store, input())).rejects.toThrow(
    'recovery rollback test',
  );
  expect(user()).toEqual(before);
  expect(sessions()).toEqual(prior);
});
it('rejects cancellation while hashing', async () => {
  const original = passwords.hashPassword;
  let release!: () => void, reached!: () => void;
  const ready = new Promise<void>((resolve) => {
      reached = resolve;
    }),
    barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
  vi.spyOn(passwords, 'hashPassword').mockImplementationOnce(async (value) => {
    const hash = await original(value);
    reached();
    await barrier;
    return hash;
  });
  const controller = new AbortController(),
    before = user();
  const pending = recoverPassword(store, input(), controller.signal);
  const rejected = expect(pending).rejects.toThrow();
  await ready;
  controller.abort();
  release();
  await rejected;
  expect(user()).toEqual(before);
  await expect(
    recoverPassword(store, input(), controller.signal),
  ).rejects.toThrow();
});
it('rejects a credential changed by another writer during hashing', async () => {
  const original = passwords.hashPassword;
  let release!: () => void, reached!: () => void;
  const ready = new Promise<void>((resolve) => {
      reached = resolve;
    }),
    barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
  vi.spyOn(passwords, 'hashPassword').mockImplementationOnce(async (value) => {
    const hash = await original(value);
    reached();
    await barrier;
    return hash;
  });
  const pending = recoverPassword(store, input());
  const rejected = expect(pending).rejects.toMatchObject({
    code: 'ACCOUNT_CHANGED',
  });
  await ready;
  store.native
    .prepare('UPDATE app_user SET password_hash=? WHERE id=?')
    .run('independent-writer', id);
  release();
  await rejected;
  expect(user().password_hash).toBe('independent-writer');
});
it('clears only selected-account failures while preserving installation and peer limits', async () => {
  const repo = authRepository(store),
    now = Date.now();
  repo.failLogin('peer@example.test', now);
  for (let n = 0; n < 5; n++) {
    repo.failLogin('owner@example.test', now);
    repo.failPasswordChange(id, now);
  }
  const keepKeys = [
    digest('login:ip:127.0.0.1'),
    digest('password:installation:127.0.0.1'),
    digest('login:email:peer@example.test'),
  ];
  const retained = () =>
    keepKeys.map((key) =>
      store.native
        .prepare('SELECT * FROM auth_throttle WHERE key_hash=?')
        .get(key),
    );
  const before = retained();
  await recoverPassword(store, input());
  expect(retained()).toEqual(before);
  expect(
    store.native
      .prepare('SELECT * FROM auth_throttle WHERE key_hash=?')
      .get(digest('login:email:owner@example.test')),
  ).toBeUndefined();
  expect(
    store.native
      .prepare('SELECT * FROM auth_throttle WHERE key_hash=?')
      .get(digest('password:user:' + id)),
  ).toBeUndefined();
  expect(
    (await login(store, { email: 'owner@example.test', password: next }, now))
      .token,
  ).toBeTruthy();
});
it('runs the confirmed operation with a secret prompt and releases both locks and the port', async () => {
  const cfg = await config(),
    io = prompts(),
    output = vi.fn();
  expect(recoveryAccount(store, ' OWNER@example.test ')).toEqual({
    id,
    email: 'owner@example.test',
  });
  await executeRecovery(cfg, root, io, output);
  expect(io.ask).toHaveBeenLastCalledWith('New password (hidden): ', true);
  expect(output.mock.calls.flat().join('')).not.toContain(next);
  expect(output.mock.calls.flat().join('')).not.toContain('$argon2');
  for (const file of ['.local-operation.lock', '.setup.lock'])
    await expect(access(path.join(directory, file))).rejects.toThrow();
  const lease = await acquireOperationLock(directory, root, 'server');
  await lease.release();
  expect(
    (await login(store, { email: 'owner@example.test', password: next })).token,
  ).toBeTruthy();
});
it('cancels before requesting a password when the target confirmation is declined', async () => {
  const io = prompts(['owner@example.test', 'no']),
    before = user();
  await expect(
    executeRecovery(await config(), root, io, vi.fn()),
  ).rejects.toMatchObject({ code: 'RECOVERY_CANCELED' });
  expect(io.ask).toHaveBeenCalledTimes(2);
  expect(user()).toEqual(before);
});
it('refuses active/stale server and setup locks, never deleting another owner lock', async () => {
  const cfg = await config(),
    io = prompts(),
    before = user(),
    lease = await acquireOperationLock(directory, root, 'server');
  try {
    await expect(executeRecovery(cfg, root, io, vi.fn())).rejects.toMatchObject(
      { code: 'LOCAL_DATA_BUSY' },
    );
    expect(io.ask).not.toHaveBeenCalled();
  } finally {
    await lease.release();
  }
  await writeFile(path.join(directory, '.setup.lock'), 'existing setup');
  await expect(executeRecovery(cfg, root, io, vi.fn())).rejects.toMatchObject({
    code: 'SETUP_RUNNING',
  });
  expect(await readFile(path.join(directory, '.setup.lock'), 'utf8')).toBe(
    'existing setup',
  );
  expect(user()).toEqual(before);
});
it('refuses an occupied port or incompatible migration before any prompt or write', async () => {
  const cfg = await config(),
    io = prompts(),
    before = user(),
    server = createServer();
  await new Promise<void>((resolve) =>
    server.listen(cfg.port, cfg.host, resolve),
  );
  try {
    await expect(executeRecovery(cfg, root, io, vi.fn())).rejects.toMatchObject(
      { code: 'SERVER_RUNNING' },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  store.native.exec(
    "UPDATE _app_migration SET checksum='altered' WHERE id='0002'",
  );
  await expect(executeRecovery(cfg, root, io, vi.fn())).rejects.toMatchObject({
    code: 'SCHEMA_MISMATCH',
  });
  expect(io.ask).not.toHaveBeenCalled();
  expect(user()).toEqual(before);
});
