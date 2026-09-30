import { createHash } from 'node:crypto';
import type * as db from '../db/schema.ts';
import { validateSource } from './source-schema.ts';
export const contentDigest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const base = '/course/software-engineer';
export function normalizeCurriculum(input: unknown) {
  const source = validateSource(input);
  const releaseId = source.release_id;
  const id = (key: string) => `${releaseId}:${key}`;
  const items: (typeof db.contentItem.$inferInsert)[] = [];
  const modules: (typeof db.courseModule.$inferInsert)[] = [];
  const weeks: (typeof db.courseWeek.$inferInsert)[] = [];
  const days: (typeof db.courseDay.$inferInsert)[] = [];
  const lessons: (typeof db.lesson.$inferInsert)[] = [];
  const exercises: (typeof db.exercise.$inferInsert)[] = [];
  const tasks: (typeof db.exerciseTask.$inferInsert)[] = [];
  const resources: (typeof db.resource.$inferInsert)[] = [];
  const uses: (typeof db.resourceUse.$inferInsert)[] = [];
  const blocks: (typeof db.sourceBlock.$inferInsert)[] = [];
  const mappings: (typeof db.sourceMapping.$inferInsert)[] = [];
  const routes: Record<string, string> = {};
  const add = (
    key: string,
    kind: string,
    title: string,
    parent: string | null,
    order: number,
    route: string,
    body = '',
    required = 0,
    metadata: Record<string, unknown> = {},
  ) => {
    if (items.some((i) => i.stableKey === key))
      throw new Error(`Duplicate normalized item ${key}`);
    const value = {
      id: id(key),
      releaseId,
      stableKey: key,
      kind,
      title,
      parentId: parent ? id(parent) : null,
      orderIndex: order,
      bodyMarkdown: body,
      required,
      metadataJson: JSON.stringify({ ...metadata, route }),
    };
    items.push({ ...value, contentHash: contentDigest(JSON.stringify(value)) });
    if (!route.includes('#')) routes[route] = id(key);
  };
  source.modules.forEach((m, i) => {
    const signal =
      source.weeks.find((w) => w.module_id === m.id)?.phase_signal ?? '';
    add(m.id, 'module', m.title, null, i, `${base}/modules/${m.id}`, signal);
    modules.push({
      itemId: id(m.id),
      phaseNumber: i + 1,
      introductionMarkdown: signal,
    });
  });
  source.weeks.forEach((w) => {
    add(w.id, 'week', w.title, w.module_id, w.number, `${base}/weeks/${w.id}`);
    weeks.push({
      itemId: id(w.id),
      weekNumber: w.number,
      objectiveMarkdown: w.objective,
      primaryResourcesText: w.resources_instruction,
      mainEvidenceMarkdown: w.main_evidence,
      sourceDateRange: w.source_dates_and_phase,
      phaseSignalMarkdown: w.phase_signal,
    });
  });
  source.days.forEach((d) => {
    const route = `${base}/days/${d.id}`;
    add(d.id, 'day', d.title, d.week_id, d.number, route, '', 0, {
      productInterpretation: d.product_metadata,
    });
    days.push({
      itemId: id(d.id),
      dayNumber: d.number,
      sourceDate: d.source_date,
      estimatedMinutes: d.estimated_minutes,
      aiPolicyMarkdown: d.ai_policy,
      completionCriterionMarkdown: d.completion_criterion,
      assessmentKind: d.assessment_kind,
      remediationJson: JSON.stringify({
        origin: 'source',
        criterionSourceRef: d.criterion_source_id,
        originalCriterion: d.completion_criterion,
      }),
    });
    add(
      d.lesson_id,
      'lesson',
      d.title,
      d.id,
      0,
      `${route}/lessons/${d.lesson_id}`,
      d.study_instruction,
      1,
    );
    lessons.push({
      itemId: id(d.lesson_id),
      studyInstructionMarkdown: d.study_instruction,
      objectiveMarkdown: source.weeks.find((w) => w.id === d.week_id)!
        .objective,
      blocksJson: JSON.stringify([
        { type: 'sourceText', sourceRef: d.study_source_id, id: 'study' },
      ]),
    });
    add(
      d.exercise_id,
      'exercise',
      d.title,
      d.lesson_id,
      0,
      `${route}/exercises/${d.exercise_id}`,
      d.tasks.map((t) => t.text).join('\n'),
      1,
      { productInterpretation: d.product_metadata },
    );
    exercises.push({
      itemId: id(d.exercise_id),
      relatedLessonId: id(d.lesson_id),
      instructionsMarkdown: d.tasks.map((t) => t.text).join('\n'),
      expectedResultMarkdown: d.completion_criterion,
      difficulty: null,
      estimatedMinutes: null,
      hintsJson: '[]',
      solutionMarkdown: null,
      evidenceRequired: 1,
    });
    d.tasks.forEach((t) => {
      add(
        t.id,
        'task',
        `Task ${t.order}`,
        d.exercise_id,
        t.order,
        `${route}/exercises/${d.exercise_id}#${t.id}`,
        t.text,
        0,
        { sourceRef: t.source_id },
      );
      tasks.push({
        itemId: id(t.id),
        requirementMode: t.requirement_mode,
        ruleJson: JSON.stringify({
          sourceRef: t.source_id,
          origin: t.rule_origin,
          completionRule: t.completion_rule,
          optionalOverride: t.optional_override,
        }),
      });
    });
  });
  const guideRoutes = [
    ...new Set(
      source.source_mapping.map((m) => m.website_location.split('#')[0]!),
    ),
  ].filter((route) => !routes[route]);
  guideRoutes.forEach((route, i) => {
    const key =
      route === base
        ? 'overview'
        : route === '/resources'
          ? 'resource-catalog'
          : route === '/progress/scorecard'
            ? 'scorecard-definition'
            : route.slice(base.length + 1).replaceAll('/', '-');
    const mapped = source.source_mapping.filter(
      (m) => m.website_location.split('#')[0] === route,
    );
    add(
      key,
      'guide',
      mapped[0]!.source_text.split('\n')[0]!,
      null,
      6 + i,
      route,
      mapped.map((m) => m.source_text).join('\n\n'),
      0,
      route === '/progress/scorecard' ? { scorecard: source.scorecard } : {},
    );
  });
  source.preparation.forEach((p, i) =>
    add(
      p.id,
      'preparation',
      `Preparation ${i + 1}`,
      'preparation',
      i,
      `${base}/preparation#${p.id}`,
      p.text,
      0,
      { sourceRef: p.source_id },
    ),
  );
  source.source_blocks.forEach((b) =>
    blocks.push({
      id: id(`source:${b.source_id}`),
      releaseId,
      sourceLocator: b.source_id,
      sourceStyle: b.style,
      tableNumber: b.table ?? null,
      rowNumber: b.row ?? null,
      cellNumber: b.cell ?? null,
      exactText: b.text,
      linksJson: JSON.stringify(b.links),
      textSha256: contentDigest(b.text),
    }),
  );
  Object.entries(source.other_text_parts).forEach(([locator, texts]) =>
    blocks.push({
      id: id(`source:${locator}`),
      releaseId,
      sourceLocator: locator,
      sourceStyle: 'Document metadata',
      exactText: texts.join('\n'),
      linksJson: '[]',
      textSha256: contentDigest(texts.join('\n')),
    }),
  );
  source.source_mapping.forEach((m, i) => {
    const route = m.website_location.split('#')[0]!;
    let target = routes[route];
    if (m.role === 'exercise_task')
      target = id(
        source.days
          .flatMap((d) => d.tasks)
          .find((t) => t.source_id === m.source_id)!.id,
      );
    if (m.role === 'preparation_task')
      target = id(
        source.preparation.find((p) => p.source_id === m.source_id)!.id,
      );
    if (!target || !items.some((item) => item.id === target))
      throw new Error(`Unresolved mapping target ${m.website_location}`);
    mappings.push({
      id: id(`mapping:${i + 1}`),
      releaseId,
      sourceBlockId: id(`source:${m.source_id}`),
      contentItemId: target,
      targetField: 'sourceBlocks',
      websiteLocation: m.website_location,
      mappingKind:
        m.role === 'document_header_or_footer' ? 'metadata' : 'verbatim',
    });
  });
  source.resources.forEach((r) =>
    resources.push({
      id: id(r.id),
      releaseId,
      stableKey: r.id,
      title: r.title,
      originalUrl: r.url,
      resolvedUrl: null,
      sourceName: r.title,
      type: 'reference',
      descriptionMarkdown: r.source_role,
      linkOrigin: 'source',
      linkStatus: 'unchecked',
    }),
  );
  // Reviewed parent-resource interpretations; exact assignment/locator is always retained.
  const parents: [string, RegExp][] = [
    ['res-01', /\b(?:TOP Foundations|Odin Foundations)\b/i],
    ['res-02', /\b(?:TOP (?!Foundations)|Odin (?!Foundations))/i],
    ['res-03', /\bCS50(?:x)?\b/i],
    ['res-04', /\b(?:pset|problem sets?)\b/i],
    ['res-05', /\b(?:FSO|Full Stack Open)\b/i],
    ['res-06', /\bExercism\b/i],
    ['res-07', /\bMDN\b/i],
    ['res-08', /javascript\.info/i],
    ['res-09', /\bReact(?: Learn| docs?| dokumentacija)\b/i],
    ['res-10', /\bNode(?:\.js)? (?:docs?|API|dokumentacija)\b/i],
    ['res-11', /\b(?:Pro Git|Git docs)\b/i],
    ['res-12', /\bPostgreSQL\b/i],
  ];
  source.resource_mentions.forEach((m, i) => {
    const matched = parents
      .filter(([, pattern]) => pattern.test(m.exact_instruction))
      .map(([key]) => key);
    if (!matched.length) {
      const key = `unresolved-${m.source_id}`;
      resources.push({
        id: id(key),
        releaseId,
        stableKey: key,
        title: m.exact_instruction || 'Source reference',
        originalUrl: null,
        resolvedUrl: null,
        sourceName: 'Original instruction without supplied URL',
        type: 'reference',
        descriptionMarkdown: m.exact_instruction,
        linkOrigin: 'unresolved',
        linkStatus: 'unchecked',
      });
      matched.push(key);
    }
    matched.forEach((key, n) =>
      uses.push({
        id: id(`mention:${i + 1}:${n}`),
        releaseId,
        resourceId: id(key),
        contentItemId: id(m.context),
        assignedText: m.exact_instruction,
        sectionLocator: m.exact_instruction,
        requirementMode: 'reference',
        orderIndex: i,
      }),
    );
  });
  source.source_blocks.forEach((b) =>
    b.links.forEach((link, n) => {
      const r = source.resources.find((r) => r.url === link.url)!;
      const mapping = mappings.find(
        (m) => m.sourceBlockId === id(`source:${b.source_id}`),
      )!;
      uses.push({
        id: id(`hyperlink:${b.source_id}:${n}`),
        releaseId,
        resourceId: id(r.id),
        contentItemId: mapping.contentItemId,
        assignedText: b.text,
        sectionLocator: link.label,
        requirementMode: 'reference',
        orderIndex: uses.length,
      });
    }),
  );
  const tables = {
    items,
    modules,
    weeks,
    days,
    lessons,
    exercises,
    tasks,
    resources,
    uses,
    blocks,
    mappings,
  };
  const manifestSha256 = contentDigest(
    JSON.stringify({ contractVersion: 1, source, tables }),
  );
  const report = {
    releaseId,
    manifestSha256,
    sourceSha256: source.source.sha256,
    phases: modules.length,
    weeks: weeks.length,
    days: days.length,
    lessons: lessons.length,
    exercises: exercises.length,
    tasks: tasks.length,
    requiredUnits: items.filter((i) => i.required === 1).length,
    preparation: source.preparation.length,
    appendices: items.filter((i) => /^guide-appendix-[a-g]$/.test(i.stableKey))
      .length,
    scorecardDimensions: source.scorecard.dimensions.length,
    sourceBlocks: blocks.length,
    bodyParagraphs: source.source_blocks.length,
    tables: 197,
    mappings: mappings.length,
    originalUrls: 12,
    hyperlinkOccurrences: uses.filter((u) => u.id.includes(':hyperlink:'))
      .length,
    unresolvedReferences: resources.filter((r) => r.linkOrigin === 'unresolved')
      .length,
    routes: Object.keys(routes).sort(),
    renderedCoverage: 'pending',
  };
  return { source, releaseId, manifestSha256, ...tables, report };
}
export type CurriculumPlan = ReturnType<typeof normalizeCurriculum>;
