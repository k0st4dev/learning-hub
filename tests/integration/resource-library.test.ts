import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import {
  readResourceLibrary,
  type ResourceLibrary,
} from '../../src/server/content/resource-library';
import { resourceQuerySchema } from '../../src/domain/resource-library';
import { register, login, requireStudent } from '../../src/server/auth/service';
import { startCourse } from '../../src/server/learning/mutate';
import { saveNote } from '../../src/server/learning/notes';
import { AppError } from '../../src/server/errors';

const root = process.cwd();
let directory: string;
let store: Store;
let token: string;
let other: string;
let fixtureToken: string;
let unenrolled: string;
let plan: Awaited<ReturnType<typeof loadArchivedCurriculum>>;
const synthetic = 'resource-library-fixture';
async function account(email: string) {
  const credentials = {
    email,
    password: 'Local resource library test password',
  };
  await register(store, { ...credentials, confirmation: credentials.password });
  return (await login(store, credentials)).token;
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
    'resource',
    'resource_use',
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
function pages(session = token, input: Record<string, unknown> = {}) {
  const first = readResourceLibrary(store, session, input);
  const all: ResourceLibrary['results'] = [];
  for (let page = 1; page <= Math.ceil(first.total / 25); page++)
    all.push(
      ...readResourceLibrary(store, session, { ...input, page }).results,
    );
  return { first, all };
}
beforeAll(async () => {
  plan = await loadArchivedCurriculum(root);
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/resource-library-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  importCurriculum(store, plan.source);
  token = await account('resource-first@example.test');
  startCourse(store, token);
  other = await account('resource-second@example.test');
  startCourse(store, other);
  unenrolled = await account('resource-unenrolled@example.test');
  fixtureToken = await account('resource-fixture@example.test');
  // Build a separate synthetic draft and publish once. Never edit the imported immutable curriculum.
  store.native.transaction(() => {
    store.native
      .prepare(
        "INSERT INTO course_release(id,course_id,version,status,source_filename,source_sha256,manifest_sha256,created_at) VALUES (?,'software-engineer',?,'draft','synthetic','hash','fixture-manifest',?)",
      )
      .run(synthetic, synthetic, Date.now());
    const item = store.native.prepare(
      'INSERT INTO content_item(id,release_id,stable_key,kind,parent_id,order_index,title,content_hash,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)',
    );
    for (const [key, kind, parent, order, href] of [
      ['f1', 'module', null, 0, '/course/software-engineer/modules/f1'],
      ['w01', 'week', 'f1', 0, '/course/software-engineer/weeks/w01'],
      ['d001', 'day', 'w01', 0, '/course/software-engineer/days/d001'],
      [
        'e1',
        'exercise',
        'd001',
        0,
        '/course/software-engineer/days/d001/exercises/e1',
      ],
      ['f2', 'module', null, 1, '/course/software-engineer/modules/f2'],
      ['w02', 'week', 'f2', 0, '/course/software-engineer/weeks/w02'],
      ['d002', 'day', 'w02', 0, '/course/software-engineer/days/d002'],
      [
        'e2',
        'exercise',
        'd002',
        0,
        '/course/software-engineer/days/d002/exercises/e2',
      ],
      ['guide', 'guide', null, 2, '/resources'],
    ] as const)
      item.run(
        synthetic + ':' + key,
        synthetic,
        key,
        kind,
        parent ? synthetic + ':' + parent : null,
        order,
        key,
        'hash',
        JSON.stringify({ route: href }),
      );
    for (const n of [1, 2])
      store.native
        .prepare(
          "INSERT INTO course_day(item_id,day_number,source_date,estimated_minutes,ai_policy_markdown,completion_criterion_markdown,assessment_kind) VALUES (?,?,?,1,'AI','criterion','practice')",
        )
        .run(synthetic + ':d00' + n, n, '2026-10-08');
    const resource = store.native.prepare(
      'INSERT INTO resource(id,release_id,stable_key,title,source_name,type,original_url,resolved_url,description_markdown,link_origin,link_status,checked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    resource.run(
      synthetic + ':r1',
      synthetic,
      'r1',
      'Same title',
      'Provider A',
      'documentation',
      'https://example.test/original',
      'https://example.test/reviewed',
      'Vežbe C++ 100% a_b path\\file',
      'source',
      'unavailable',
      42,
    );
    resource.run(
      synthetic + ':r2',
      synthetic,
      'r2',
      'Same title',
      'Provider B',
      'course',
      null,
      null,
      'foreignresourcesentinel',
      'unresolved',
      'unchecked',
      null,
    );
    resource.run(
      synthetic + ':r3',
      synthetic,
      'r3',
      'Reference only',
      'Provider A',
      'reference',
      null,
      null,
      'No invented deep link',
      'unresolved',
      'unchecked',
      null,
    );
    resource.run(
      synthetic + ':r0',
      synthetic,
      'r0',
      'No contexts',
      'Provider A',
      'tool',
      null,
      null,
      'Unused source resource',
      'unresolved',
      'unchecked',
      null,
    );
    const use = store.native.prepare(
      'INSERT INTO resource_use(id,release_id,resource_id,content_item_id,assigned_text,section_locator,requirement_mode,order_index) VALUES (?,?,?,?,?,?,?,?)',
    );
    for (const [key, r, context, mode, n] of [
      ['u1', 'r1', 'e1', 'required', 0],
      ['u2', 'r1', 'e2', 'optional', 1],
      ['u3', 'r2', 'e1', 'optional', 2],
      ['u4', 'r2', 'e2', 'required', 3],
      ['u5', 'r3', 'guide', 'conditional', 4],
      ['u6', 'r3', 'w01', 'reference', 5],
    ] as const)
      use.run(
        synthetic + ':' + key,
        synthetic,
        synthetic + ':' + r,
        synthetic + ':' + context,
        'Original assignment ' + key,
        'Original section ' + key,
        mode,
        n,
      );
    store.native
      .prepare(
        "UPDATE course_release SET status='published',published_at=? WHERE id=?",
      )
      .run(Date.now() + 10000, synthetic);
    store.native
      .prepare(
        "INSERT INTO enrollment(id,user_id,course_id,release_id,started_at) VALUES (?,?,'software-engineer',?,?)",
      )
      .run(
        randomUUID(),
        requireStudent(store, fixtureToken).id,
        synthetic,
        Date.now(),
      );
  })();
});
afterAll(async () => {
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('resource-library-test-')
  )
    throw new Error('Unexpected resource test path');
  await rm(directory, { recursive: true, force: true });
});
describe('owned resource library read model', () => {
  it('pages every original URL and unresolved mention with exact use text and provenance', () => {
    const before = fingerprint();
    const { first, all } = pages();
    expect(first.total).toBe(69);
    expect(first.pageSize).toBe(25);
    expect(first.results).toHaveLength(25);
    expect(readResourceLibrary(store, token, { page: 2 }).results).toHaveLength(
      25,
    );
    expect(readResourceLibrary(store, token, { page: 3 }).results).toHaveLength(
      19,
    );
    expect(new Set(all.map((r) => r.id)).size).toBe(69);
    expect(all.filter((r) => r.linkOrigin === 'unresolved')).toHaveLength(57);
    for (const original of plan.resources) {
      const record = all.find((r) => r.id === original.id)!;
      expect(record.title).toBe(original.title);
      expect(record.originalUrl).toBe(original.originalUrl);
      expect(record.sourceName).toBe(original.sourceName);
      expect(record.type).toBe(original.type);
      expect(record.href).toBe('/resources/' + original.stableKey);
      expect(record.linkStatus).toBe('unchecked');
    }
    const uses = all.flatMap((r) => r.uses);
    expect(uses).toHaveLength(plan.uses.length);
    expect(uses.filter((u) => u.id.includes(':hyperlink:'))).toHaveLength(19);
    for (const use of plan.uses) {
      const record = uses.find((u) => u.id === use.id)!;
      expect(record.assignedText).toBe(use.assignedText);
      expect(record.sectionLocator).toBe(use.sectionLocator);
      expect(record.requirementMode).toBe(use.requirementMode);
      expect(record.breadcrumbs.at(-1)?.href).toBe(record.href);
    }
    expect(first.metadataCoverage).toEqual({
      typesObserved: ['reference'],
      requirementsObserved: ['reference'],
    });
    expect(fingerprint()).toBe(before);
  });
  it('uses original title/ID ordering rather than relevance or row order, including equal titles', () => {
    const result = pages().all;
    const keys = result.map((r) => r.title + '\u0000' + r.id);
    expect(keys).toEqual([...keys].sort());
    const fixture = readResourceLibrary(store, fixtureToken, {
      q: 'Same title',
    });
    expect(fixture.results.map((r) => r.stableKey)).toEqual(['r1', 'r2']);
    expect(readResourceLibrary(store, token, { page: 10000 }).results).toEqual(
      [],
    );
    expect(readResourceLibrary(store, token, { page: 10000 }).total).toBe(69);
  });
  it('inherits exact phase/week/day context, preserves all related uses and deduplicates numbered days', () => {
    const result = readResourceLibrary(store, fixtureToken, { day: ['d001'] });
    expect(result.results.map((r) => r.stableKey)).toEqual(['r1', 'r2']);
    const first = result.results[0]!;
    expect(first.matchingUseIds).toEqual([synthetic + ':u1']);
    expect(first.uses.map((u) => u.requirementMode)).toEqual([
      'required',
      'optional',
    ]);
    expect(first.uses[0]).toMatchObject({
      module: 'f1',
      week: 'w01',
      day: 'd001',
      dayNumber: 1,
      sectionLocator: 'Original section u1',
    });
    expect(first.relatedDays.map((d) => d.dayNumber)).toEqual([1, 2]);
    expect(first.relatedDays[0]!.href).toBe(
      '/course/software-engineer/days/d001',
    );
    const options = readResourceLibrary(store, token, {}).options;
    expect(options.module).toHaveLength(6);
    expect(options.week).toHaveLength(26);
    expect(options.day).toHaveLength(182);
    expect(options.day[0]!.label).toContain(plan.source.days[0]!.title);
  });
  it('requires one use for AND dimensions and permits OR within type/source/scopes/requiredness', () => {
    const list = (input: unknown) =>
      readResourceLibrary(store, fixtureToken, input).results.map(
        (r) => r.stableKey,
      );
    expect(list({ day: ['d001'], requirement: ['optional'] })).toEqual(['r2']);
    expect(list({ day: ['d002'], requirement: ['optional'] })).toEqual(['r1']);
    expect(list({ module: ['f1'], week: ['w02'] })).toEqual([]);
    expect(list({ week: ['w01'], day: ['d002'] })).toEqual([]);
    expect(
      list({
        source: ['Provider A', 'Provider B'],
        type: ['documentation', 'course'],
        day: ['d001', 'd002'],
        requirement: ['required', 'optional'],
      }),
    ).toEqual(['r1', 'r2']);
    expect(list({ source: ['Provider A'], type: ['course'] })).toEqual([]);
    expect(list({ requirement: ['conditional'] })).toEqual(['r3']);
    expect(list({ week: ['w01'], requirement: ['reference'] })).toEqual(['r3']);
    expect(list({ day: ['d001'], requirement: ['reference'] })).toEqual([]);
    expect(list({})).toContain('r0');
    expect(list({ requirement: ['reference'] })).not.toContain('r0');
  });
  it('matches Serbian, punctuation and literal SQL wildcards through the shared safe index', () => {
    for (const q of [
      'vezbe',
      'Vežbe',
      'vezbe C++',
      '100%',
      'a_b',
      'path\\file',
    ])
      expect(
        readResourceLibrary(store, fixtureToken, { q }).results.map(
          (r) => r.stableKey,
        ),
        q,
      ).toEqual(['r1']);
    for (const q of ["' OR 1=1 --", '%notPresent', 'a_z', 'vezbe nonexistent'])
      expect(readResourceLibrary(store, fixtureToken, { q }).total, q).toBe(0);
    expect(
      readResourceLibrary(store, token, { q: 'NoSuchResourceSentinel' }).total,
    ).toBe(0);
  });
  it('preserves unavailable original/reviewed URLs and does not invent links for unresolved resources', () => {
    const results = readResourceLibrary(store, fixtureToken, {}).results;
    expect(results.find((r) => r.stableKey === 'r1')).toMatchObject({
      originalUrl: 'https://example.test/original',
      resolvedUrl: 'https://example.test/reviewed',
      linkOrigin: 'source',
      linkStatus: 'unavailable',
      checkedAt: 42,
    });
    expect(results.find((r) => r.stableKey === 'r2')).toMatchObject({
      originalUrl: null,
      resolvedUrl: null,
      linkOrigin: 'unresolved',
      descriptionMarkdown: 'foreignresourcesentinel',
    });
  });
  it('rejects unauthenticated, unenrolled, submitted owner/release and account-switch reads', () => {
    const before = fingerprint();
    expect(() => readResourceLibrary(store, undefined, {})).toThrow('Sign in');
    expect(() => readResourceLibrary(store, unenrolled, {})).toThrow(
      'Start the course',
    );
    for (const input of [
      { releaseId: synthetic },
      { userId: 'other' },
      { type: ['password'] },
      { requirement: ['complete'] },
    ])
      expect(() => readResourceLibrary(store, token, input)).toThrow();
    expect(() =>
      readResourceLibrary(store, token, {}, requireStudent(store, other).id),
    ).toThrow('account changed');
    expect(() =>
      readResourceLibrary(store, token, {}, requireStudent(store, token).id),
    ).not.toThrow();
    expect(fingerprint()).toBe(before);
  });
  it('never chooses a newer published release or private learner text, and leaves two users unchanged', () => {
    saveNote(store, token, {
      itemId: 'se-26w-v1:d001-learn',
      body: 'privateresourcesentinel',
      expectedRevision: 0,
      mutationId: randomUUID(),
      expectedStudentId: requireStudent(store, token).id,
    });
    const before = fingerprint();
    expect(
      readResourceLibrary(store, token, { q: 'foreignresourcesentinel' }).total,
    ).toBe(0);
    expect(
      readResourceLibrary(store, fixtureToken, { q: 'foreignresourcesentinel' })
        .total,
    ).toBe(1);
    for (const session of [token, other]) {
      expect(
        readResourceLibrary(store, session, { q: 'privateresourcesentinel' })
          .total,
      ).toBe(0);
      expect(
        readResourceLibrary(store, session, { q: 'Git', week: ['w01'] })
          .releaseId,
      ).toBe('se-26w-v1');
    }
    expect(fingerprint()).toBe(before);
  });
  it('keeps impossible or unknown valid filters empty without falling back to another scope', () => {
    for (const input of [
      { source: ['Unknown source'] },
      { week: ['unknown'] },
      { day: ['d001'], week: ['w26'] },
      { type: ['video'] },
      { requirement: ['required'] },
    ])
      expect(readResourceLibrary(store, token, input).total).toBe(0);
    expect(resourceQuerySchema.parse({ q: '' }).q).toBe('');
  });
  it('rebuilds derived search after reopening the same database and rejects unavailable pinned content', () => {
    const before = fingerprint();
    const expected = readResourceLibrary(store, token, { q: 'Git' });
    store.native.close();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(readResourceLibrary(store, token, { q: 'Git' })).toEqual(expected);
    expect(fingerprint()).toBe(before);
    store.native
      .prepare("UPDATE course_release SET status='retired' WHERE id=?")
      .run(synthetic);
    try {
      expect(() => readResourceLibrary(store, fixtureToken, {})).toThrowError(
        AppError,
      );
      expect(() => readResourceLibrary(store, fixtureToken, {})).toThrow(
        'unavailable',
      );
    } finally {
      store.native
        .prepare("UPDATE course_release SET status='published' WHERE id=?")
        .run(synthetic);
    }
  });
});
