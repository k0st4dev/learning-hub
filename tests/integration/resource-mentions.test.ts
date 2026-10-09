import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { migrate } from '../../src/server/db/migrate';
import { openDatabase, type Store } from '../../src/server/db/connection';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import';
import { register, login, requireStudent } from '../../src/server/auth/service';
import { startCourse } from '../../src/server/learning/mutate';
import { saveNote } from '../../src/server/learning/notes';
import { readCatalog, type Catalog } from '../../src/server/content/read';
import * as contentRead from '../../src/server/content/read';
import {
  readResourceBindings,
  readResourceLibrary,
  readResourceDetail,
} from '../../src/server/content/resource-library';
import { searchCurriculum } from '../../src/server/content/search';
import { ensureSearchIndex } from '../../src/server/content/search-index';
import { searchResponseSchema } from '../../src/domain/search';
import {
  readResourceMentionProjection,
  readResourceMentionLibrary,
  readResourceMentionDetail,
} from '../../src/server/content/resource-mention-projection';
import {
  validateResourceMentions,
  resourceMentionPresentation,
  resourceMentionSha256,
} from '../../src/server/content/resource-mentions';
import { labelDigest } from '../../src/server/content/resource-label-contract';
import { resourceProviderKey } from '../../src/domain/resource-library';
import frozen from '../../content/interpretations/se-26w-v1-resource-mentions-v1.json';

