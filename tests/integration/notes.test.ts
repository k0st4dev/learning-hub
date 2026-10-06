import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  importCurriculum,
  loadArchivedCurriculum,
} from '../../src/server/content/import';
import {
  register,
  login,
  logout,
  requireStudent,
} from '../../src/server/auth/service';
import { createCsrf } from '../../src/server/auth/csrf';
import { startCourse, mutateLearning } from '../../src/server/learning/mutate';
import { snapshot, continuePath } from '../../src/server/learning/read';
import { readNote, saveNote } from '../../src/server/learning/notes';
import { noteSubmissionSchema } from '../../src/domain/notes';
import { GET, PUT } from '../../src/app/api/notes/[itemId]/route';

vi.mock('../../src/server/db/current', () => ({ getStore: () => store }));
const root = process.cwd();
const origin = 'http://127.0.0.1:3000';
const password = 'Private local notes integration password';
const day = 'se-26w-v1:d001';
const lesson = 'se-26w-v1:d001-learn';
let plan: Awaited<ReturnType<typeof loadArchivedCurriculum>>;
let directory: string;
let store: Store;
let token: string;
let studentId: string;
let secret: string;
beforeAll(async () => {
  plan = await loadArchivedCurriculum(root);
});
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/notes-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  importCurriculum(store, plan.source);
  token = await account('first');
  studentId = requireStudent(store, token).id;
  startCourse(store, token);
  secret = (await readFile(path.join(directory, 'csrf-secret'), 'utf8')).trim();
  vi.stubEnv('APP_DATA_DIR', directory);
  vi.stubEnv('APP_ORIGIN', origin);
  vi.stubEnv('PORT', '3000');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('notes-test-')
  )
    throw new Error('Unexpected note test directory');
  await rm(directory, { recursive: true, force: true });
});
async function account(name: string) {
  const email = name + '@example.test';
  await register(store, { email, password, confirmation: password });
  return (await login(store, { email, password })).token;
}
function input(
  body = 'Moja privatna beleška',
  itemId = day,
  expectedRevision = 0,
) {
  return {
    mutationId: randomUUID(),
    itemId,
    expectedRevision,
    expectedStudentId: studentId,
    body,
  };
}
function counters() {
  return {
    notes: store.native.prepare('SELECT count(*) AS n FROM note').get(),
    receipts: store.native
      .prepare('SELECT count(*) AS n FROM mutation_receipt')
      .get(),
  };
}
function request(
  method: 'GET' | 'PUT',
  body?: unknown,
  headers: Record<string, string> = {},
  session: string | undefined = token,
) {
  const csrf = createCsrf(secret, session);
  return new NextRequest(origin + '/api/notes/' + encodeURIComponent(day), {
    method,
    headers: {
      host: '127.0.0.1:3000',
      origin,
      cookie:
        (session ? 'learning_session=' + session + '; ' : '') +
        'learning_csrf=' +
        csrf,
      'x-csrf-token': csrf,
      'content-type': 'application/json',
      ...headers,
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}
const context = () => ({ params: Promise.resolve({ itemId: day }) });

describe('owned, durable private notes', () => {
  it('reads an absent note without creating records, then preserves exact plain text and timestamps on update/clear', () => {
    expect(readNote(store, token, day)).toEqual({
      itemId: day,
      body: '',
      revision: 0,
      createdAt: null,
      updatedAt: null,
    });
    expect(counters()).toEqual({ notes: { n: 0 }, receipts: { n: 0 } });
    const text =
      '  Srpski: čćžšđ / Ћирилица 😀\n<script>alert("plain text")</script>\n ';
    const first = saveNote(store, token, input(text));
    expect(first).toMatchObject({ itemId: day, body: text, revision: 1 });
    expect(first.createdAt).toBeTypeOf('number');
    expect(readNote(store, token, day)).toEqual(first);
    const second = saveNote(store, token, input('Updated', day, 1));
    const cleared = saveNote(store, token, input('', day, 2));
    expect(cleared).toMatchObject({
      body: '',
      revision: 3,
      createdAt: first.createdAt,
    });
    expect(cleared.updatedAt!).toBeGreaterThanOrEqual(second.updatedAt!);
    expect(counters()).toEqual({ notes: { n: 1 }, receipts: { n: 3 } });
  });
  it('keeps note versions independent between content items and from learning revisions, credit, cursor and activity', () => {
    let learning = mutateLearning(store, token, {
      kind: 'orientation',
      acknowledged: true,
      deferred: true,
      expectedRevision: 0,
      mutationId: randomUUID(),
    });
    learning = mutateLearning(store, token, {
      kind: 'cursor',
      mode: 'study',
      itemId: lesson,
      anchor: 'study',
      expectedRevision: learning.revision,
      mutationId: randomUUID(),
    });
    const activity = store.native
      .prepare('SELECT * FROM activity_event ORDER BY id')
      .all();
    const destination = continuePath(learning);
    const kinds = store.native
      .prepare('SELECT kind, MIN(id) AS id FROM content_item GROUP BY kind')
      .all() as { kind: string; id: string }[];
    for (const item of kinds) {
      const first = saveNote(store, token, input(item.kind, item.id));
      expect(first.revision).toBe(1);
      expect(readNote(store, token, item.id)).toEqual(first);
    }
    expect(saveNote(store, token, input('Day', day, 1)).revision).toBe(2);
    expect(
      saveNote(
        store,
        token,
        input('Lesson', lesson, readNote(store, token, lesson).revision),
      ).revision,
    ).toBe(2);
    expect(snapshot(store, token)).toEqual(learning);
    expect(continuePath(snapshot(store, token))).toBe(destination);
    expect(
      store.native.prepare('SELECT * FROM activity_event ORDER BY id').all(),
    ).toEqual(activity);
  });
  it('separates two accounts even on the same item and refuses a stale form after switching accounts', async () => {
    const first = saveNote(store, token, input('First private secret'));
    const secondToken = await account('second');
    const secondStudentId = requireStudent(store, secondToken).id;
    startCourse(store, secondToken);
    expect(readNote(store, secondToken, day)).toMatchObject({
      body: '',
      revision: 0,
    });
    expect(() =>
      saveNote(store, secondToken, input('First stale draft')),
    ).toThrow(expect.objectContaining({ code: 'ACCOUNT_CHANGED' }));
    const second = saveNote(store, secondToken, {
      ...input('Second private secret'),
      expectedStudentId: secondStudentId,
    });
    expect(readNote(store, token, day)).toEqual(first);
    expect(readNote(store, secondToken, day)).toEqual(second);
    try {
      saveNote(store, secondToken, {
        ...input('stale conflict'),
        expectedStudentId: secondStudentId,
      });
      throw new Error('Expected conflict');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'REVISION_CONFLICT',
        details: { currentState: second },
      });
      expect(JSON.stringify(error)).not.toContain('First private secret');
    }
  });
  it('rejects missing enrollment/items and items outside the pinned release without creating note receipts', async () => {
    const unEnrolled = await account('not-enrolled');
    expect(() => readNote(store, unEnrolled, day)).toThrow(
      expect.objectContaining({ code: 'ENROLLMENT_REQUIRED' }),
    );
    expect(() =>
      saveNote(store, unEnrolled, {
        ...input(),
        expectedStudentId: requireStudent(store, unEnrolled).id,
      }),
    ).toThrow(expect.objectContaining({ code: 'ENROLLMENT_REQUIRED' }));
    store.native.exec(`
      INSERT INTO course_release (id, course_id, version, status, source_filename, source_sha256, manifest_sha256, created_at)
      SELECT 'unowned-release', course_id, 'synthetic-unowned', 'draft', source_filename, source_sha256, manifest_sha256, created_at
      FROM course_release WHERE id = 'se-26w-v1';
      INSERT INTO content_item (id, release_id, stable_key, kind, order_index, title, content_hash)
      SELECT 'unowned-release:d001-learn', 'unowned-release', stable_key, kind, order_index, title, content_hash
      FROM content_item WHERE id = 'se-26w-v1:d001-learn';
    `);
    for (const itemId of ['se-26w-v1:missing', 'unowned-release:d001-learn']) {
      expect(() => readNote(store, token, itemId)).toThrow(
        expect.objectContaining({ code: 'ITEM_NOT_FOUND' }),
      );
      expect(() => saveNote(store, token, input('secret', itemId))).toThrow(
        expect.objectContaining({ code: 'ITEM_NOT_FOUND' }),
      );
    }
    expect(counters()).toEqual({ notes: { n: 0 }, receipts: { n: 0 } });
  });
  it('requires a live session for reads, writes and receipt retries', async () => {
    const payload = input();
    saveNote(store, token, payload);
    for (const invalid of [undefined, 'forged']) {
      expect(() => readNote(store, invalid, day)).toThrow(
        expect.objectContaining({ status: 401 }),
      );
      expect(() => saveNote(store, invalid, payload)).toThrow(
        expect.objectContaining({ status: 401 }),
      );
    }
    store.native
      .prepare(
        'UPDATE session SET created_at = 0, last_seen_at = 0, expires_at = 1',
      )
      .run();
    expect(() => saveNote(store, token, payload)).toThrow(
      expect.objectContaining({ status: 401 }),
    );
    token = (await login(store, { email: 'first@example.test', password }))
      .token;
    logout(store, token);
    expect(() => readNote(store, token, day)).toThrow(
      expect.objectContaining({ status: 401 }),
    );
    expect(counters()).toEqual({ notes: { n: 1 }, receipts: { n: 1 } });
  });
  it('replays an acknowledged save exactly, including after subsequent saves, but rejects reused keys and stale edits', () => {
    const payload = input('Original');
    const first = saveNote(store, token, payload);
    expect(saveNote(store, token, payload)).toEqual(first);
    const second = saveNote(store, token, input('Newer', day, 1));
    expect(saveNote(store, token, payload)).toEqual(first);
    expect(readNote(store, token, day)).toEqual(second);
    for (const change of [
      { body: 'Changed' },
      { itemId: lesson },
      { expectedRevision: 2 },
    ])
      expect(() => saveNote(store, token, { ...payload, ...change })).toThrow(
        expect.objectContaining({ code: 'MUTATION_REUSED' }),
      );
    expect(() => saveNote(store, token, input('Lost update', day, 1))).toThrow(
      expect.objectContaining({
        code: 'REVISION_CONFLICT',
        details: { revision: 2, currentState: second },
      }),
    );
    expect(counters()).toEqual({ notes: { n: 1 }, receipts: { n: 2 } });
  });
  it('never replays progress responses as notes or notes as progress when a mutation key collides', () => {
    const mutationId = randomUUID();
    const learning = {
      kind: 'orientation',
      acknowledged: true,
      deferred: true,
      expectedRevision: 0,
      mutationId,
    };
    mutateLearning(store, token, learning);
    expect(() => saveNote(store, token, { ...input(), mutationId })).toThrow(
      expect.objectContaining({ code: 'MUTATION_REUSED' }),
    );
    const noteInput = input();
    saveNote(store, token, noteInput);
    expect(() =>
      mutateLearning(store, token, {
        ...learning,
        mutationId: noteInput.mutationId,
        expectedRevision: 1,
      }),
    ).toThrow(expect.objectContaining({ code: 'MUTATION_REUSED' }));
    expect(counters()).toEqual({ notes: { n: 1 }, receipts: { n: 2 } });
  });
  it('rolls back both new and edited notes if receipt storage fails, then permits the exact retry', () => {
    const fail = () =>
      store.native.exec(
        "CREATE TRIGGER fail_note_receipt BEFORE INSERT ON mutation_receipt BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END;",
      );
    const recover = () => store.native.exec('DROP TRIGGER fail_note_receipt');
    const payload = input();
    fail();
    expect(() => saveNote(store, token, payload)).toThrow(
      'simulated disk failure',
    );
    expect(readNote(store, token, day).revision).toBe(0);
    expect(counters()).toEqual({ notes: { n: 0 }, receipts: { n: 0 } });
    recover();
    const saved = saveNote(store, token, payload);
    const update = input('Updated', day, 1);
    fail();
    expect(() => saveNote(store, token, update)).toThrow(
      'simulated disk failure',
    );
    expect(readNote(store, token, day)).toEqual(saved);
    expect(counters()).toEqual({ notes: { n: 1 }, receipts: { n: 1 } });
    recover();
    expect(saveNote(store, token, update)).toMatchObject({
      body: 'Updated',
      revision: 2,
    });
  });
  it('retains committed notes and uncertain-save receipts after closing/reopening the file database and logging in again', async () => {
    const before = snapshot(store, token);
    const payload = input('Durable ćirilica Ћирилица\nsecond line');
    const confirmed = saveNote(store, token, payload);
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    token = (await login(store, { email: 'first@example.test', password }))
      .token;
    expect(readNote(store, token, day)).toEqual(confirmed);
    expect(saveNote(store, token, payload)).toEqual(confirmed);
    expect(snapshot(store, token)).toEqual(before);
    expect(store.native.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(store.native.pragma('foreign_key_check')).toEqual([]);
  });
  it('accepts the exact text limit and rejects oversized, forged, missing and malformed input without any writes', () => {
    const payload = input('Ж'.repeat(20000));
    expect(saveNote(store, token, payload).body).toBe(payload.body);
    const before = counters();
    for (const change of [
      { body: 'x'.repeat(20001) },
      { body: null },
      { body: 1 },
      { expectedRevision: -1 },
      { expectedRevision: 1.5 },
      { mutationId: 'forged' },
      { expectedStudentId: undefined },
      { userId: studentId },
      { releaseId: 'another-release' },
      { itemId: '' },
    ])
      expect(() =>
        saveNote(store, token, { ...input('', day, 1), ...change }),
      ).toThrow();
    expect(counters()).toEqual(before);
    expect(noteSubmissionSchema.safeParse(null).success).toBe(false);
  });
});

describe('note HTTP boundary with real authentication/database/services', () => {
  it('returns inaccessible-item 404 and rejects an account-switched form without revealing or altering notes', async () => {
    const first = saveNote(store, token, input('First account private text'));
    const secondToken = await account('second-http');
    startCourse(store, secondToken);
    const wrongAccount = await PUT(
      request('PUT', input('Wrong account'), {}, secondToken),
      context(),
    );
    expect(wrongAccount.status).toBe(403);
    expect((await wrongAccount.json()).error.code).toBe('ACCOUNT_CHANGED');
    const secondRead = await GET(
      request('GET', undefined, {}, secondToken),
      context(),
    );
    expect((await secondRead.json()).data).toMatchObject({
      body: '',
      revision: 0,
    });
    const guardedRequest = request('GET', undefined, {}, secondToken);
    const guardedRead = await GET(
      new NextRequest(
        guardedRequest.url +
          '?expectedStudentId=' +
          encodeURIComponent(studentId),
        { headers: guardedRequest.headers },
      ),
      context(),
    );
    expect(guardedRead.status).toBe(403);
    expect(await guardedRead.text()).not.toContain(first.body);
    expect(() => readNote(store, secondToken, day, studentId)).toThrow(
      expect.objectContaining({ code: 'ACCOUNT_CHANGED' }),
    );
    const missingContext = {
      params: Promise.resolve({ itemId: 'se-26w-v1:missing' }),
    };
    const missing = await GET(request('GET'), missingContext);
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain(first.body);
    expect(readNote(store, token, day)).toEqual(first);
  });
  it('returns a safe 503 on storage failure, preserves confirmed state and permits an exact retry', async () => {
    const payload = input('Unconfirmed private draft');
    store.native.exec(
      "CREATE TRIGGER fail_note_http BEFORE INSERT ON mutation_receipt BEGIN SELECT RAISE(ABORT, 'SQL password_hash private draft'); END;",
    );
    const failed = await PUT(request('PUT', payload), context());
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toMatch(/SQL|password_hash|private draft/);
    expect(readNote(store, token, day).revision).toBe(0);
    expect(counters()).toEqual({ notes: { n: 0 }, receipts: { n: 0 } });
    store.native.exec('DROP TRIGGER fail_note_http');
    const saved = await PUT(request('PUT', payload), context());
    expect(saved.status).toBe(200);
    expect((await saved.json()).data).toMatchObject({
      body: payload.body,
      revision: 1,
    });
  });
  it('returns a private no-store envelope; stale-tab conflict returns only this account’s latest note', async () => {
    const empty = await GET(request('GET'), context());
    expect(empty.status).toBe(200);
    expect(empty.headers.get('cache-control')).toBe('no-store');
    expect(await empty.json()).toMatchObject({
      revision: 0,
      data: { body: '', revision: 0 },
    });
    const payload = input('<b>plain text</b>');
    const saved = await PUT(request('PUT', payload), context());
    expect(saved.status).toBe(200);
    const confirmed = await saved.json();
    expect(confirmed).toMatchObject({
      revision: 1,
      data: { body: payload.body, revision: 1 },
    });
    const conflict = await PUT(request('PUT', input('stale')), context());
    expect(conflict.status).toBe(409);
    expect(conflict.headers.get('cache-control')).toBe('no-store');
    expect(await conflict.json()).toMatchObject({
      error: {
        code: 'REVISION_CONFLICT',
        revision: 1,
        currentState: confirmed.data,
      },
    });
    expect(
      await (await PUT(request('PUT', payload), context())).json(),
    ).toEqual(confirmed);
    expect(await (await GET(request('GET'), context())).json()).toEqual(
      confirmed,
    );
  });
  it.each(['Ж'.repeat(20000), '😀'.repeat(10000), '\u0000'.repeat(20000)])(
    'allows a full-size Unicode/JSON-escaped note through the scoped HTTP byte bound',
    async (body) => {
      const response = await PUT(request('PUT', input(body)), context());
      expect(response.status).toBe(200);
      expect((await response.json()).data.body).toBe(body);
    },
  );
  it('rejects bad origins, CSRF, malformed/oversized bodies, route mismatches and unauthenticated requests without writes', async () => {
    const checks: [NextRequest, number, string][] = [
      [
        request('PUT', input(), { origin: 'https://attacker.test' }),
        403,
        'ORIGIN_REJECTED',
      ],
      [
        request('PUT', input(), { 'x-csrf-token': 'forged' }),
        403,
        'CSRF_REJECTED',
      ],
      [request('PUT', '{'), 400, 'INVALID_BODY'],
      [request('PUT', 'x'.repeat(131073)), 400, 'BODY_TOO_LARGE'],
      [
        request('PUT', input(), { 'content-type': 'text/plain' }),
        400,
        'INVALID_BODY',
      ],
      [request('PUT', input('', lesson)), 400, 'INVALID_ACTION'],
      [request('PUT', input('x'.repeat(20001))), 400, 'VALIDATION_FAILED'],
    ];
    // Explicitly remove the session cookie while keeping a correctly signed anonymous CSRF token.
    const anonymous = createCsrf(secret, undefined);
    checks.push([
      request('PUT', input(), {
        cookie: 'learning_csrf=' + anonymous,
        'x-csrf-token': anonymous,
      }),
      401,
      'AUTH_REQUIRED',
    ]);
    for (const [req, status, code] of checks) {
      const response = await PUT(req, context());
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect((await response.json()).error.code).toBe(code);
    }
    const denied = await GET(
      request('GET', undefined, { cookie: '' }),
      context(),
    );
    expect(denied.status).toBe(401);
    expect(counters()).toEqual({ notes: { n: 0 }, receipts: { n: 0 } });
  });
});
