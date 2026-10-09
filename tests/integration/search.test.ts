import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import { searchCurriculum } from '../../src/server/content/search';
import { searchPageContext } from '../../src/server/content/search-page';
import { register, login, requireStudent } from '../../src/server/auth/service';
import { startCourse } from '../../src/server/learning/mutate';
import { snapshot } from '../../src/server/learning/read';
import { GET } from '../../src/app/api/search/route';
import { normalizeSearch } from '../../src/domain/search';
import { saveNote } from '../../src/server/learning/notes';
import { randomUUID } from 'node:crypto';

vi.mock('../../src/server/db/current', () => ({ getStore: () => store }));
const root = process.cwd();
const origin = 'http://127.0.0.1:3000';
let directory: string;
let store: Store;
let token: string;
let other: string;
let plan: Awaited<ReturnType<typeof loadArchivedCurriculum>>;
beforeAll(async () => {
  plan = await loadArchivedCurriculum(root);
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/search-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  importCurriculum(store, plan.source);
  async function account(email: string) {
    const credentials = {
      email,
      password: 'Local curriculum search test password',
    };
    await register(store, {
      ...credentials,
      confirmation: credentials.password,
    });
    const session = (await login(store, credentials)).token;
    startCourse(store, session);
    return session;
  }
  token = await account('search-first@example.test');
  other = await account('search-second@example.test');
  vi.stubEnv('APP_DATA_DIR', directory);
  vi.stubEnv('APP_ORIGIN', origin);
  vi.stubEnv('PORT', '3000');
});
afterAll(async () => {
  vi.unstubAllEnvs();
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('search-test-')
  )
    throw new Error('Unexpected search test path');
  await rm(directory, { recursive: true, force: true });
});
function request(
  query: string,
  session: string | undefined = token,
  host = '127.0.0.1:3000',
) {
  return new NextRequest(origin + '/api/search?' + query, {
    headers: {
      host,
      ...(session ? { cookie: 'learning_session=' + session } : {}),
    },
  });
}
function fingerprint() {
  return JSON.stringify({
    first: snapshot(store, token),
    second: snapshot(store, other),
    notes: store.native
      .prepare('SELECT * FROM note ORDER BY enrollment_id,content_item_id')
      .all(),
    events: store.native.prepare('SELECT * FROM activity_event').all(),
    receipts: store.native.prepare('SELECT * FROM mutation_receipt').all(),
  });
}
describe('owned complete curriculum search', () => {
  it('provides owned source filter choices and only the actual saved recent reference without writes', () => {
    const context = searchPageContext(store, token)!;
    expect(context.options.module).toHaveLength(6);
    expect(context.options.week).toHaveLength(26);
    expect(context.options.day).toHaveLength(182);
    expect(context.recent).toEqual([]);
    const ownerId = requireStudent(store, token).id;
    store.native
      .prepare('UPDATE enrollment SET last_opened_item_id=? WHERE user_id=?')
      .run('se-26w-v1:d002-learn', ownerId);
    try {
      const before = fingerprint();
      expect(searchPageContext(store, token)!.recent).toEqual([
        {
          title: plan.source.days[1]!.title,
          href: '/course/software-engineer/days/d002/lessons/d002-learn',
        },
      ]);
      expect(searchPageContext(store, other)!.recent).toEqual([]);
      expect(fingerprint()).toBe(before);
    } finally {
      store.native
        .prepare(
          'UPDATE enrollment SET last_opened_item_id=NULL WHERE user_id=?',
        )
        .run(ownerId);
    }
  });
  it('rejects a stale search page account header without selecting that account', async () => {
    const before = fingerprint();
    const original = request('q=Git');
    original.headers.set('x-expected-student', requireStudent(store, other).id);
    const response = await GET(original);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('ACCOUNT_CHANGED');
    expect(fingerprint()).toBe(before);
  });
  it('indexes every curriculum item and all original/unresolved resources on import without altering reseed', () => {
    const count = store.native
      .prepare('SELECT count(*) AS n FROM temp.curriculum_search')
      .get() as { n: number };
    expect(count.n).toBe(plan.items.length + plan.resources.length);
    const indexedRows = new Map(
      (
        store.native
          .prepare(
            'SELECT id,title,body,href,normalized_text FROM temp.curriculum_search WHERE release_id=?',
          )
          .all(plan.releaseId) as {
          id: string;
          title: string;
          body: string;
          href: string;
          normalized_text: string;
        }[]
      ).map((row) => [row.id, row]),
    );
    for (const item of plan.items) {
      const row = indexedRows.get(item.id)!;
      expect(row.title).toBe(item.title);
      expect(row.href).toBe(JSON.parse(item.metadataJson!).route);
      if (item.bodyMarkdown) expect(row.body).toContain(item.bodyMarkdown);
    }
    const blocks = new Map(
      plan.blocks.map((block) => [block.id, block.exactText]),
    );
    for (const mapping of plan.mappings.filter(
      (mapping) => mapping.mappingKind !== 'metadata',
    ))
      expect(indexedRows.get(mapping.contentItemId)!.normalized_text).toContain(
        normalizeSearch(blocks.get(mapping.sourceBlockId)!),
      );
    for (const resource of plan.resources) {
      const row = indexedRows.get(resource.id)!;
      expect(row.title).toBe(resource.title);
      if (resource.originalUrl)
        expect(row.body).toContain(resource.originalUrl);
    }
    const before = fingerprint();
    expect(importCurriculum(store, plan.source).imported).toBe(false);
    expect(fingerprint()).toBe(before);
    expect(
      store.native
        .prepare(
          "SELECT name FROM main.sqlite_master WHERE name = 'curriculum_search'",
        )
        .get(),
    ).toBeUndefined();
  });
  it('finds original title, study, exercise/task, week topic, guide and resource text', () => {
    const cases = [
      { kind: 'day', q: plan.source.days[0]!.title },
      { kind: 'lesson', q: 'Pročitaj' },
      { kind: 'exercise', q: 'repo' },
      { kind: 'task', q: 'repo' },
      { kind: 'week', q: plan.source.weeks[0]!.title },
      { kind: 'guide', q: 'Git' },
      { kind: 'resource', q: 'MDN' },
    ];
    for (const item of cases) {
      const result = searchCurriculum(store, token, {
        q: item.q,
        kind: [item.kind],
      });
      expect(result.total, JSON.stringify(item)).toBeGreaterThan(0);
      expect(result.results.every((row) => row.kind === item.kind)).toBe(true);
      expect(
        result.results.every(
          (row) => row.href.startsWith('/') && row.breadcrumbs.length,
        ),
      ).toBe(true);
    }
    expect(searchCurriculum(store, token, { q: 'pročitaj' })).toEqual(
      searchCurriculum(store, token, { q: 'pročitaj' }),
    );
    const original = searchCurriculum(store, token, { q: 'vežbe' });
    const folded = searchCurriculum(store, token, { q: 'vezbe' });
    expect(folded.total).toBe(original.total);
    expect(folded.results).toEqual(original.results);
  });
  it('treats wildcard, backslash and SQL payloads literally, requires every token', () => {
    expect(searchCurriculum(store, token, { q: "zzzz' OR 1=1 --" }).total).toBe(
      0,
    );
    expect(searchCurriculum(store, token, { q: '%' }).total).toBeLessThan(
      plan.items.length,
    );
    expect(searchCurriculum(store, token, { q: '_' }).total).toBeLessThan(
      plan.items.length,
    );
    expect(searchCurriculum(store, token, { q: '\\' }).total).toBeLessThan(
      plan.items.length,
    );
    expect(
      searchCurriculum(store, token, {
        q: 'JavaScript nonexistentUniqueNeedle',
      }).total,
    ).toBe(0);
  });
  it('ranks exact/prefix titles before title tokens and bodies with stable source ordering and pagination', () => {
    // Synthetic derived rows isolate all four ranking tiers without editing the published curriculum.
    const insert = store.native.prepare(
      'INSERT INTO temp.curriculum_search_bindings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const rows = [
      ['z-exact', 'rankingneedle', 9, 'rankingneedle', ''],
      ['b-prefix', 'rankingneedle advanced', 2, 'rankingneedle advanced', ''],
      ['a-title', 'advanced rankingneedle', 1, 'advanced rankingneedle', ''],
      ['c-body', 'Body title', 0, 'body title', 'rankingneedle'],
      ['d-body', 'Body title', 0, 'body title', 'rankingneedle'],
      ['e-body', 'Body title', 1, 'body title', 'rankingneedle'],
    ] as const;
    const originals = store.native
      .prepare(
        'SELECT * FROM temp.curriculum_search_bindings WHERE release_id=? AND kind=? ORDER BY id LIMIT ?',
      )
      .all(plan.releaseId, 'guide', rows.length) as Record<
      string,
      string | number
    >[];
    expect(originals).toHaveLength(rows.length);
    for (const row of originals)
      store.native
        .prepare(
          'DELETE FROM temp.curriculum_search_bindings WHERE release_id=? AND id=?',
        )
        .run(plan.releaseId, row.id!);
    for (const [id, title, order, normalized, body] of rows)
      insert.run(
        plan.releaseId,
        id,
        'guide',
        title,
        body,
        normalized,
        normalized + '\n' + body,
        '/course/software-engineer',
        order,
        '[]',
        '[]',
        '[]',
        '[]',
      );
    try {
      expect(
        searchCurriculum(store, token, { q: 'rankingneedle' }).results.map(
          (row) => row.id,
        ),
      ).toEqual([
        'z-exact',
        'b-prefix',
        'a-title',
        'c-body',
        'd-body',
        'e-body',
      ]);
    } finally {
      store.native
        .prepare(
          "DELETE FROM temp.curriculum_search_bindings WHERE id IN ('z-exact','b-prefix','a-title','c-body','d-body','e-body')",
        )
        .run();
      for (const row of originals) insert.run(...Object.values(row));
    }
    const first = searchCurriculum(store, token, { q: 'Git' });
    const next = searchCurriculum(store, token, { q: 'Git', page: 2 });
    expect(first.total).toBeGreaterThan(20);
    expect(first.results).toHaveLength(20);
    expect(next.results).toHaveLength(Math.min(20, first.total - 20));
    expect(
      new Set([...first.results, ...next.results].map((row) => row.id)).size,
    ).toBe(first.results.length + next.results.length);
    expect(searchCurriculum(store, token, { q: 'Git' })).toEqual(first);
    expect(
      searchCurriculum(store, token, { q: 'Git', page: 10000 }).results,
    ).toEqual([]);
  });
  it('rolls publication back if derived search preparation fails', async () => {
    const failedDirectory = path.join(directory, 'failed-index');
    await migrate(failedDirectory, root);
    const failedStore = openDatabase(
      path.join(failedDirectory, 'learning.sqlite'),
    );
    try {
      failedStore.native.exec(
        'CREATE TEMP TABLE curriculum_search(release_id TEXT)',
      );
      expect(() => importCurriculum(failedStore, plan.source)).toThrow();
      expect(
        failedStore.native
          .prepare('SELECT count(*) AS n FROM course_release')
          .get(),
      ).toEqual({ n: 0 });
      expect(
        failedStore.native
          .prepare('SELECT count(*) AS n FROM content_item')
          .get(),
      ).toEqual({ n: 0 });
      expect(failedStore.native.pragma('foreign_key_check')).toEqual([]);
    } finally {
      failedStore.native.close();
    }
  });
  it('recovers a connection-local index after an outer read transaction rolls back', () => {
    const connection = openDatabase(path.join(directory, 'learning.sqlite'));
    const expected = searchCurriculum(store, token, { q: 'Git' });
    try {
      expect(() =>
        connection.native.transaction(() => {
          searchCurriculum(connection, token, { q: 'Git' });
          throw new Error('Forced caller rollback');
        })(),
      ).toThrow('Forced caller rollback');
      expect(
        connection.native
          .prepare(
            "SELECT name FROM sqlite_temp_master WHERE name='curriculum_search_bindings'",
          )
          .get(),
      ).toBeUndefined();
      expect(searchCurriculum(connection, token, { q: 'Git' })).toEqual(
        expected,
      );
    } finally {
      connection.native.close();
    }
  });
  it('combines dimensions with AND and multiple values with OR, including resource context', () => {
    const first = plan.source.days[0]!;
    const second = plan.source.days[1]!;
    const one = searchCurriculum(store, token, { q: 'Git', day: [first.id] });
    const two = searchCurriculum(store, token, {
      q: 'Git',
      day: [first.id, second.id],
    });
    expect(one.total).toBeGreaterThan(0);
    expect(two.total).toBeGreaterThanOrEqual(one.total);
    expect(
      searchCurriculum(store, token, {
        q: 'Git',
        day: [first.id],
        week: ['w26'],
      }).total,
    ).toBe(0);
    expect(
      searchCurriculum(store, token, { q: 'Git', module: ['unknown'] }).total,
    ).toBe(0);
    const resource = searchCurriculum(store, token, {
      q: 'Git',
      kind: ['resource'],
      day: [first.id],
    });
    expect(resource.total).toBeGreaterThan(0);
  });
  it('returns guidance/empty results without searching private notes or changing either account', () => {
    saveNote(store, other, {
      itemId: 'se-26w-v1:d001-learn',
      body: 'privatenotesentinel',
      expectedRevision: 0,
      expectedStudentId: requireStudent(store, other).id,
      mutationId: randomUUID(),
    });
    const before = fingerprint();
    expect(searchCurriculum(store, token, {}).results).toEqual([]);
    expect(
      searchCurriculum(store, token, { q: 'privatenotesentinel' }).total,
    ).toBe(0);
    expect(
      searchCurriculum(store, other, { q: 'privatenotesentinel' }).total,
    ).toBe(0);
    searchCurriculum(store, token, { q: 'JavaScript', page: 2 });
    expect(fingerprint()).toBe(before);
  });
  it('never switches the enrolled release to a newer published release or searches unpublished content', async () => {
    store.native
      .prepare(
        `INSERT INTO course_release(id,course_id,version,status,source_filename,source_sha256,manifest_sha256,published_at,created_at)
      VALUES ('search-foreign','software-engineer','search-foreign','published','synthetic','hash','hash',?,?)`,
      )
      .run(Date.now() + 10000, Date.now());
    store.native
      .prepare(
        `INSERT INTO content_item(id,release_id,stable_key,kind,order_index,title,content_hash,metadata_json)
      VALUES ('search-foreign:guide','search-foreign','guide','guide',0,'foreignreleasesentinel','hash','{"route":"/course/software-engineer"}')`,
      )
      .run();
    expect(
      searchCurriculum(store, token, { q: 'foreignreleasesentinel' }).total,
    ).toBe(0);
    // A separate synthetic enrollment avoids attempting to move private records across release FKs.
    const credentials = {
      email: 'search-pinned@example.test',
      password: 'Separate pinned release search password',
    };
    await register(store, {
      ...credentials,
      confirmation: credentials.password,
    });
    const foreignToken = (await login(store, credentials)).token;
    const ownerId = requireStudent(store, foreignToken).id;
    store.native
      .prepare(
        `INSERT INTO enrollment(id,user_id,course_id,release_id,started_at)
      VALUES (?,?,'software-engineer','search-foreign',?)`,
      )
      .run(randomUUID(), ownerId, Date.now());
    expect(
      searchCurriculum(store, foreignToken, { q: 'foreignreleasesentinel' })
        .total,
    ).toBe(1);
    expect(
      searchCurriculum(store, token, { q: 'foreignreleasesentinel' }).total,
    ).toBe(0);
    store.native
      .prepare(
        "UPDATE course_release SET status = 'retired' WHERE id = 'search-foreign'",
      )
      .run();
    expect(() =>
      searchCurriculum(store, foreignToken, { q: 'foreignreleasesentinel' }),
    ).toThrow('unavailable');
  });
  it('protects the real route, rejects malformed/foreign scope parameters and preserves no-store errors', async () => {
    const before = fingerprint();
    const ok = await GET(request('q=JavaScript&kind=lesson&kind=exercise'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect((await ok.json()).data.total).toBeGreaterThan(0);
    for (const query of [
      'q=' + 'a'.repeat(101),
      'q=a&q=b',
      'page=0',
      'kind=password',
      'releaseId=search-foreign',
      'projection=reviewed-bindings',
      'projection=reviewed-mentions',
      'userId=other',
      'q=a+b+c+d+e+f+g+h+i',
    ]) {
      const response = await GET(request(query));
      expect(response.status, query).toBe(400);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect((await GET(request('q=Git', ''))).status).toBe(401);
    expect((await GET(request('q=Git', token, 'evil.example'))).status).toBe(
      403,
    );
    expect(fingerprint()).toBe(before);
  });
  it('rebuilds the derived representation after closing/reopening the same database', async () => {
    const before = fingerprint();
    const expected = searchCurriculum(store, token, { q: 'Git' });
    store.native.close();
    expect((await GET(request('q=Git'))).status).toBe(503);
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(
      store.native
        .prepare(
          "SELECT name FROM sqlite_temp_master WHERE name='curriculum_search_bindings'",
        )
        .get(),
    ).toBeUndefined();
    expect(searchCurriculum(store, token, { q: 'Git' })).toEqual(expected);
    expect(fingerprint()).toBe(before);
  });
});
