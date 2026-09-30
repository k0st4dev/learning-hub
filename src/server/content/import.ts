import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Store } from '../db/connection.ts';
import * as s from '../db/schema.ts';
import { normalizeCurriculum, contentDigest } from './normalize.ts';

const manifestSchema = z.object({
  formatVersion: z.literal(1),
  releaseId: z.literal('se-26w-v1'),
  files: z
    .array(
      z.object({
        name: z.string().regex(/^[a-zA-Z0-9_-]+\.(md|html|json|csv|sql|docx)$/),
        bytes: z.number().int().positive(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .length(10),
});
export async function loadArchivedCurriculum(root: string) {
  const directory = path.join(root, 'content/se-26w-v1');
  const manifest = manifestSchema.parse(
    JSON.parse(
      await readFile(path.join(directory, 'source-manifest.json'), 'utf8'),
    ),
  );
  if (
    new Set(manifest.files.map((f) => f.name)).size !== 10 ||
    (await readdir(path.join(directory, 'source'))).length !== 10
  )
    throw new Error('Source archive inventory differs.');
  for (const file of manifest.files) {
    const bytes = await readFile(path.join(directory, 'source', file.name));
    const { createHash } = await import('node:crypto');
    if (
      bytes.length !== file.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== file.sha256
    )
      throw new Error(`Source archive changed: ${file.name}`);
  }
  const input: unknown = JSON.parse(
    await readFile(
      path.join(directory, 'source/curriculum-source.json'),
      'utf8',
    ),
  );
  const plan = normalizeCurriculum(input);
  if (
    manifest.files.find((f) => f.name === plan.source.source.filename)
      ?.sha256 !== plan.source.source.sha256
  )
    throw new Error('Original Word source hash differs.');
  return plan;
}
export function importCurriculum(store: Store, input: unknown) {
  // Rebuild from validated source inside this boundary: callers cannot inject a mutated row plan.
  const plan = normalizeCurriculum(input);
  return store.native
    .transaction(() => {
      const db = store.orm;
      const existing = db
        .select()
        .from(s.courseRelease)
        .where(eq(s.courseRelease.id, plan.releaseId))
        .get();
      if (existing) {
        if (
          existing.manifestSha256 !== plan.manifestSha256 ||
          existing.status !== 'published'
        )
          throw new Error(
            'Immutable release differs. Create a reviewed new release; existing student records were not changed.',
          );
        return { imported: false, report: plan.report };
      }
      const now = Date.now();
      db.insert(s.course)
        .values({
          id: 'software-engineer',
          slug: 'software-engineer',
          title: 'Software Engineer Training Manual',
          createdAt: now,
        })
        .onConflictDoNothing()
        .run();
      db.insert(s.courseRelease)
        .values({
          id: plan.releaseId,
          courseId: 'software-engineer',
          version: plan.releaseId,
          status: 'draft',
          sourceFilename: plan.source.source.filename,
          sourceSha256: plan.source.source.sha256,
          manifestSha256: plan.manifestSha256,
          createdAt: now,
        })
        .run();
      for (const value of plan.items)
        db.insert(s.contentItem).values(value).run();
      for (const value of plan.modules)
        db.insert(s.courseModule).values(value).run();
      for (const value of plan.weeks)
        db.insert(s.courseWeek).values(value).run();
      for (const value of plan.days) db.insert(s.courseDay).values(value).run();
      for (const value of plan.lessons) db.insert(s.lesson).values(value).run();
      for (const value of plan.exercises)
        db.insert(s.exercise).values(value).run();
      for (const value of plan.tasks)
        db.insert(s.exerciseTask).values(value).run();
      for (const value of plan.resources)
        db.insert(s.resource).values(value).run();
      for (const value of plan.uses)
        db.insert(s.resourceUse).values(value).run();
      for (const value of plan.blocks)
        db.insert(s.sourceBlock).values(value).run();
      for (const value of plan.mappings)
        db.insert(s.sourceMapping).values(value).run();
      const stored = db
        .select()
        .from(s.sourceBlock)
        .where(eq(s.sourceBlock.releaseId, plan.releaseId))
        .all();
      if (
        stored.length !== plan.blocks.length ||
        stored.some((b) => contentDigest(b.exactText) !== b.textSha256)
      )
        throw new Error('Stored source text verification failed.');
      if ((store.native.pragma('foreign_key_check') as unknown[]).length)
        throw new Error('Import foreign-key verification failed.');
      if (
        db
          .select()
          .from(s.contentItem)
          .where(
            and(
              eq(s.contentItem.releaseId, plan.releaseId),
              eq(s.contentItem.required, 1),
            ),
          )
          .all().length !== 364
      )
        throw new Error('Required-unit count differs.');
      db.update(s.courseRelease)
        .set({ status: 'published', publishedAt: now })
        .where(eq(s.courseRelease.id, plan.releaseId))
        .run();
      return { imported: true, report: plan.report };
    })
    .immediate();
}
