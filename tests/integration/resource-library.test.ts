// @vitest-environment jsdom
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { FullCurriculumPage } from '../../src/components/full-curriculum-page';
import { ResourceDetailView } from '../../src/components/resource-detail-view';
import { resourceDetailViewSchema } from '../../src/domain/resource-library-view';
import * as contentRead from '../../src/server/content/read';
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
  readResourceDetail,
  type ResourceLibrary,
} from '../../src/server/content/resource-library';
import {
  resourceQuerySchema,
  resourceProviderKey,
} from '../../src/domain/resource-library';
import { register, login, requireStudent } from '../../src/server/auth/service';
import { startCourse } from '../../src/server/learning/mutate';
import { saveNote } from '../../src/server/learning/notes';
import { AppError } from '../../src/server/errors';
import frozen from '../../content/interpretations/se-26w-v1-resource-labels-v1.json';
import { readCatalog, type Catalog } from '../../src/server/content/read';
import {
  resourceLabelPresentation,
  validateResourceLabels,
  resourceLabelSha256,
} from '../../src/server/content/resource-labels';
import {
  labelDigest,
  resourceLabelSchema,
} from '../../src/server/content/resource-label-contract';

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
    'source_block',
    'source_mapping',
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
      expect(record).toMatchObject(original);
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
      expect(record).toMatchObject(use);
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
    ])
      expect(readResourceLibrary(store, token, input).total).toBe(0);
    expect(resourceQuerySchema.parse({ q: '' }).q).toBe('');
  });
  it('applies the complete approved inventory with separate raw fields and exact Word evidence', () => {
    const before = fingerprint();
    const { first, all } = pages();
    const count = (values: string[]) =>
      Object.fromEntries(
        [...new Set(values)]
          .sort()
          .map((value) => [value, values.filter((v) => v === value).length]),
      );
    expect(count(all.map((row) => row.effective.type))).toEqual({
      article: 1,
      course: 4,
      documentation: 6,
      guide: 52,
      practice: 2,
      reference: 4,
    });
    expect(
      count(
        all.flatMap((row) =>
          row.uses.map((use) => use.effective.requirementMode),
        ),
      ),
    ).toEqual({ conditional: 4, optional: 4, reference: 131, required: 151 });
    expect(first.metadataInterpretation).toEqual({
      origin: 'added-product-interpretation',
      version: 'se-26w-v1-resource-labels-v1',
      sha256: resourceLabelSha256,
    });
    expect(first.effectiveMetadataCoverage).toEqual({
      typesObserved: [
        'article',
        'course',
        'documentation',
        'guide',
        'practice',
        'reference',
      ],
      requirementsObserved: [
        'conditional',
        'optional',
        'reference',
        'required',
      ],
    });
    for (const interpretation of all.flatMap((row) => [
      row.interpretation,
      ...row.uses.map((use) => use.interpretation),
    ])) {
      expect(interpretation.origin).toBe('added-product-interpretation');
      expect(interpretation.evidence.length).toBeGreaterThan(0);
      for (const evidence of interpretation.evidence) {
        const original = plan.blocks.find(
          (block) => block.sourceLocator === evidence.sourceId,
        )!;
        expect(evidence.exactText).toBe(original.exactText);
        expect(evidence.sha256).toBe(original.textSha256);
        expect(evidence.table).toBe(original.tableNumber);
        expect(evidence.row).toBe(original.rowNumber);
        expect(evidence.cell).toBe(original.cellNumber);
      }
    }
    expect(
      all.every(
        (row) =>
          row.type === 'reference' &&
          row.uses.every((use) => use.requirementMode === 'reference'),
      ),
    ).toBe(true);
    expect(all.filter((row) => row.interpretation.ambiguity)).toHaveLength(6);
    expect(
      all
        .flatMap((row) => row.uses)
        .filter(
          (use) =>
            use.interpretation.ambiguity || use.interpretation.caveats.length,
        ),
    ).toHaveLength(63);
    expect(
      all
        .flatMap((row) => row.uses)
        .filter((use) => use.id.includes(':hyperlink:'))
        .every((use) => use.effective.requirementMode === 'reference'),
    ).toBe(true);
    expect(fingerprint()).toBe(before);
  });
  it('filters reviewed type/provider labels, groups shared providers and retains unknown choices', () => {
    const keys = (input: unknown) =>
      readResourceLibrary(store, token, input)
        .results.map((row) => row.stableKey)
        .sort();
    expect(
      keys({ source: [resourceProviderKey('MDN')], type: ['documentation'] }),
    ).toEqual(['res-07']);
    expect(
      keys({
        source: [resourceProviderKey('The Odin Project')],
        type: ['course'],
      }),
    ).toEqual(['res-01', 'res-02']);
    expect(keys({ type: ['article'] })).toEqual(['res-08']);
    expect(
      keys({
        source: [resourceProviderKey(null)],
        day: ['d125'],
        requirement: ['required'],
      }),
    ).toEqual(['unresolved-p1604']);
    expect(
      keys({
        source: [resourceProviderKey(null)],
        day: ['d132'],
        requirement: ['required'],
      }),
    ).toEqual(['unresolved-p1679']);
    const unknown = readResourceLibrary(store, token, { day: ['d132'] })
      .results[0]!;
    expect(unknown.effective.provider).toBeNull();
    expect(unknown.originalUrl).toBeNull();
    expect(unknown.sourceName).toBe(
      'Original instruction without supplied URL',
    );
    expect(unknown.interpretation.ambiguity).toBe(true);
    expect(unknown.uses[0]!.interpretation.caveats.length).toBeGreaterThan(0);
    expect(pages().first.options.source).toContainEqual({
      value: resourceProviderKey(null),
      label: 'Provider not specified in manual',
    });
    expect(resourceProviderKey(null)).not.toBe(
      resourceProviderKey('unspecified'),
    );
    // An unsupported published release has an explicit raw fallback, never the official labels.
    const fallback = readResourceLibrary(store, fixtureToken, {});
    expect(fallback.metadataInterpretation).toEqual({
      origin: 'imported-metadata',
      version: null,
      sha256: null,
    });
    expect(
      fallback.results.find((row) => row.stableKey === 'r1')!.effective,
    ).toEqual({
      type: 'documentation',
      provider: 'Provider A',
      sourceFilterKey: 'Provider A',
    });
    expect(
      fallback.results.every((row) => row.interpretation.evidence.length === 0),
    ).toBe(true);
  });
  it('keeps alternatives conditional and source-only restrictions outside required-resource filters', () => {
    const keys = (day: string, requirement: string) =>
      readResourceLibrary(store, token, {
        day: [day],
        requirement: [requirement],
      })
        .results.map((row) => row.stableKey)
        .sort();
    for (const [day, key, choice] of [
      ['d025', 'res-02', 'choice:p0530'],
      ['d083', 'res-06', 'choice:p1152'],
    ]) {
      expect(keys(day!, 'conditional')).toEqual([key]);
      expect(keys(day!, 'required')).toEqual([]);
      const result = readResourceLibrary(store, token, {
        day: [day!],
        requirement: ['conditional'],
      }).results[0]!;
      expect(
        result.uses.find((use) => use.day === day)!.interpretation.choiceGroup,
      ).toBe(choice);
    }
    expect(keys('d146', 'conditional')).toEqual(['res-05', 'res-09']);
    expect(keys('d146', 'required')).toEqual([]);
    expect(keys('d182', 'reference')).toEqual(['unresolved-p2218']);
    expect(keys('d182', 'required')).toEqual([]);
    expect(
      readResourceLibrary(store, token, { day: ['d182'] }).results[0]!.uses[0]!
        .assignedText,
    ).toContain('120');
  });
  it('scopes optional and as-needed clauses to the same provider/use without altering parents', () => {
    const keys = (input: unknown) =>
      readResourceLibrary(store, token, input)
        .results.map((row) => row.stableKey)
        .sort();
    expect(keys({ day: ['d113'], requirement: ['optional'] })).toEqual([
      'res-02',
    ]);
    expect(keys({ day: ['d113'], requirement: ['required'] })).toEqual([
      'res-03',
    ]);
    expect(
      keys({
        source: [resourceProviderKey('The Odin Project')],
        day: ['d113'],
        requirement: ['required'],
      }),
    ).toEqual([]);
    expect(keys({ day: ['d127'], requirement: ['required'] })).toEqual([
      'res-03',
    ]);
    expect(keys({ day: ['d127'], requirement: ['reference'] })).toEqual([
      'res-12',
    ]);
    expect(keys({ day: ['d149'], requirement: ['required'] })).toEqual([
      'res-05',
    ]);
    expect(keys({ day: ['d149'], requirement: ['reference'] })).toEqual([
      'res-09',
    ]);
    expect(keys({ day: ['d179'], requirement: ['required'] })).toEqual([]);
    // Parent regrouping is separately reviewed; early generic TOP and implicit FSO keep original IDs.
    expect(keys({ day: ['d025'] })).toEqual(['res-02']);
    expect(
      pages()
        .all.flatMap((row) => row.uses)
        .map((use) => [use.id, use.resourceId])
        .sort(),
    ).toEqual(plan.uses.map((use) => [use.id, use.resourceId]).sort());
    expect(
      keys({
        source: [
          resourceProviderKey('CS50'),
          resourceProviderKey('The Odin Project'),
        ],
        day: ['d113'],
        requirement: ['required', 'optional'],
      }),
    ).toEqual(['res-02', 'res-03']);
  });
  it('fails visibly on release/raw-content/evidence drift and never modifies a catalog', () => {
    const catalog = readCatalog(store, 'se-26w-v1')!;
    const before = JSON.stringify(catalog);
    const cases: ((copy: Catalog) => void)[] = [
      (copy) => {
        copy.release.id = synthetic;
      },
      (copy) => {
        copy.release.status = 'draft';
      },
      (copy) => {
        copy.release.manifestSha256 = '0'.repeat(64);
      },
      (copy) => {
        copy.release.sourceSha256 = '0'.repeat(64);
      },
      (copy) => {
        copy.resources[0]!.title += ' changed';
      },
      (copy) => {
        copy.resources[0]!.originalUrl = 'https://example.test/changed';
      },
      (copy) => {
        copy.resources[0]!.sourceName = 'forged';
      },
      (copy) => {
        copy.resources.pop();
      },
      (copy) => {
        copy.resources[0] = copy.resources[1]!;
      },
      (copy) => {
        copy.uses[0]!.assignedText += ' changed';
      },
      (copy) => {
        copy.uses[0]!.resourceId = copy.resources[1]!.id;
      },
      (copy) => {
        copy.uses[0]!.requirementMode = 'required';
      },
      (copy) => {
        copy.uses.pop();
      },
      (copy) => {
        copy.uses[0] = copy.uses[1]!;
      },
      (copy) => {
        copy.blocks.find(
          (block) => block.sourceLocator === 'p0025',
        )!.exactText += ' changed';
      },
      (copy) => {
        copy.blocks.find(
          (block) => block.sourceLocator === 'p0025',
        )!.tableNumber = 99;
      },
    ];
    for (const change of cases) {
      const copy = structuredClone(catalog);
      change(copy);
      expect(() =>
        validateResourceLabels(copy, frozen, resourceLabelSha256),
      ).toThrowError(
        expect.objectContaining({
          status: 503,
          code: 'RESOURCE_LABELS_UNAVAILABLE',
        }),
      );
    }
    const operational = structuredClone(catalog);
    operational.resources[0]!.linkStatus = 'unavailable';
    operational.resources[0]!.resolvedUrl = 'https://example.test/reviewed';
    operational.resources[0]!.checkedAt = 42;
    expect(() => resourceLabelPresentation(operational)).not.toThrow();
    expect(JSON.stringify(catalog)).toBe(before);
  });
  it('rejects stale/tampered label versions, incomplete inventories, foreign rows and invalid evidence/rules', () => {
    const catalog = readCatalog(store, 'se-26w-v1')!;
    expect(() =>
      validateResourceLabels(catalog, null, resourceLabelSha256),
    ).toThrowError(AppError);
    expect(() =>
      validateResourceLabels(catalog, undefined, resourceLabelSha256),
    ).toThrowError(AppError);
    const tampered = structuredClone(frozen);
    tampered.resources[0]!.type = 'guide';
    expect(() =>
      validateResourceLabels(catalog, tampered, resourceLabelSha256),
    ).toThrowError(AppError);
    // A test trust pin exercises provenance validation independently of the production checksum.
    const cases: ((copy: typeof frozen) => void)[] = [
      (copy) => {
        copy.interpretationId = 'se-26w-v1-resource-labels-v2';
      },
      (copy) => {
        copy.resources[0]!.type = 'password';
      },
      (copy) => {
        copy.uses[0]!.requirementMode = 'complete';
      },
      (copy) => {
        copy.resources.pop();
      },
      (copy) => {
        copy.resources[0] = copy.resources[1]!;
      },
      (copy) => {
        copy.uses[0] = copy.uses[1]!;
      },
      (copy) => {
        copy.resources[0]!.resourceId = synthetic + ':r1';
      },
      (copy) => {
        copy.resources[0]!.evidenceRefs = ['p9999'];
      },
      (copy) => {
        copy.uses[0]!.rule = 'unknown';
      },
      (copy) => {
        copy.uses[0]!.sourceId = 'p9999';
      },
      (copy) => {
        copy.evidence[0] = copy.evidence[1]!;
      },
      (copy) => {
        copy.evidence[0]!.sha256 = '0'.repeat(64);
      },
    ];
    for (const change of cases) {
      const copy = structuredClone(frozen);
      change(copy);
      expect(() =>
        validateResourceLabels(catalog, copy, labelDigest(copy)),
      ).toThrowError(AppError);
    }
    expect(() =>
      validateResourceLabels(
        catalog,
        { ...frozen, unexpected: true },
        labelDigest({ ...frozen, unexpected: true }),
      ),
    ).toThrowError(AppError);
    expect(resourceLabelSchema.safeParse(frozen).success).toBe(true);
    expect(labelDigest(frozen)).toBe(resourceLabelSha256);
  });
  it('preserves learner/source records through no-op reseeding and repeated effective reads', () => {
    const before = fingerprint();
    const expected = readResourceLibrary(store, token, {
      day: ['d113'],
      requirement: ['optional'],
    });
    importCurriculum(store, plan.source);
    expect(
      readResourceLibrary(store, token, {
        day: ['d113'],
        requirement: ['optional'],
      }),
    ).toEqual(expected);
    expect(
      readResourceLibrary(store, other, {
        day: ['d113'],
        requirement: ['optional'],
      }).results,
    ).toEqual(expected.results);
    expect(fingerprint()).toBe(before);
  });
  it('projects all 69 detail records exactly like the library and preserves original rendered contexts', () => {
    const before = fingerprint();
    const catalog = readCatalog(store, 'se-26w-v1')!;
    const library = pages().all;
    let visibleUses = 0;
    for (const resource of library) {
      const detail = readResourceDetail(
        store,
        token,
        resource.stableKey,
        requireStudent(store, token).id,
      );
      expect(detail.resource).toEqual(resource);
      expect(readResourceDetail(store, other, resource.stableKey)).toEqual(
        detail,
      );
      expect(resourceDetailViewSchema.safeParse(detail).success).toBe(true);
      const original = renderToStaticMarkup(
        createElement(FullCurriculumPage, { catalog, route: resource.href }),
      );
      const updated = new DOMParser().parseFromString(
        renderToStaticMarkup(
          createElement(FullCurriculumPage, {
            catalog,
            route: resource.href,
            learnerTool: createElement(ResourceDetailView, {
              data: detail,
              releaseId: catalog.release.id,
            }),
          }),
        ),
        'text/html',
      );
      expect(updated.querySelectorAll('h1')).toHaveLength(1);
      const labels = updated.querySelector(
        '[aria-labelledby="resource-detail-labels"]',
      )!;
      expect(labels.textContent).toContain(
        resource.effective.provider ?? 'Provider not specified in manual',
      );
      expect(labels.querySelectorAll('[data-resource-use]')).toHaveLength(
        resource.uses.length,
      );
      visibleUses += resource.uses.length;
      for (const use of resource.uses) {
        const row = labels.querySelector(
          '[data-resource-use="' + use.id + '"]',
        )!;
        expect(row.querySelector('p.source')!.textContent).toBe(
          use.assignedText,
        );
        expect(row.querySelector('a')!.getAttribute('href')).toBe(use.href);
      }
      // Removing only the new presentation section must reproduce the entire legacy detail DOM.
      labels.remove();
      expect(updated.body.innerHTML).toBe(
        new DOMParser().parseFromString(original, 'text/html').body.innerHTML,
      );
    }
    expect(visibleUses).toBe(290);
    expect(fingerprint()).toBe(before);
  });
  it('guards detail reads by session, enrollment, pinned resource key and expected account', () => {
    const before = fingerprint();
    for (const session of [undefined, 'invalid'])
      expect(() => readResourceDetail(store, session, 'res-01')).toThrowError(
        expect.objectContaining({ status: 401 }),
      );
    expect(() => readResourceDetail(store, unenrolled, 'res-01')).toThrowError(
      expect.objectContaining({ code: 'ENROLLMENT_REQUIRED' }),
    );
    expect(() =>
      readResourceDetail(
        store,
        token,
        'res-01',
        requireStudent(store, other).id,
      ),
    ).toThrowError(expect.objectContaining({ status: 403 }));
    for (const key of ['missing', 'r1', 'se-26w-v1:res-01']) {
      if (key.includes(':'))
        expect(() => readResourceDetail(store, token, key)).toThrow();
      else
        expect(() => readResourceDetail(store, token, key)).toThrowError(
          expect.objectContaining({ code: 'RESOURCE_NOT_FOUND' }),
        );
    }
    expect(() =>
      readResourceDetail(store, fixtureToken, 'res-01'),
    ).toThrowError(expect.objectContaining({ code: 'RESOURCE_NOT_FOUND' }));
    for (const key of [
      '',
      '../res-01',
      'a'.repeat(201),
      { userId: requireStudent(store, other).id },
    ])
      expect(() => readResourceDetail(store, token, key)).toThrow();
    store.native
      .prepare("UPDATE course_release SET status='retired' WHERE id=?")
      .run(synthetic);
    try {
      expect(() => readResourceDetail(store, fixtureToken, 'r1')).toThrowError(
        AppError,
      );
    } finally {
      store.native
        .prepare("UPDATE course_release SET status='published' WHERE id=?")
        .run(synthetic);
    }
    expect(fingerprint()).toBe(before);
  });
  it('retains explicit raw fallback, unavailable reviewed URLs and unresolved detail records', () => {
    const expected = pages(fixtureToken).all;
    for (const row of expected) {
      const detail = readResourceDetail(store, fixtureToken, row.stableKey);
      expect(detail.resource).toEqual(row);
      expect(detail.metadataInterpretation.origin).toBe('imported-metadata');
      expect(detail.resource.interpretation.evidence).toEqual([]);
    }
    const unavailable = readResourceDetail(store, fixtureToken, 'r1').resource;
    expect(unavailable.originalUrl).toBe('https://example.test/original');
    expect(unavailable.resolvedUrl).toBe('https://example.test/reviewed');
    expect(unavailable.linkStatus).toBe('unavailable');
    const unresolved = readResourceDetail(store, fixtureToken, 'r2').resource;
    expect(unresolved.originalUrl).toBeNull();
    expect(unresolved.resolvedUrl).toBeNull();
  });
  it('rejects label drift in detail reads and recovers without editing the published catalog', () => {
    const before = fingerprint();
    const expected = readResourceDetail(store, token, 'res-02');
    const catalog = structuredClone(readCatalog(store, 'se-26w-v1')!);
    catalog.resources[0]!.title += ' forged';
    const stub = vi.spyOn(contentRead, 'readCatalog').mockReturnValue(catalog);
    try {
      expect(() => readResourceDetail(store, token, 'res-02')).toThrowError(
        expect.objectContaining({
          status: 503,
          code: 'RESOURCE_LABELS_UNAVAILABLE',
        }),
      );
    } finally {
      stub.mockRestore();
    }
    expect(readResourceDetail(store, token, 'res-02')).toEqual(expected);
    expect(fingerprint()).toBe(before);
  });
  it('retains detail labels and source evidence across database close/reopen with no learner writes', () => {
    const before = fingerprint();
    const expected = readResourceDetail(store, token, 'res-02');
    store.native.close();
    expect(() => readResourceDetail(store, token, 'res-02')).toThrow();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(readResourceDetail(store, token, 'res-02')).toEqual(expected);
    expect(readResourceDetail(store, other, 'res-02')).toEqual(expected);
    expect(fingerprint()).toBe(before);
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
