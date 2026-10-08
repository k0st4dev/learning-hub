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
import { scorecardReviewMilestones } from '../../src/domain/scorecard-review';
import { snapshot, continuePath } from '../../src/server/learning/read';
import {
  readScorecard,
  saveScorecard,
} from '../../src/server/learning/scorecards';
import { saveNote } from '../../src/server/learning/notes';
import { GET, PUT } from '../../src/app/api/scorecards/[periodKey]/route';
import { GET as CURRENT } from '../../src/app/api/scorecards/route';

vi.mock('../../src/server/db/current', () => ({ getStore: () => store }));
const root = process.cwd();
const origin = 'http://127.0.0.1:3000';
const password = 'Private scorecard integration password';
const periodKey = '2026-10';
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
  directory = await mkdtemp(path.join(root, '.tmp/scorecards-test-'));
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
    !path.basename(directory).startsWith('scorecards-test-')
  )
    throw new Error('Unexpected scorecard test directory');
  await rm(directory, { recursive: true, force: true });
});
async function account(name: string) {
  const email = name + '@example.test';
  await register(store, { email, password, confirmation: password });
  return (await login(store, { email, password })).token;
}
function input(expectedRevision = 0) {
  return {
    periodKey,
    expectedStudentId: studentId,
    expectedRevision,
    mutationId: randomUUID(),
    ratings: { [plan.source.scorecard.dimensions[0]!]: 0 },
    evidence: {
      [plan.source.scorecard.dimensions[0]!]:
        '  čćžšđ Ћирилица 😀\n<script>plain text</script>  ',
    },
  };
}
function counters() {
  return {
    cards: store.native.prepare('SELECT count(*) AS n FROM scorecard').get(),
    receipts: store.native
      .prepare('SELECT count(*) AS n FROM mutation_receipt')
      .get(),
  };
}
function request(
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
  session: string | undefined = token,
  route = '/api/scorecards/' + periodKey,
) {
  const csrf = createCsrf(secret, session);
  return new NextRequest(origin + route, {
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
const ctx = () => ({ params: Promise.resolve({ periodKey }) });
describe('owned monthly scorecards', () => {
  it('offers an owned week review while repeated reads preserve the existing month and learning records', async () => {
    const confirmed = saveScorecard(store, token, input());
    const secondToken = await account('review-other');
    startCourse(store, secondToken);
    const otherBefore = snapshot(store, secondToken);
    for (const day of plan.source.days.filter(
      (d) => d.number >= 22 && d.number <= 28,
    )) {
      mutateLearning(store, token, {
        kind: 'lesson',
        itemId: 'se-26w-v1:' + day.lesson_id,
        completed: true,
        mutationId: randomUUID(),
        expectedRevision: snapshot(store, token)!.revision,
      });
      mutateLearning(store, token, {
        kind: 'exercise',
        itemId: 'se-26w-v1:' + day.exercise_id,
        completed: true,
        mutationId: randomUUID(),
        expectedRevision: snapshot(store, token)!.revision,
        submission: {
          tasks: day.tasks.map((task) => ({
            taskId: task.id,
            status: 'done',
            reason: '',
            choice: '',
          })),
          evidence: 'Synthetic week 4 review evidence',
          selectedScope: '',
          attested: true,
          result: 'passed',
        },
      });
    }
    const learning = snapshot(store, token)!;
    expect(learning).toMatchObject({ completed: 14, total: 364, percent: 3 });
    const before = counters();
    for (let visit = 0; visit < 2; visit++) {
      expect(scorecardReviewMilestones(snapshot(store, token)!)).toEqual([
        {
          key: 'week:4',
          label: 'Week 4',
          assessmentId: 'se-26w-v1:d028-practice',
        },
      ]);
      expect(readScorecard(store, token, periodKey)).toEqual(confirmed);
    }
    expect(snapshot(store, token)).toEqual(learning);
    expect(snapshot(store, secondToken)).toEqual(otherBefore);
    expect(scorecardReviewMilestones(snapshot(store, secondToken)!)).toEqual(
      [],
    );
    expect(readScorecard(store, secondToken, periodKey).revision).toBe(0);
    expect(counters()).toEqual(before);
  });
  it('reads without writes and preserves original definitions, absent ratings versus zero, all fourteen values and exact evidence', () => {
    const absent = readScorecard(store, token, periodKey);
    expect(absent).toEqual({
      periodKey,
      dimensions: plan.source.scorecard.dimensions,
      scale: plan.source.scorecard.scale,
      ratings: {},
      evidence: {},
      revision: 0,
      createdAt: null,
      updatedAt: null,
    });
    expect(counters()).toEqual({ cards: { n: 0 }, receipts: { n: 0 } });
    const first = saveScorecard(store, token, input());
    expect(first.ratings).toEqual(input().ratings);
    expect(first.evidence).toEqual(input().evidence);
    const full = {
      ...input(1),
      ratings: Object.fromEntries(
        plan.source.scorecard.dimensions.map((key, i) => [key, i % 4]),
      ),
    };
    const second = saveScorecard(store, token, full);
    expect(Object.keys(second.ratings)).toEqual(
      plan.source.scorecard.dimensions,
    );
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt!).toBeGreaterThanOrEqual(first.updatedAt!);
    const cleared = saveScorecard(store, token, {
      ...input(2),
      ratings: {},
      evidence: {},
    });
    expect(cleared).toMatchObject({ ratings: {}, evidence: {}, revision: 3 });
    expect(readScorecard(store, token, periodKey)).toEqual(cleared);
  });
  it('uses the owner timezone at boundaries and separates periods and learning/cursor/activity/preparation', () => {
    const learning = snapshot(store, token);
    const pathBefore = continuePath(learning);
    const activity = store.native.prepare('SELECT * FROM activity_event').all();
    store.native
      .prepare('UPDATE app_user SET timezone=? WHERE id=?')
      .run('America/Los_Angeles', studentId);
    expect(
      readScorecard(
        store,
        token,
        undefined,
        studentId,
        Date.parse('2026-10-01T00:30:00Z'),
      ).periodKey,
    ).toBe('2026-09');
    saveScorecard(store, token, input());
    const september = saveScorecard(store, token, {
      ...input(),
      periodKey: '2026-09',
      ratings: {},
    });
    expect(readScorecard(store, token, '2026-09')).toEqual(september);
    expect(readScorecard(store, token, '2026-11').revision).toBe(0);
    expect(snapshot(store, token)).toEqual({
      ...learning,
      timezone: 'America/Los_Angeles',
    });
    expect(continuePath(snapshot(store, token))).toBe(pathBefore);
    expect(store.native.prepare('SELECT * FROM activity_event').all()).toEqual(
      activity,
    );
    store.native
      .prepare('UPDATE app_user SET timezone=? WHERE id=?')
      .run('Invalid/Zone', studentId);
    expect(() => readScorecard(store, token)).toThrow(
      expect.objectContaining({ status: 503 }),
    );
  });
  it('keeps two accounts separate and rejects switched forms/guarded reads before exposing another record', async () => {
    const first = saveScorecard(store, token, input());
    const secondToken = await account('second');
    const secondId = requireStudent(store, secondToken).id;
    startCourse(store, secondToken);
    expect(readScorecard(store, secondToken, periodKey).ratings).toEqual({});
    expect(() => saveScorecard(store, secondToken, input())).toThrow(
      expect.objectContaining({ code: 'ACCOUNT_CHANGED' }),
    );
    expect(() =>
      readScorecard(store, secondToken, periodKey, studentId),
    ).toThrow(expect.objectContaining({ code: 'ACCOUNT_CHANGED' }));
    const second = saveScorecard(store, secondToken, {
      ...input(),
      expectedStudentId: secondId,
      ratings: {},
    });
    expect(readScorecard(store, token, periodKey)).toEqual(first);
    expect(readScorecard(store, secondToken, periodKey)).toEqual(second);
    const failure = await GET(
      request(
        'GET',
        undefined,
        {},
        secondToken,
        '/api/scorecards/' + periodKey + '?expectedStudentId=' + studentId,
      ),
      ctx(),
    );
    expect(failure.status).toBe(403);
    expect(await failure.text()).not.toContain(
      first.evidence[plan.source.scorecard.dimensions[0]!]!,
    );
  });
  it('requires a live session for read/write/replay, including revocation and expiry', async () => {
    const payload = input();
    saveScorecard(store, token, payload);
    for (const bad of [undefined, 'forged']) {
      expect(() => readScorecard(store, bad, periodKey)).toThrow(
        expect.objectContaining({ status: 401 }),
      );
      expect(() => saveScorecard(store, bad, payload)).toThrow(
        expect.objectContaining({ status: 401 }),
      );
    }
    logout(store, token);
    expect(() => saveScorecard(store, token, payload)).toThrow(
      expect.objectContaining({ status: 401 }),
    );
    token = (await login(store, { email: 'first@example.test', password }))
      .token;
    store.native
      .prepare('UPDATE session SET created_at=0, last_seen_at=0, expires_at=1')
      .run();
    expect(() => readScorecard(store, token, periodKey)).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });
  it('replays exact receipts after newer changes, canonicalizes key order, and rejects stale or reused identifiers', () => {
    const payload = {
      ...input(),
      ratings: Object.fromEntries(
        plan.source.scorecard.dimensions.map((key, i) => [key, i % 4]),
      ),
    };
    const first = saveScorecard(store, token, payload);
    expect(
      saveScorecard(store, token, {
        ...payload,
        ratings: Object.fromEntries(Object.entries(payload.ratings).reverse()),
      }),
    ).toEqual(first);
    const newer = saveScorecard(store, token, input(1));
    expect(saveScorecard(store, token, payload)).toEqual(first);
    expect(readScorecard(store, token, periodKey)).toEqual(newer);
    for (const change of [
      { periodKey: '2026-09' },
      { evidence: {} },
      { expectedRevision: 2 },
    ])
      expect(() =>
        saveScorecard(store, token, { ...payload, ...change }),
      ).toThrow(expect.objectContaining({ code: 'MUTATION_REUSED' }));
    expect(() => saveScorecard(store, token, input(1))).toThrow(
      expect.objectContaining({
        code: 'REVISION_CONFLICT',
        details: { revision: 2, currentState: newer },
      }),
    );
  });
  it('keeps note receipt namespace distinct in both directions', () => {
    const card = input();
    saveScorecard(store, token, card);
    const note = {
      mutationId: card.mutationId,
      itemId: 'se-26w-v1:d001',
      expectedRevision: 0,
      expectedStudentId: studentId,
      body: 'note',
    };
    expect(() => saveNote(store, token, note)).toThrow(
      expect.objectContaining({ code: 'MUTATION_REUSED' }),
    );
    note.mutationId = randomUUID();
    saveNote(store, token, note);
    expect(() =>
      saveScorecard(store, token, { ...input(1), mutationId: note.mutationId }),
    ).toThrow(expect.objectContaining({ code: 'MUTATION_REUSED' }));
  });
  it('rolls back new and edited cards if receipts fail; exact retry remains safe', () => {
    const fail = () =>
      store.native.exec(
        "CREATE TRIGGER fail_scorecard BEFORE INSERT ON mutation_receipt BEGIN SELECT RAISE(ABORT,'private SQL failure'); END;",
      );
    const recover = () => store.native.exec('DROP TRIGGER fail_scorecard');
    const payload = input();
    fail();
    expect(() => saveScorecard(store, token, payload)).toThrow();
    expect(counters()).toEqual({ cards: { n: 0 }, receipts: { n: 0 } });
    recover();
    const saved = saveScorecard(store, token, payload);
    fail();
    expect(() => saveScorecard(store, token, input(1))).toThrow();
    expect(readScorecard(store, token, periodKey)).toEqual(saved);
    recover();
    expect(saveScorecard(store, token, input(1)).revision).toBe(2);
  });
  it('preserves records and exact acknowledgments after reopening the database and fresh login', async () => {
    const payload = input();
    const saved = saveScorecard(store, token, payload);
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    token = (await login(store, { email: 'first@example.test', password }))
      .token;
    expect(readScorecard(store, token, periodKey)).toEqual(saved);
    expect(saveScorecard(store, token, payload)).toEqual(saved);
    expect(store.native.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(store.native.pragma('foreign_key_check')).toEqual([]);
  });
  it('rejects forged/invalid scores, unknown dimensions and oversized evidence without writes', () => {
    for (const rating of [-1, 4, 1.5, '1', null]) {
      expect(() =>
        saveScorecard(store, token, { ...input(), ratings: { Git: rating } }),
      ).toThrow();
    }
    for (const change of [
      { ratings: { foreign: 0 } },
      { evidence: { foreign: 'text' } },
      { evidence: { Git: 'x'.repeat(2001) } },
      { periodKey: '2026-13' },
      { userId: studentId },
      { releaseId: 'forged' },
      { expectedStudentId: undefined },
      { expectedRevision: -1 },
      { expectedRevision: 1.5 },
      { mutationId: 'forged' },
    ])
      expect(() =>
        saveScorecard(store, token, { ...input(), ...change }),
      ).toThrow();
    expect(counters()).toEqual({ cards: { n: 0 }, receipts: { n: 0 } });
  });
  it('reads only the pinned definition and fails safely if that definition is unavailable', async () => {
    store.native
      .exec(`INSERT INTO course_release (id,course_id,version,status,source_filename,source_sha256,manifest_sha256,created_at,published_at)
      SELECT 'newer',course_id,'synthetic-newer','published',source_filename,source_sha256,manifest_sha256,created_at,9999999999999 FROM course_release WHERE id='se-26w-v1';`);
    expect(readScorecard(store, token, periodKey).dimensions).toEqual(
      plan.source.scorecard.dimensions,
    );
    store.native
      .prepare(
        "UPDATE content_item SET metadata_json='{}' WHERE stable_key='scorecard-definition' AND release_id='se-26w-v1'",
      )
      .run();
    expect(() => saveScorecard(store, token, input())).toThrow(
      expect.objectContaining({ status: 503, code: 'SCORECARD_UNAVAILABLE' }),
    );
    const unEnrolled = await account('no-course');
    expect(() => readScorecard(store, unEnrolled, periodKey)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });
});
describe('scorecard request boundary', () => {
  it('returns the current month read-only and writes/reads/replays the selected month', async () => {
    const response = await CURRENT(
      request('GET', undefined, {}, token, '/api/scorecards'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data.revision).toBe(0);
    expect(counters()).toEqual({ cards: { n: 0 }, receipts: { n: 0 } });
    const payload = input();
    const saved = await PUT(request('PUT', payload), ctx());
    expect(saved.status).toBe(200);
    const result = await saved.json();
    expect((await (await GET(request(), ctx())).json()).data).toEqual(
      result.data,
    );
    expect(
      (await (await PUT(request('PUT', payload), ctx())).json()).data,
    ).toEqual(result.data);
    const conflict = await PUT(request('PUT', input()), ctx());
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.currentState).toEqual(result.data);
  });
  it('rejects CSRF/Origin/Host/missing auth, malformed JSON, path mismatch and oversized bodies', async () => {
    const rejectedHeaders: Record<string, string>[] = [
      { 'x-csrf-token': 'forged' },
      { origin: 'https://foreign.test' },
      { host: 'foreign.test' },
    ];
    for (const headers of rejectedHeaders) {
      const response = await PUT(request('PUT', input(), headers), ctx());
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect(
      (await GET(request('GET', undefined, {}, 'forged'), ctx())).status,
    ).toBe(401);
    expect((await PUT(request('PUT', '{'), ctx())).status).toBe(400);
    expect(
      (await PUT(request('PUT', { ...input(), periodKey: '2026-09' }), ctx()))
        .status,
    ).toBe(400);
    expect((await PUT(request('PUT', 'x'.repeat(262145)), ctx())).status).toBe(
      400,
    );
    expect(counters()).toEqual({ cards: { n: 0 }, receipts: { n: 0 } });
  });
  it('accepts all fourteen maximum JSON-escaped evidence fields, then reports safe atomic storage failure', async () => {
    const payload = {
      ...input(),
      evidence: Object.fromEntries(
        plan.source.scorecard.dimensions.map((key) => [
          key,
          '\u0000'.repeat(2000),
        ]),
      ),
    };
    expect((await PUT(request('PUT', payload), ctx())).status).toBe(200);
    const before = readScorecard(store, token, periodKey);
    store.native.exec(
      "CREATE TRIGGER fail_http_scorecard BEFORE INSERT ON mutation_receipt BEGIN SELECT RAISE(ABORT,'private SQL password'); END;",
    );
    const response = await PUT(request('PUT', input(1)), ctx());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private SQL');
    expect(readScorecard(store, token, periodKey)).toEqual(before);
  });
});
