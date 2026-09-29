import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Orm } from '../db/connection.ts';
import * as s from '../db/schema.ts';

const fixtureSchema = z.object({
  fixtureOnly: z.literal(true),
  releaseId: z.literal('development-day1-v1'),
  source: z.object({ filename: z.string(), sha256: z.string().length(64) }),
  module: z.object({ id: z.string(), title: z.string() }),
  week: z.object({
    id: z.string(),
    title: z.string(),
    number: z.number(),
    objective: z.string(),
    resources_instruction: z.string(),
    main_evidence: z.string(),
    source_dates_and_phase: z.string(),
    phase_signal: z.string(),
  }),
  day: z.object({
    id: z.literal('d001'),
    number: z.literal(1),
    title: z.string(),
    source_date: z.string(),
    estimated_minutes: z.number(),
    study_instruction: z.string(),
    ai_policy: z.string(),
    completion_criterion: z.string(),
    lesson_id: z.string(),
    exercise_id: z.string(),
    tasks: z
      .array(
        z.object({
          id: z.string(),
          source_id: z.string(),
          text: z.string(),
          order: z.number(),
          requirement_mode: z.literal('required'),
        }),
      )
      .length(4),
  }),
  preparation: z
    .array(z.object({ id: z.string(), text: z.string() }))
    .length(7),
});
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export async function seedDay1Fixture(db: Orm, root: string, dataDir: string) {
  const demoRoot = path.join(root, '.tmp');
  if (!path.resolve(dataDir).startsWith(demoRoot + path.sep))
    throw new Error(
      'Development fixture is allowed only in this repository .tmp directory.',
    );
  const raw = await readFile(
    path.join(root, 'tests/fixtures/day1.json'),
    'utf8',
  );
  const f = fixtureSchema.parse(JSON.parse(raw));
  const manifestHash = digest(raw);
  const existing = db
    .select()
    .from(s.courseRelease)
    .where(eq(s.courseRelease.id, f.releaseId))
    .get();
  if (existing) {
    if (existing.manifestSha256 !== manifestHash)
      throw new Error(
        'Immutable fixture release changed. Use a new fixture version.',
      );
    return;
  }
  const key = (stable: string) => `${f.releaseId}:${stable}`;
  db.transaction((tx) => {
    tx.insert(s.course)
      .values({
        id: 'software-engineer',
        slug: 'software-engineer',
        title: 'Software Engineer Training Manual',
        createdAt: Date.now(),
      })
      .run();
    tx.insert(s.courseRelease)
      .values({
        id: f.releaseId,
        courseId: 'software-engineer',
        version: f.releaseId,
        status: 'published',
        sourceFilename: f.source.filename,
        sourceSha256: f.source.sha256,
        manifestSha256: manifestHash,
        publishedAt: Date.now(),
        createdAt: Date.now(),
      })
      .run();
    const item = (
      stableKey: string,
      kind: string,
      title: string,
      parent: string | null,
      orderIndex: number,
      bodyMarkdown = '',
      required = 0,
    ) =>
      tx
        .insert(s.contentItem)
        .values({
          id: key(stableKey),
          releaseId: f.releaseId,
          stableKey,
          kind,
          title,
          parentId: parent ? key(parent) : null,
          orderIndex,
          bodyMarkdown,
          required,
          contentHash: digest(title + '\n' + bodyMarkdown),
          metadataJson: JSON.stringify({ fixtureOnly: true }),
        })
        .run();
    item(f.module.id, 'module', f.module.title, null, 0);
    tx.insert(s.courseModule)
      .values({ itemId: key(f.module.id), phaseNumber: 1 })
      .run();
    item(f.week.id, 'week', f.week.title, f.module.id, 0);
    tx.insert(s.courseWeek)
      .values({
        itemId: key(f.week.id),
        weekNumber: 1,
        objectiveMarkdown: f.week.objective,
        primaryResourcesText: f.week.resources_instruction,
        mainEvidenceMarkdown: f.week.main_evidence,
        sourceDateRange: f.week.source_dates_and_phase,
        phaseSignalMarkdown: f.week.phase_signal,
      })
      .run();
    const d = f.day;
    item(d.id, 'day', d.title, f.week.id, 0);
    tx.insert(s.courseDay)
      .values({
        itemId: key(d.id),
        dayNumber: d.number,
        sourceDate: d.source_date,
        estimatedMinutes: d.estimated_minutes,
        aiPolicyMarkdown: d.ai_policy,
        completionCriterionMarkdown: d.completion_criterion,
        assessmentKind: 'practice',
      })
      .run();
    item(d.lesson_id, 'lesson', d.title, d.id, 0, d.study_instruction, 1);
    tx.insert(s.lesson)
      .values({
        itemId: key(d.lesson_id),
        studyInstructionMarkdown: d.study_instruction,
        objectiveMarkdown: f.week.objective,
      })
      .run();
    item(
      d.exercise_id,
      'exercise',
      d.title,
      d.lesson_id,
      0,
      d.tasks.map((t) => t.text).join('\n'),
      1,
    );
    tx.insert(s.exercise)
      .values({
        itemId: key(d.exercise_id),
        relatedLessonId: key(d.lesson_id),
        instructionsMarkdown: d.tasks.map((t) => t.text).join('\n'),
        expectedResultMarkdown: d.completion_criterion,
      })
      .run();
    for (const t of d.tasks) {
      item(t.id, 'task', `Task ${t.order}`, d.exercise_id, t.order, t.text);
      tx.insert(s.exerciseTask)
        .values({ itemId: key(t.id), requirementMode: 'required' })
        .run();
    }
    item('preparation', 'guide', 'Preparation', null, 1);
    for (const [i, p] of f.preparation.entries())
      item(
        p.id,
        'preparation',
        `Preparation ${i + 1}`,
        'preparation',
        i,
        p.text,
      );
  });
}
