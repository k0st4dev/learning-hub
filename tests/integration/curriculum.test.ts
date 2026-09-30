// @vitest-environment jsdom
import { beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { migrate } from '../../src/server/db/migrate.ts';
import { openDatabase, type Store } from '../../src/server/db/connection.ts';
import {
  loadArchivedCurriculum,
  importCurriculum,
} from '../../src/server/content/import.ts';
import {
  normalizeCurriculum,
  type CurriculumPlan,
} from '../../src/server/content/normalize.ts';
import { validateSource } from '../../src/server/content/source-schema.ts';
import { readCatalog, catalogPage } from '../../src/server/content/read.ts';
import { CurriculumPreview } from '../../src/components/curriculum-preview';
import { seedDay1Fixture } from '../../src/server/content/day1-fixture.ts';
import * as s from '../../src/server/db/schema.ts';
const root = process.cwd();
let plan: CurriculumPlan;
let directory: string;
let store: Store;
beforeAll(async () => {
  plan = await loadArchivedCurriculum(root);
});
beforeEach(async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.tmp/curriculum-test-'));
  await migrate(directory, root);
  store = openDatabase(path.join(directory, 'learning.sqlite'));
});
afterEach(async () => {
  store.native.close();
  if (
    path.dirname(directory) !== path.join(root, '.tmp') ||
    !path.basename(directory).startsWith('curriculum-test-')
  )
    throw new Error('Unexpected temporary path');
  await rm(directory, { recursive: true, force: true });
});
describe('complete immutable curriculum', () => {
  it('imports complete typed records, source mappings, original links and special task interpretations', () => {
    const result = importCurriculum(store, plan.source);
    expect(result.imported).toBe(true);
    expect(result.report).toMatchObject({
      phases: 6,
      weeks: 26,
      days: 182,
      lessons: 182,
      exercises: 182,
      tasks: 548,
      requiredUnits: 364,
      appendices: 7,
      scorecardDimensions: 14,
      mappings: 2329,
      hyperlinkOccurrences: 19,
    });
    const task = store.orm
      .select()
      .from(s.exerciseTask)
      .where(eq(s.exerciseTask.itemId, 'se-26w-v1:d125-task-01'))
      .get()!;
    expect(task.requirementMode).toBe('optional');
    expect(JSON.parse(task.ruleJson).completionRule).toContain('alternative');
    expect(store.native.pragma('foreign_key_check')).toEqual([]);
    expect(store.native.pragma('integrity_check', { simple: true })).toBe('ok');
  });
  it('keeps existing pinned enrollments and progress unchanged on initial import and repetition', async () => {
    await seedDay1Fixture(store.orm, root, directory);
    const userId = randomUUID(),
      enrollmentId = randomUUID(),
      now = Date.now();
    store.orm
      .insert(s.appUser)
      .values({
        id: userId,
        email: 'preserve@example.test',
        emailCanonical: 'preserve@example.test',
        passwordHash: 'test-only',
        createdAt: now,
        updatedAt: now,
      })
      .run();
    store.orm
      .insert(s.enrollment)
      .values({
        id: enrollmentId,
        userId,
        courseId: 'software-engineer',
        releaseId: 'development-day1-v1',
        startedAt: now,
      })
      .run();
    store.orm
      .insert(s.userProgress)
      .values({
        enrollmentId,
        releaseId: 'development-day1-v1',
        lessonId: 'development-day1-v1:d001-learn',
        status: 'completed',
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      })
      .run();
    const before = store.orm.select().from(s.userProgress).all();
    importCurriculum(store, plan.source);
    expect(importCurriculum(store, plan.source).imported).toBe(false);
    expect(store.orm.select().from(s.userProgress).all()).toEqual(before);
    expect(store.orm.select().from(s.enrollment).get()?.releaseId).toBe(
      'development-day1-v1',
    );
    expect(store.orm.select().from(s.appUser).get()?.id).toBe(userId);
    const changed = structuredClone(plan.source);
    changed.scorecard.reminder_policy += ' changed';
    expect(() => importCurriculum(store, changed)).toThrow('Immutable release');
    expect(store.orm.select().from(s.userProgress).all()).toEqual(before);
  });
  it('rolls back the entire import if any insert fails, then permits a clean retry', () => {
    store.native.exec(
      "CREATE TRIGGER import_failure BEFORE INSERT ON source_mapping BEGIN SELECT RAISE(ABORT, 'simulated import failure'); END;",
    );
    expect(() => importCurriculum(store, plan.source)).toThrow(
      'simulated import failure',
    );
    for (const table of [
      s.course,
      s.courseRelease,
      s.contentItem,
      s.resource,
      s.sourceBlock,
    ])
      expect(store.orm.select().from(table).all()).toHaveLength(0);
    store.native.exec('DROP TRIGGER import_failure');
    expect(importCurriculum(store, plan.source).imported).toBe(true);
  });
  it.each([
    'task-text',
    'source-map',
    'parent',
    'task-rule',
    'url',
    'order',
    'table',
  ])('rejects damaged input: %s', (kind) => {
    const damaged = structuredClone(plan.source);
    if (kind === 'task-text') damaged.days[0]!.tasks[0]!.text = 'omitted';
    if (kind === 'source-map')
      damaged.source_mapping[0]!.source_text = 'changed';
    if (kind === 'parent') damaged.days[0]!.week_id = 'missing';
    if (kind === 'task-rule')
      Object.assign(damaged.days[124]!.tasks[0]!, {
        requirement_mode: 'unreviewed',
      });
    if (kind === 'url') damaged.resources[0]!.url = 'javascript:alert(1)';
    if (kind === 'order') damaged.days.reverse();
    if (kind === 'table')
      damaged.source_blocks.find((b) => b.in_table)!.row = 9;
    expect(() => validateSource(damaged)).toThrow();
  });
  it('produces a deterministic manifest without timestamps', () => {
    expect(normalizeCurriculum(plan.source).manifestSha256).toBe(
      plan.manifestSha256,
    );
  });
  it('renders every mapped source paragraph, table coordinate, original hyperlink and target anchor', () => {
    importCurriculum(store, plan.source);
    const catalog = readCatalog(store, 'se-26w-v1')!;
    const rendered = new Map<string, Document>();
    for (const route of new Set(
      catalog.mappings.map((m) => m.websiteLocation.split('#')[0]!),
    )) {
      const page = catalogPage(catalog, route);
      expect(page, route).not.toBeNull();
      rendered.set(
        route,
        new DOMParser().parseFromString(
          renderToStaticMarkup(
            createElement(CurriculumPreview, { catalog, page: page! }),
          ),
          'text/html',
        ),
      );
    }
    let links = 0;
    for (const mapping of catalog.mappings) {
      const [route, anchor] = mapping.websiteLocation.split('#');
      const dom = rendered.get(route!)!;
      const block = catalog.blocks.find((b) => b.id === mapping.sourceBlockId)!;
      const element = Array.from(dom.querySelectorAll('[data-source-id]')).find(
        (e) => e.getAttribute('data-source-id') === block.sourceLocator,
      );
      expect(
        element?.querySelector('[data-source-text]')?.textContent,
        block.sourceLocator,
      ).toBe(block.exactText);
      if (anchor)
        expect(
          dom.getElementById(anchor),
          mapping.websiteLocation,
        ).not.toBeNull();
      if (block.tableNumber !== null) {
        expect(
          element?.closest('table')?.getAttribute('data-source-table'),
        ).toBe(String(block.tableNumber));
        expect(element?.closest('tr')?.getAttribute('data-source-row')).toBe(
          String(block.rowNumber),
        );
        expect(element?.closest('td')?.getAttribute('data-source-cell')).toBe(
          String(block.cellNumber),
        );
      }
      const expected = JSON.parse(block.linksJson) as {
        url: string;
        label: string;
      }[];
      const actual = Array.from(
        element!.querySelectorAll('[data-source-link]'),
      );
      expect(actual.map((a) => a.getAttribute('href'))).toEqual(
        expected.map((l) => l.url),
      );
      links += expected.length;
    }
    expect(links).toBe(19);
    for (const route of plan.report.routes)
      expect(catalogPage(catalog, route), route).not.toBeNull();
    // Exercise the rendered links too: the pure model alone cannot prove the UI uses them.
    const unitRoutes = plan.source.days.flatMap((day) => [
      `/course/software-engineer/days/${day.id}/lessons/${day.lesson_id}`,
      `/course/software-engineer/days/${day.id}/exercises/${day.exercise_id}`,
    ]);
    for (const [index, route] of unitRoutes.entries()) {
      const dom = rendered.get(route)!;
      const sequence = dom.querySelector('nav[aria-label="Study sequence"]');
      expect(
        sequence?.querySelector('a[rel="prev"]')?.getAttribute('href'),
      ).toBe(unitRoutes[index - 1] ?? '/course/software-engineer/preparation');
      expect(
        sequence?.querySelector('a[rel="next"]')?.getAttribute('href'),
      ).toBe(unitRoutes[index + 1] ?? '/course/software-engineer/progress');
      expect(dom.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    }
  }, 60000);
});
