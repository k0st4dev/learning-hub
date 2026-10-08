import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import {
  register,
  login,
  logout,
  requireStudent,
} from '../../src/server/auth/service';
import { startCourse, mutateLearning } from '../../src/server/learning/mutate';
import { snapshot } from '../../src/server/learning/read';
import { saveNote } from '../../src/server/learning/notes';
import { GET } from '../../src/app/api/resources/route';
import { resourceProviderKey } from '../../src/domain/resource-library';
import {
  readResourceLibrary,
  type ResourceLibrary,
} from '../../src/server/content/resource-library';
import * as contentRead from '../../src/server/content/read';

vi.mock('../../src/server/db/current', () => ({ getStore: () => store }));
const root = process.cwd();
const origin = 'http://127.0.0.1:3000';
const password = 'Local resource route integration password';
let directory: string;
let store: Store;
let token: string;
let other: string;
let unenrolled: string;
let expired: string;
let revoked: string;
let plan: Awaited<ReturnType<typeof loadArchivedCurriculum>>;
async function account(email: string) {
  const input = { email, password };
  await register(store, { ...input, confirmation: password });
  return (await login(store, input)).token;
}
beforeAll(async () => {
  plan = await loadArchivedCurriculum(root);
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/resource-route-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  importCurriculum(store, plan.source);
  token = await account('resource-route-first@example.test');
  other = await account('resource-route-second@example.test');
  unenrolled = await account('resource-route-unenrolled@example.test');
  for (const session of [token, other]) {
    startCourse(store, session);
    saveNote(store, session, {
      itemId: 'se-26w-v1:d001-learn',
      body:
        session === token
          ? 'firstprivateresourcesentinel'
          : 'secondprivateresourcesentinel',
      mutationId: randomUUID(),
      expectedRevision: 0,
      expectedStudentId: requireStudent(store, session).id,
    });
  }
  mutateLearning(store, token, {
    kind: 'lesson',
    itemId: 'se-26w-v1:d001-learn',
    completed: true,
    mutationId: randomUUID(),
    expectedRevision: snapshot(store, token)!.revision,
  });
  expired = (
    await login(
      store,
      { email: 'resource-route-first@example.test', password },
      Date.now() - 31 * 86400000,
    )
  ).token;
  revoked = (
    await login(store, { email: 'resource-route-first@example.test', password })
  ).token;
  logout(store, revoked);
  vi.stubEnv('APP_DATA_DIR', directory);
  vi.stubEnv('APP_ORIGIN', origin);
  vi.stubEnv('PORT', '3000');
});
afterAll(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('resource-route-test-')
  )
    throw new Error('Unexpected resource route test path');
  await rm(directory, { recursive: true, force: true });
});
function request(
  query = '',
  session = token,
  headers: Record<string, string> = {},
) {
  return new NextRequest(origin + '/api/resources?' + query, {
    headers: {
      host: '127.0.0.1:3000',
      ...(session ? { cookie: 'learning_session=' + session } : {}),
      ...headers,
    },
  });
}
async function read(
  query = '',
  session = token,
  headers: Record<string, string> = {},
) {
  const response = await GET(request(query, session, headers));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json();
  expect(body.error).toBeUndefined();
  return body.data as ResourceLibrary;
}
function fingerprint() {
  const tables = [
    'app_user',
    'enrollment',
    'user_progress',
    'exercise_progress',
    'task_progress',
    'preparation_progress',
    'note',
    'scorecard',
    'activity_event',
    'mutation_receipt',
    'course_release',
    'content_item',
    'source_block',
    'source_mapping',
    'resource',
    'resource_use',
    'exercise_task',
  ];
  return createHash('sha256')
    .update(
      JSON.stringify(
        tables.map((table) =>
          store.native
            .prepare('SELECT * FROM ' + table + ' ORDER BY rowid')
            .all(),
        ),
      ),
    )
    .digest('hex');
}
describe('protected resource library route with real SQLite', () => {
  it('returns the complete paginated original inventory with effective labels and source evidence', async () => {
    const before = fingerprint();
    const all: ResourceLibrary['results'] = [];
    for (const page of [1, 2, 3]) {
      const result = await read('page=' + page);
      expect(result).toEqual(readResourceLibrary(store, token, { page }));
      expect(result.results).toHaveLength(page === 3 ? 19 : 25);
      expect(result.metadataInterpretation.origin).toBe(
        'added-product-interpretation',
      );
      expect(result.metadataCoverage).toEqual({
        typesObserved: ['reference'],
        requirementsObserved: ['reference'],
      });
      all.push(...result.results);
    }
    expect(all).toHaveLength(69);
    expect(new Set(all.map((row) => row.id)).size).toBe(69);
    expect(all.filter((row) => row.originalUrl === null)).toHaveLength(57);
    for (const original of plan.resources)
      expect(all.find((row) => row.id === original.id)).toMatchObject(original);
    const uses = all.flatMap((row) => row.uses);
    expect(uses).toHaveLength(290);
    expect(uses.filter((row) => row.id.includes(':hyperlink:'))).toHaveLength(
      19,
    );
    for (const original of plan.uses)
      expect(uses.find((row) => row.id === original.id)).toMatchObject(
        original,
      );
    expect((await read('page=10000')).results).toEqual([]);
    expect(fingerprint()).toBe(before);
  });
  it('combines effective provider/type and contextual filters with same-use AND and within-filter OR', async () => {
    const query = new URLSearchParams({
      source: resourceProviderKey('MDN'),
      type: 'documentation',
    });
    expect(
      (await read(query.toString())).results.map((row) => row.stableKey),
    ).toEqual(['res-07']);
    const cases: [string, string[]][] = [
      ['day=d113&requirement=optional', ['res-02']],
      ['day=d113&requirement=required', ['res-03']],
      [
        'day=d113&requirement=required&requirement=optional',
        ['res-02', 'res-03'],
      ],
      ['day=d025&requirement=conditional', ['res-02']],
      ['day=d025&requirement=required', []],
      ['day=d127&requirement=required', ['res-03']],
      ['day=d127&requirement=reference', ['res-12']],
      ['day=d146&requirement=conditional', ['res-05', 'res-09']],
      ['day=d182&requirement=required', []],
      ['day=d001&week=w26', []],
      ['type=video', []],
      ['day=unknown', []],
    ];
    for (const [q, expected] of cases)
      expect(
        (await read(q)).results.map((row) => row.stableKey).sort(),
        q,
      ).toEqual(expected);
    const unknown = await read(
      'source=provider-unspecified&day=d132&requirement=required',
    );
    expect(unknown.results[0]!.effective.provider).toBeNull();
    expect(unknown.results[0]!.originalUrl).toBeNull();
    expect(
      unknown.results[0]!.uses[0]!.interpretation.caveats.length,
    ).toBeGreaterThan(0);
    const filtered = await read('day=d113&requirement=optional');
    const resource = filtered.results[0]!;
    expect(resource.uses.length).toBeGreaterThan(
      resource.matchingUseIds.length,
    );
    expect(
      resource.uses
        .filter((use) => resource.matchingUseIds.includes(use.id))
        .every(
          (use) =>
            use.day === 'd113' && use.effective.requirementMode === 'optional',
        ),
    ).toBe(true);
  });
  it('preserves literal normalized text search and all scope choices', async () => {
    const first = await read('q=vezbe');
    const accented = await read('q=ve%C5%BEbe');
    expect(first.results).toEqual(accented.results);
    expect(first.total).toBe(accented.total);
    expect(accented.query.q).toBe('vežbe');
    expect(first).toEqual(readResourceLibrary(store, token, { q: 'vezbe' }));
    expect((await read('q=%25notPresent')).total).toBe(0);
    expect((await read('q=a_z')).total).toBe(0);
    const options = (await read()).options;
    expect(options.module).toHaveLength(6);
    expect(options.week).toHaveLength(26);
    expect(options.day).toHaveLength(182);
    expect(options.source).toContainEqual({
      value: resourceProviderKey(null),
      label: 'Provider not specified in manual',
    });
  });
  it('rejects malformed/scalar duplicate/foreign/oversized queries with private no-store errors', async () => {
    const before = fingerprint();
    for (const query of [
      'q=' + 'a'.repeat(101),
      'q=a&q=b',
      'q=a+b+c+d+e+f+g+h+i',
      'page=0',
      'page=10001',
      'page=1&page=2',
      'page=1.5',
      'page=NaN',
      'type=password',
      'requirement=complete',
      'source=' + 's'.repeat(201),
      'source=',
      Array(17).fill('source=x').join('&'),
      Array(9).fill('type=guide').join('&'),
      Array(9).fill('day=d001').join('&'),
      Array(5).fill('requirement=required').join('&'),
      'releaseId=another-release',
      'userId=other',
      'expectedStudentId=other',
      '__proto__=x',
      'unknown=x',
    ]) {
      const response = await GET(request(query));
      expect(response.status, query).toBe(400);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.requestId).toBeTruthy();
      expect(body.data).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain(
        'firstprivateresourcesentinel',
      );
    }
    expect(fingerprint()).toBe(before);
  });
  it('requires a valid enrolled account and local request origin without selecting a supplied owner', async () => {
    const before = fingerprint();
    for (const [session, code, status] of [
      ['', 'AUTH_REQUIRED', 401],
      ['invalid-session', 'AUTH_REQUIRED', 401],
      [expired, 'AUTH_REQUIRED', 401],
      [revoked, 'AUTH_REQUIRED', 401],
      [unenrolled, 'ENROLLMENT_REQUIRED', 404],
    ] as const) {
      const response = await GET(request('', session));
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect((await response.json()).error.code).toBe(code);
    }
    const rejectedHeaders: Record<string, string>[] = [
      { host: 'evil.example' },
      { origin: 'https://evil.example' },
      { 'x-expected-student': requireStudent(store, other).id },
      { 'x-expected-student': '' },
    ];
    for (const headers of rejectedHeaders) {
      const response = await GET(request('', token, headers));
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.json();
      expect(body.data).toBeUndefined();
      expect(body.error.code).toBe(
        'x-expected-student' in headers ? 'ACCOUNT_CHANGED' : 'ORIGIN_REJECTED',
      );
    }
    expect(
      await read('', token, {
        'x-expected-student': requireStudent(store, token).id,
      }),
    ).toEqual(await read());
    expect(fingerprint()).toBe(before);
  });
  it('never includes private records and leaves distinct two-user progress, notes and receipts unchanged', async () => {
    const before = fingerprint();
    expect(
      snapshot(store, token)!.units.filter((unit) => unit.complete),
    ).toHaveLength(1);
    expect(
      snapshot(store, other)!.units.filter((unit) => unit.complete),
    ).toHaveLength(0);
    for (const session of [token, other]) {
      for (const q of [
        'firstprivateresourcesentinel',
        'secondprivateresourcesentinel',
      ])
        expect((await read('q=' + q, session)).total).toBe(0);
      const serialized = JSON.stringify(await read('day=d001', session));
      expect(serialized).not.toContain('privateresourcesentinel');
      expect(serialized).not.toContain(requireStudent(store, token).id);
      expect(serialized).not.toContain(requireStudent(store, other).id);
    }
    expect(await read('day=d001', token)).toEqual(
      await read('day=d001', other),
    );
    expect(fingerprint()).toBe(before);
  });
  it('returns explicit unavailable labels without partial data when the content binding drifts', async () => {
    const before = fingerprint();
    // Inject one invalid read snapshot, never rewrite a published release/database row.
    const catalog = contentRead.readCatalog(store, 'se-26w-v1')!;
    const invalid = structuredClone(catalog);
    invalid.release.manifestSha256 = '0'.repeat(64);
    const spy = vi
      .spyOn(contentRead, 'readCatalog')
      .mockReturnValueOnce(invalid);
    try {
      const response = await GET(request());
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.json();
      expect(body.error.code).toBe('RESOURCE_LABELS_UNAVAILABLE');
      expect(body.data).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
    expect((await read()).total).toBe(69);
    expect(fingerprint()).toBe(before);
  });
  it('survives database restart and reports failure without losing existing progress', async () => {
    const before = fingerprint();
    const expected = await read('day=d113&requirement=optional');
    store.native.close();
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toBeUndefined();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(await read('day=d113&requirement=optional')).toEqual(expected);
    expect(fingerprint()).toBe(before);
  });
});