const root = process.cwd();
let directory: string;
let store: Store;
let token: string;
let other: string;
let unenrolled: string;
let fallbackToken: string;
let catalog: Catalog;
let plan: Awaited<ReturnType<typeof loadArchivedCurriculum>>;
const fallbackRelease = 'named-mention-fallback-fixture';
async function account(email: string) {
  const data = { email, password: 'Local named resource test password' };
  await register(store, { ...data, confirmation: data.password });
  return (await login(store, data)).token;
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
beforeAll(async () => {
  plan = await loadArchivedCurriculum(root);
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/resource-mentions-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
  importCurriculum(store, plan.source);
  token = await account('named-first@example.test');
  startCourse(store, token);
  other = await account('named-second@example.test');
  startCourse(store, other);
  unenrolled = await account('named-unenrolled@example.test');
  fallbackToken = await account('named-fallback@example.test');
  // Isolated unsupported release: raw metadata must remain usable.
  store.native.transaction(() => {
    store.native
      .prepare(
        "INSERT INTO course_release(id,course_id,version,status,source_filename,source_sha256,manifest_sha256,created_at) VALUES (?,'software-engineer',?,'draft','synthetic','hash','fixture',?)",
      )
      .run(fallbackRelease, fallbackRelease, Date.now());
    store.native
      .prepare(
        "INSERT INTO content_item(id,release_id,stable_key,kind,parent_id,order_index,title,content_hash,metadata_json) VALUES (?,?,'guide','guide',NULL,0,'Reference','hash',?)",
      )
      .run(
        fallbackRelease + ':guide',
        fallbackRelease,
        JSON.stringify({ route: '/resources' }),
      );
    store.native
      .prepare(
        "INSERT INTO resource(id,release_id,stable_key,title,source_name,type,description_markdown,link_origin,link_status) VALUES (?,?,'reference','Fallback','Raw provider','reference','Original fallback reference','unresolved','unchecked')",
      )
      .run(fallbackRelease + ':reference', fallbackRelease);
    store.native
      .prepare(
        "INSERT INTO resource_use(id,release_id,resource_id,content_item_id,assigned_text,section_locator,requirement_mode,order_index) VALUES (?,?,?,?, 'Original fallback reference',NULL,'reference',0)",
      )
      .run(
        fallbackRelease + ':use',
        fallbackRelease,
        fallbackRelease + ':reference',
        fallbackRelease + ':guide',
      );
    store.native
      .prepare(
        "UPDATE course_release SET status='published',published_at=? WHERE id=?",
      )
      .run(Date.now(), fallbackRelease);
    store.native
      .prepare(
        'INSERT INTO enrollment(id,user_id,course_id,release_id,started_at) VALUES (?,?,?,?,?)',
      )
      .run(
        'named-fallback-enrollment',
        requireStudent(store, fallbackToken).id,
        'software-engineer',
        fallbackRelease,
        Date.now(),
      );
  })();
  catalog = readCatalog(store, plan.releaseId)!;
}, 60000);
afterAll(async () => {
  store?.native.close();
  if (directory) {
    const target = path.resolve(directory);
    if (!target.startsWith(path.resolve(root, '.tmp') + path.sep))
      throw new Error('Test cleanup target is outside the fixture directory');
    await rm(target, { recursive: true, force: true });
  }
});

describe('frozen approved named-resource candidate', () => {
  it('pins exactly thirteen approved mentions, twelve identities and eighteen source evidence blocks', () => {
    expect(labelDigest(frozen)).toBe(resourceMentionSha256);
    const result = validateResourceMentions(catalog, frozen);
    expect(result.mentions).toHaveLength(13);
    expect(result.artifact.resources).toHaveLength(12);
    expect(result.artifact.evidence).toHaveLength(18);
    expect(result.mentions.some((row) => row.sourceId === 'p1679')).toBe(false);
    for (const row of result.mentions) {
      expect(
        row.evidence.some((proof) =>
          proof.exactText.includes(row.exactInstruction),
        ),
      ).toBe(true);
      expect(row.origin).toBe('added-product-interpretation');
      expect(row.sourceMappingHref.split('#')[0]).toBe(row.href);
      for (const origin of row.origins)
        expect(
          catalog.uses.find((use) => use.id === origin.useId)!.assignedText,
        ).toBe(row.exactInstruction);
    }
  });
  it('retains all original records and both original/effective inventories, with separate derived edges', () => {
    const before = fingerprint();
    const base = readResourceBindings(store, token);
    const result = readResourceMentionProjection(store, token);
    expect(result.resources).toHaveLength(79);
    expect(result.derivedMentions).toHaveLength(13);
    expect(result.originalUses).toEqual(base.uses);
    expect(
      result.resources
        .flatMap((row) => row.uses)
        .map((row) => row.id)
        .sort(),
    ).toEqual(base.uses.map((row) => row.id).sort());
    expect(
      result.resources
        .flatMap((row) => row.originalUses)
        .map((row) => row.id)
        .sort(),
    ).toEqual(base.uses.map((row) => row.id).sort());
    for (const resource of base.resources)
      expect(
        result.resources.find((row) => row.id === resource.id)!
          .originalResource,
      ).toEqual(resource);
    const additions = result.resources.filter(
      (row) => row.origin === 'added-product-interpretation',
    );
    expect(additions).toHaveLength(10);
    for (const row of additions) {
      expect(row.originalResource).toBeNull();
      expect(row.originalUses).toEqual([]);
      expect(row.uses).toEqual([]);
      expect(row.derivedMentions.length).toBeGreaterThan(0);
    }
    expect(new Set(result.resources.map((row) => row.id)).size).toBe(79);
    expect(fingerprint()).toBe(before);
  });
  it('reuses canonical Node/Psets and one Practice identity for two weeks, preserving original parent URLs', () => {
    const result = readResourceMentionProjection(store, token);
    for (const key of ['res-10', 'res-04']) {
      expect(
        result.resources.filter((row) => row.stableKey === key),
      ).toHaveLength(1);
      expect(
        result.resources.find((row) => row.stableKey === key)!.derivedMentions,
      ).toHaveLength(1);
    }
    const practice = readResourceMentionDetail(
      store,
      token,
      'named-cs50-practice',
    ).resource;
    expect(practice.derivedMentions.map((row) => row.scope.week)).toEqual([
      'w13',
      'w14',
    ]);
    expect(practice.parent!.originalUrl).toBe(
      catalog.resources.find((row) => row.stableKey === 'res-03')!.originalUrl,
    );
    expect(practice.originalResource).toBeNull();
    expect(
      readResourceMentionDetail(store, token, 'named-sqlite-docs').resource
        .parent,
    ).toBeNull();
  });
  it('preserves conditional/as-needed/weekly scopes and never activates deferred library choices', () => {
    const keys = (input: Record<string, unknown>) =>
      readResourceMentionLibrary(store, token, input).results.map(
        (row) => row.stableKey,
      );
    expect(keys({ day: ['d025'], requirement: ['conditional'] })).toEqual([
      'named-jest-getting-started',
      'res-01',
    ]);
    expect(
      keys({
        q: 'Jest',
        day: ['d025'],
        requirement: ['required'],
        type: ['documentation'],
      }),
    ).toEqual([]);
    expect(
      keys({
        day: ['d061'],
        type: ['documentation'],
        requirement: ['reference'],
      }),
    ).toEqual(['named-eslint-getting-started']);
    expect(
      keys({
        day: ['d061'],
        type: ['documentation'],
        requirement: ['required'],
      }),
    ).toEqual([]);
    expect(keys({ day: ['d127'], requirement: ['reference'] })).toContain(
      'named-sqlite-docs',
    );
    expect(
      keys({ q: 'parameterized', day: ['d132'], requirement: ['required'] }),
    ).toContain('unresolved-p1679');
    expect(
      keys({
        q: 'Express',
        week: ['w23'],
        type: ['documentation'],
        requirement: ['reference'],
      }),
    ).toContain('named-express-docs');
    expect(
      keys({ q: 'Express', day: ['d155'], type: ['documentation'] }),
    ).not.toContain('named-express-docs');
    expect(
      keys({
        q: 'DevTools',
        day: ['d144'],
        type: ['tool'],
        requirement: ['required'],
      }),
    ).toContain('named-react-devtools');
    expect(() =>
      readResourceMentionDetail(store, token, 'named-pg-library-docs'),
    ).toThrowError(expect.objectContaining({ status: 404 }));
    expect(() =>
      readResourceMentionDetail(store, token, 'named-sqlite-library-docs'),
    ).toThrowError(expect.objectContaining({ status: 404 }));
  });
  it('applies combined dimensions to one edge and exposes the exact matching derived keys', () => {
    const first = readResourceMentionLibrary(store, token, {
      q: 'Practice',
      week: ['w13'],
      requirement: ['reference'],
      type: ['practice'],
      source: [resourceProviderKey('CS50')],
    });
    const practice = first.results.find(
      (row) => row.stableKey === 'named-cs50-practice',
    )!;
    expect(practice.matchingMentionKeys).toEqual(['named-p1173-cs50-practice']);
    expect(
      readResourceMentionLibrary(store, token, {
        q: 'Practice',
        week: ['w13'],
        day: ['d098'],
        type: ['practice'],
      }).results.some((row) => row.stableKey === 'named-cs50-practice'),
    ).toBe(false);
    expect(
      readResourceMentionLibrary(store, token, {
        q: 'Practice',
        week: ['w13'],
        requirement: ['required'],
        type: ['practice'],
      }).results.some((row) => row.stableKey === 'named-cs50-practice'),
    ).toBe(false);
  });
  it('provides literal Unicode matching, safe input limits and stable 25-result pagination', () => {
    expect(
      readResourceMentionLibrary(store, token, {
        q: 'procitati',
        type: ['tool'],
      }).results.map((row) => row.stableKey),
    ).toEqual([
      'named-git',
      'named-node-runtime',
      'named-vs-code',
      'named-nvm',
    ]);
    expect(readResourceMentionLibrary(store, token, { q: '%' }).total).toBe(0);
    expect(
      readResourceMentionLibrary(store, token, { q: "' OR 1=1 --" }).total,
    ).toBe(0);
    for (const input of [
      { q: 'x'.repeat(101) },
      { q: 'a b c d e f g h i' },
      { projection: 'mentions' },
      { page: 0 },
    ])
      expect(() => readResourceMentionLibrary(store, token, input)).toThrow();
    const pages = [1, 2, 3, 4].flatMap(
      (page) => readResourceMentionLibrary(store, token, { page }).results,
    );
    expect(pages).toHaveLength(79);
    expect(new Set(pages.map((row) => row.id)).size).toBe(79);
    expect(
      readResourceMentionLibrary(store, token, { page: 5 }).results,
    ).toEqual([]);
    for (const row of pages)
      expect(
        readResourceMentionDetail(store, token, row.stableKey).resource,
      ).toEqual(
        Object.fromEntries(
          Object.entries(row).filter(
            ([key]) => !['matchingUseIds', 'matchingMentionKeys'].includes(key),
          ),
        ),
      );
  });
  it('guards sessions, expected accounts and enrollment before exposing the candidate', () => {
    for (const session of [undefined, 'invalid'])
      expect(() => readResourceMentionProjection(store, session)).toThrowError(
        expect.objectContaining({ status: 401 }),
      );
    expect(() =>
      readResourceMentionLibrary(store, unenrolled, {}),
    ).toThrowError(expect.objectContaining({ status: 404 }));
    expect(() =>
      readResourceMentionProjection(
        store,
        token,
        requireStudent(store, other).id,
      ),
    ).toThrowError(expect.objectContaining({ status: 403 }));
    expect(() =>
      readResourceMentionDetail(store, token, '../private'),
    ).toThrow();
    expect(() =>
      readResourceMentionDetail(store, token, 'missing'),
    ).toThrowError(expect.objectContaining({ status: 404 }));
  });
  it('keeps two-user private records separate and all reads preserve durable learning state', () => {
    saveNote(store, token, {
      itemId: 'se-26w-v1:d001-learn',
      body: 'first-private-named-sentinel',
      expectedStudentId: requireStudent(store, token).id,
      expectedRevision: 0,
      mutationId: randomUUID(),
    });
    saveNote(store, other, {
      itemId: 'se-26w-v1:d001-learn',
      body: 'second-private-named-sentinel',
      expectedStudentId: requireStudent(store, other).id,
      expectedRevision: 0,
      mutationId: randomUUID(),
    });
    const before = fingerprint();
    const first = readResourceMentionProjection(store, token);
    expect(readResourceMentionProjection(store, other)).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(
      /first-private-named-sentinel|second-private-named-sentinel/,
    );
    expect(
      readResourceMentionLibrary(store, token, {
        q: 'first-private-named-sentinel',
      }).total,
    ).toBe(0);
    expect(fingerprint()).toBe(before);
  });
  it('returns raw metadata explicitly for an unsupported pinned release without attaching official mentions', () => {
    const before = fingerprint();
    const result = readResourceMentionLibrary(store, fallbackToken, {});
    expect(result.releaseId).toBe(fallbackRelease);
    expect(result.total).toBe(1);
    expect(result.metadataMentionInterpretation).toEqual({
      origin: 'imported-metadata',
      version: null,
      sha256: null,
      approvedMentions: 0,
    });
    expect(result.results[0]!.originalResource!.descriptionMarkdown).toBe(
      'Original fallback reference',
    );
    expect(result.results[0]!.derivedMentions).toEqual([]);
    expect(fingerprint()).toBe(before);
  });
  it('rejects changed frozen identities, duplicate mentions and unsafe/unknown parent navigation', () => {
    for (const change of [
      (copy: typeof frozen) => {
        copy.mentions.pop();
      },
      (copy: typeof frozen) => {
        copy.mentions[1]!.key = copy.mentions[0]!.key;
      },
      (copy: typeof frozen) => {
        copy.resources[0]!.stableKey = '../unsafe';
      },
      (copy: typeof frozen) => {
        copy.resources.find((row) => row.parent)!.parent!.originalUrl =
          'https://example.test/invented';
      },
      (copy: typeof frozen) => {
        copy.proposalSha256 = '0'.repeat(64);
      },
      (copy: typeof frozen) => {
        copy.mentions[0]!.requirementMode = 'optional';
      },
    ]) {
      const copy = structuredClone(frozen);
      change(copy);
      expect(() => validateResourceMentions(catalog, copy)).toThrowError(
        expect.objectContaining({ status: 503 }),
      );
    }
  });
  it('rejects source/ancestor/use/mapping/base drift on every warm read and recovers after restoration', () => {
    const before = fingerprint();
    for (const change of [
      (copy: Catalog) => {
        copy.release.manifestSha256 = '0'.repeat(64);
      },
      (copy: Catalog) => {
        copy.blocks.find((row) => row.sourceLocator === 'p0274')!.exactText +=
          ' changed';
      },
      (copy: Catalog) => {
        copy.items.find((row) => row.stableKey === 'w01')!.title += ' changed';
      },
      (copy: Catalog) => {
        copy.uses.find(
          (row) => row.id === frozen.mentions[0]!.origins[0]!.useId,
        )!.assignedText += ' changed';
      },
      (copy: Catalog) => {
        copy.mappings.find(
          (row) =>
            row.websiteLocation === frozen.mentions[0]!.sourceMappingHref,
        )!.websiteLocation = '/resources';
      },
      (copy: Catalog) => {
        copy.resources.find((row) => row.stableKey === 'res-10')!.originalUrl =
          'https://example.test/drift';
      },
      (copy: Catalog) => {
        copy.items.push(copy.items[0]!);
      },
    ]) {
      const copy = structuredClone(catalog);
      change(copy);
      expect(() => resourceMentionPresentation(copy)).toThrowError(
        expect.objectContaining({ status: 503 }),
      );
      expect(resourceMentionPresentation(catalog).mentions).toHaveLength(13);
    }
    expect(fingerprint()).toBe(before);
  });
  it('preserves public library/detail/Search while candidate reads, no-op reseed and file reopen retain the same results', () => {
    const before = fingerprint();
    const library = readResourceLibrary(store, token, {});
    const search = searchCurriculum(store, token, {
      q: 'Express',
      kind: ['resource'],
    });
    const projection = readResourceMentionProjection(store, token);
    expect(library.total).toBe(69);
    expect(() =>
      readResourceDetail(store, token, 'named-express-docs'),
    ).toThrowError(expect.objectContaining({ status: 404 }));
    expect(
      search.results.some((row) => row.id.endsWith(':named-express-docs')),
    ).toBe(false);
    importCurriculum(store, plan.source);
    expect(readResourceMentionProjection(store, other)).toEqual(projection);
    expect(readResourceLibrary(store, other, {})).toEqual(library);
    expect(
      searchCurriculum(store, other, { q: 'Express', kind: ['resource'] }),
    ).toEqual(search);
    store.native.close();
    expect(() => readResourceMentionProjection(store, token)).toThrow();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(readResourceMentionProjection(store, token)).toEqual(projection);
    expect(readResourceLibrary(store, token, {})).toEqual(library);
    expect(
      searchCurriculum(store, token, { q: 'Express', kind: ['resource'] }),
    ).toEqual(search);
    expect(fingerprint()).toBe(before);
  });
});

function namedSearch(
  input: unknown,
  session: string | undefined = token,
  expectedStudentId?: string,
) {
  return searchCurriculum(
    store,
    session,
    input,
    expectedStudentId,
    'reviewed-mentions',
  );
}
function namedIndexRows(releaseId: string = plan.releaseId) {
  return store.native
    .prepare(
      'SELECT * FROM temp.curriculum_search_mentions WHERE release_id=? ORDER BY id',
    )
    .all(releaseId) as {
    id: string;
    kind: string;
    title: string;
    body: string;
    href: string;
    breadcrumbs: string;
    scope_contexts: string;
  }[];
}

describe('staged owned named-resource Search', () => {
  it('indexes the same 79 identities and all thirteen exact contexts without changing public indexes', () => {
    ensureSearchIndex(store, plan.releaseId, 'original');
    ensureSearchIndex(store, plan.releaseId, 'reviewed-bindings');
    const before = fingerprint();
    const publicRows = store.native
      .prepare('SELECT * FROM temp.curriculum_search_bindings ORDER BY id')
      .all();
    const originalRows = store.native
      .prepare('SELECT * FROM temp.curriculum_search ORDER BY id')
      .all();
    ensureSearchIndex(store, plan.releaseId, 'reviewed-mentions');
    const rows = namedIndexRows();
    const candidate = readResourceMentionProjection(store, token);
    expect(rows).toHaveLength(plan.items.length + 79);
    expect(
      rows.filter((row) => row.kind === 'resource').map((row) => row.id),
    ).toEqual(candidate.resources.map((row) => row.id).sort());
    for (const item of catalog.items)
      expect(rows.find((row) => row.id === item.id)).toMatchObject({
        title: item.title,
        href: item.route,
      });
    for (const resource of candidate.resources) {
      const row = rows.find((row) => row.id === resource.id)!;
      expect(row.href).toBe(resource.href);
      expect(row.title).toBe(resource.title);
      for (const use of resource.uses)
        expect(row.body).toContain(use.assignedText);
      for (const mention of resource.derivedMentions) {
        expect(row.body).toContain(mention.exactInstruction);
        expect(JSON.parse(row.scope_contexts)).toContainEqual(mention.scope);
      }
      if (!resource.originalResource) {
        // Added search snippets contain full original instructions, never a
        // fabricated direct URL or a source description for the added record.
        expect(row.body).toBe(
          [
            ...new Set(
              resource.derivedMentions.map(
                (mention) => mention.exactInstruction,
              ),
            ),
          ].join('\n\n'),
        );
      }
    }
    expect(
      store.native
        .prepare('SELECT * FROM temp.curriculum_search_bindings ORDER BY id')
        .all(),
    ).toEqual(publicRows);
    expect(
      store.native
        .prepare('SELECT * FROM temp.curriculum_search ORDER BY id')
        .all(),
    ).toEqual(originalRows);
    expect(
      store.native
        .prepare(
          "SELECT name FROM main.sqlite_master WHERE name LIKE 'curriculum_search%'",
        )
        .all(),
    ).toEqual([]);
    expect(fingerprint()).toBe(before);
  });
  it('finds every approved mention in its actual scope and reuses canonical and Practice identities once', () => {
    const candidate = readResourceMentionProjection(store, token);
    for (const mention of candidate.derivedMentions) {
      const resource = candidate.resources.find(
        (row) => row.id === mention.resourceId,
      )!;
      const query = {
        q: resource.title,
        kind: ['resource'],
        module: [mention.scope.module!],
        week: [mention.scope.week!],
        ...(mention.scope.day ? { day: [mention.scope.day] } : {}),
      };
      const result = namedSearch(query);
      expect(searchResponseSchema.safeParse(result).success).toBe(true);
      const found = result.results.filter((row) => row.id === resource.id);
      expect(found, mention.key).toHaveLength(1);
      expect(found[0]!.href).toBe(resource.href);
      expect(found[0]!.breadcrumbs).toEqual(
        JSON.parse(
          namedIndexRows().find((row) => row.id === resource.id)!.breadcrumbs,
        ),
      );
      const library = readResourceMentionLibrary(store, token, {
        q: query.q,
        module: query.module,
        week: query.week,
        ...(mention.scope.day ? { day: [mention.scope.day] } : {}),
      });
      expect(library.results.some((row) => row.id === resource.id)).toBe(true);
    }
    const practice = namedSearch({
      q: 'CS50 Practice',
      kind: ['resource'],
      week: ['w13', 'w14'],
    });
    expect(
      practice.results.filter(
        (row) => row.id === 'se-26w-v1:named-cs50-practice',
      ),
    ).toHaveLength(1);
    expect(
      namedIndexRows().filter((row) => row.id === 'se-26w-v1:res-10'),
    ).toHaveLength(1);
    expect(
      namedIndexRows().filter((row) => row.id === 'se-26w-v1:res-04'),
    ).toHaveLength(1);
    expect(
      namedIndexRows().some(
        (row) =>
          row.id.endsWith(':named-pg-library-docs') ||
          row.id.endsWith(':named-sqlite-library-docs'),
      ),
    ).toBe(false);
  });
  it('does not spread week-only references to days or combine unrelated source scopes', () => {
    for (const query of [
      { q: 'CS50 Practice', week: ['w13'], day: ['d085'] },
      { q: 'Express docs', week: ['w23'], day: ['d155'] },
      { q: 'Jest Getting Started', week: ['w23'], day: ['d025'] },
      { q: 'React DevTools', module: ['f1'], day: ['d144'] },
      { q: 'Git', week: ['w26'], day: ['d001'] },
    ]) {
      const result = namedSearch({ ...query, kind: ['resource'] });
      expect(
        result.results.filter((row) => row.id.includes(':named-')),
        JSON.stringify(query),
      ).toEqual([]);
    }
    expect(
      namedSearch({
        q: 'Node.js Docs',
        kind: ['resource'],
        week: ['w23'],
        day: ['d001'],
      }).results.some((row) => row.id === 'se-26w-v1:res-10'),
    ).toBe(false);
  });
  it('retains Unicode/literal matching, input validation, stable pagination and account/private-data guards', () => {
    const before = fingerprint();
    const accented = namedSearch({
      q: 'pročitati',
      kind: ['resource'],
      day: ['d001'],
    });
    expect(
      namedSearch({ q: 'procitati', kind: ['resource'], day: ['d001'] }),
    ).toMatchObject({
      results: accented.results,
      total: accented.total,
    });
    expect(
      accented.results.filter((row) => row.id.includes(':named-')),
    ).toHaveLength(4);
    for (const q of [
      "zzzz' OR 1=1 --",
      'JavaScript absentNamedNeedle',
      'first-private-named-sentinel',
      'second-private-named-sentinel',
    ])
      for (const session of [token, other])
        expect(namedSearch({ q }, session).total).toBe(0);
    for (const q of ['%', '_', '\\'])
      expect(namedSearch({ q }).total).toBeLessThan(plan.items.length);
    for (const input of [
      { projection: 'reviewed-mentions' },
      { q: 'x'.repeat(101) },
      { page: 0 },
      { kind: ['private'] },
    ])
      expect(() => namedSearch(input)).toThrow();
    for (const session of ['', 'invalid'])
      expect(() => namedSearch({ q: 'Git' }, session)).toThrowError(
        expect.objectContaining({ status: 401 }),
      );
    expect(() =>
      searchCurriculum(store, undefined, {}, undefined, 'reviewed-mentions'),
    ).toThrowError(expect.objectContaining({ status: 401 }));
    expect(() => namedSearch({ q: 'Git' }, unenrolled)).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
    expect(() =>
      namedSearch({ q: 'Git' }, token, requireStudent(store, other).id),
    ).toThrowError(expect.objectContaining({ status: 403 }));
    const first = namedSearch({ q: 'Git' });
    const pages = Array.from(
      { length: Math.ceil(first.total / 20) },
      (_, index) => namedSearch({ q: 'Git', page: index + 1 }).results,
    ).flat();
    expect(pages).toHaveLength(first.total);
    expect(new Set(pages.map((row) => row.id)).size).toBe(pages.length);
    expect(namedSearch({ q: 'Git' })).toEqual(first);
    expect(namedSearch({ q: 'Git' }, other)).toEqual(first);
    expect(namedSearch({ q: 'Git', page: 10000 }).results).toEqual([]);
    expect(namedSearch({}).results).toEqual([]);
    expect(fingerprint()).toBe(before);
  });
  it('validates frozen source, origins, ancestors and parent identities before returning a warm index', () => {
    const before = fingerprint();
    const expected = namedSearch({ q: 'Jest', kind: ['resource'] });
    const rows = namedIndexRows();
    for (const change of [
      (copy: Catalog) => {
        copy.blocks.find((row) => row.sourceLocator === 'p0274')!.exactText +=
          ' changed';
      },
      (copy: Catalog) => {
        copy.uses.find(
          (row) => row.id === frozen.mentions[0]!.origins[0]!.useId,
        )!.assignedText += ' changed';
      },
      (copy: Catalog) => {
        copy.items.find((row) => row.stableKey === 'w01')!.title += ' changed';
      },
      (copy: Catalog) => {
        copy.mappings.find(
          (row) =>
            row.websiteLocation === frozen.mentions[0]!.sourceMappingHref,
        )!.websiteLocation = '/resources';
      },
      (copy: Catalog) => {
        copy.resources.find((row) => row.stableKey === 'res-10')!.originalUrl =
          'https://example.test/drift';
      },
    ]) {
      const copy = structuredClone(catalog);
      change(copy);
      const stub = vi.spyOn(contentRead, 'readCatalog').mockReturnValue(copy);
      try {
        expect(() => namedSearch({ q: 'Jest' })).toThrowError(
          expect.objectContaining({ status: 503 }),
        );
      } finally {
        stub.mockRestore();
      }
      expect(namedSearch({ q: 'Jest', kind: ['resource'] })).toEqual(expected);
      expect(namedIndexRows()).toEqual(rows);
    }
    expect(fingerprint()).toBe(before);
  });
  it('recovers after caller rollback and missing rows and rolls back failed regeneration atomically', () => {
    const before = fingerprint();
    const expected = namedSearch({ q: 'Jest', kind: ['resource'] });
    store.native.exec('DROP TABLE temp.curriculum_search_mentions');
    expect(() =>
      store.native.transaction(() => {
        namedSearch({ q: 'Jest' });
        throw new Error('Named search caller rollback');
      })(),
    ).toThrow('Named search caller rollback');
    expect(
      store.native
        .prepare(
          "SELECT name FROM sqlite_temp_master WHERE name='curriculum_search_mentions'",
        )
        .get(),
    ).toBeUndefined();
    expect(namedSearch({ q: 'Jest', kind: ['resource'] })).toEqual(expected);
    store.native
      .prepare('DELETE FROM temp.curriculum_search_mentions WHERE id=?')
      .run('se-26w-v1:named-jest-getting-started');
    const incomplete = namedIndexRows();
    store.native.exec(
      "CREATE TEMP TRIGGER named_index_failure BEFORE INSERT ON curriculum_search_mentions BEGIN SELECT RAISE(ABORT, 'named index failure'); END",
    );
    try {
      expect(() => namedSearch({ q: 'Jest' })).toThrow('named index failure');
      expect(namedIndexRows()).toEqual(incomplete);
    } finally {
      store.native.exec('DROP TRIGGER temp.named_index_failure');
    }
    expect(namedSearch({ q: 'Jest', kind: ['resource'] })).toEqual(expected);
    expect(namedIndexRows()).toHaveLength(plan.items.length + 79);
    expect(fingerprint()).toBe(before);
  });
  it('retains unsupported-release raw fallback and rejects unavailable or foreign releases', () => {
    const before = fingerprint();
    const result = namedSearch(
      { q: 'Fallback', kind: ['resource'] },
      fallbackToken,
    );
    expect(result.releaseId).toBe(fallbackRelease);
    expect(result.total).toBe(1);
    expect(result.results[0]!.id).toBe(fallbackRelease + ':reference');
    expect(namedIndexRows(fallbackRelease)).toHaveLength(2);
    expect(namedSearch({ q: 'Fallback' }).total).toBe(0);
    const stub = vi.spyOn(contentRead, 'readCatalog').mockReturnValue(null);
    try {
      expect(() => namedSearch({ q: 'Git' })).toThrowError(
        expect.objectContaining({ status: 503 }),
      );
    } finally {
      stub.mockRestore();
    }
    expect(fingerprint()).toBe(before);
  });
  it('rebuilds the exact candidate after reseed/close/reopen while public library and Search stay unchanged', () => {
    const before = fingerprint();
    const candidate = namedSearch({
      q: 'Express docs',
      kind: ['resource'],
      week: ['w23'],
    });
    const rows = namedIndexRows();
    const publicSearch = searchCurriculum(store, token, {
      q: 'Express docs',
      kind: ['resource'],
    });
    const publicLibrary = readResourceLibrary(store, token, {});
    expect(importCurriculum(store, plan.source).imported).toBe(false);
    expect(
      namedSearch(
        { q: 'Express docs', kind: ['resource'], week: ['w23'] },
        other,
      ),
    ).toEqual(candidate);
    expect(namedIndexRows()).toEqual(rows);
    store.native.close();
    expect(() => namedSearch({ q: 'Express' })).toThrow();
    store = openDatabase(path.join(directory, 'learning.sqlite'));
    expect(
      store.native
        .prepare(
          "SELECT name FROM sqlite_temp_master WHERE name='curriculum_search_mentions'",
        )
        .get(),
    ).toBeUndefined();
    expect(
      namedSearch({ q: 'Express docs', kind: ['resource'], week: ['w23'] }),
    ).toEqual(candidate);
    expect(namedIndexRows()).toEqual(rows);
    expect(
      searchCurriculum(store, token, { q: 'Express docs', kind: ['resource'] }),
    ).toEqual(publicSearch);
    expect(readResourceLibrary(store, token, {})).toEqual(publicLibrary);
    expect(publicLibrary.total).toBe(69);
    expect(fingerprint()).toBe(before);
  });
});
