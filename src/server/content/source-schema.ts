import { z } from 'zod';
const key = z.string().min(1);
const refs = z.array(key);
const coordinate = z.number().int().positive();
export const sourceLinkSchema = z.object({
  label: z.string(),
  url: z
    .string()
    .url()
    .refine((value) => ['https:', 'http:'].includes(new URL(value).protocol)),
  anchor: z.string().nullable(),
});
const links = z.array(sourceLinkSchema);
export const sourceBlockSchema = z.object({
  source_id: key,
  style: z.string(),
  text: z.string(),
  links,
  in_table: z.boolean(),
  table: coordinate.optional(),
  row: coordinate.optional(),
  cell: coordinate.optional(),
});
const task = z.object({
  id: key,
  source_id: key,
  text: key,
  order: coordinate,
  requirement_mode: z.enum([
    'required',
    'optional',
    'conditional',
    'alternative',
    'mixed',
  ]),
  optional_override: z.boolean(),
  completion_rule: key,
  rule_origin: z.literal('product_interpretation'),
});
export const curriculumSourceSchema = z.object({
  schema_version: z.literal('1.0'),
  release_id: z.literal('se-26w-v1'),
  source: z.looseObject({
    filename: key,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    language: z.literal('sr-Latn'),
    paragraph_count: z.literal(2365),
    nonempty_paragraph_count: z.literal(2327),
    table_count: z.literal(197),
  }),
  modules: z
    .array(z.object({ id: key, title: key, weeks: z.array(coordinate) }))
    .length(6),
  weeks: z
    .array(
      z.object({
        id: key,
        number: coordinate,
        module_id: key,
        title: key,
        source_id: key,
        source_blocks: refs,
        days: refs,
        source_dates_and_phase: z.string(),
        objective: z.string(),
        resources_instruction: z.string(),
        phase_signal: z.string().default(''),
        main_evidence: z.string(),
        main_evidence_source_id: key,
        roadmap_source_ids: refs,
      }),
    )
    .length(26),
  days: z
    .array(
      z.object({
        id: key,
        number: coordinate,
        week_id: key,
        module_id: key,
        source_id: key,
        lesson_id: key,
        exercise_id: key,
        title: key,
        estimated_minutes: coordinate,
        source_date: key,
        study_instruction: z.string(),
        ai_policy: z.string(),
        completion_criterion: z.string(),
        tasks: z.array(task).min(1),
        source_blocks: refs,
        assessment_kind: z.enum([
          'practice',
          'weekly_checkpoint',
          'final_exam',
        ]),
        study_source_id: key,
        criterion_source_id: key,
        product_metadata: z.looseObject({
          difficulty: z.null(),
          exercise_minutes: z.null(),
          hints: z.array(z.never()),
          solution: z.null(),
          lesson_requirement: z.literal('required'),
          exercise_requirement: z.literal('required'),
          evidence_required: z.literal(true),
          completion: key,
        }),
      }),
    )
    .length(182),
  resources: z
    .array(
      z.object({
        id: key,
        title: key,
        url: sourceLinkSchema.shape.url,
        source_role: z.string(),
        source_ids: refs,
        url_origin: z.literal('source_hyperlink'),
        verification: z.literal('not_live_audited'),
      }),
    )
    .length(12),
  source_blocks: z.array(sourceBlockSchema).length(2365),
  source_mapping: z
    .array(
      z.object({
        source_id: key,
        source_heading: z.string(),
        source_table: coordinate.nullable(),
        source_row: coordinate.nullable(),
        source_cell: coordinate.nullable(),
        module_id: z.string(),
        week_id: z.string(),
        day_id: z.string(),
        role: key,
        website_location: key,
        source_text: z.string(),
        links,
      }),
    )
    .length(2329),
  other_text_parts: z.record(z.string(), z.array(z.string())),
  notes: z.array(z.string()),
  preparation: z
    .array(z.object({ id: key, source_id: key, text: key }))
    .length(7),
  scorecard: z.object({
    scale: z.array(key).length(4),
    dimensions: z.array(key).length(14),
    reminder_policy: key,
  }),
  resource_mentions: z
    .array(
      z.object({ source_id: key, context: key, exact_instruction: z.string() }),
    )
    .length(208),
  counts: z.record(z.string(), z.number().int().nonnegative()),
});
export type CurriculumSource = z.infer<typeof curriculumSourceSchema>;
export type OriginalBlock = z.infer<typeof sourceBlockSchema>;

export function validateSource(input: unknown): CurriculumSource {
  const s = curriculumSourceSchema.parse(input);
  const ensure = (condition: unknown, message: string) => {
    if (!condition) throw new Error(`Curriculum validation: ${message}`);
  };
  const unique = (ids: string[], name: string) =>
    ensure(new Set(ids).size === ids.length, `duplicate ${name}`);
  unique(
    s.source_blocks.map((b) => b.source_id),
    'source IDs',
  );
  unique(
    [
      ...s.modules,
      ...s.weeks,
      ...s.days,
      ...s.days.flatMap((d) => d.tasks),
      ...s.preparation,
    ]
      .map((i) => i.id)
      .concat(s.days.flatMap((d) => [d.lesson_id, d.exercise_id])),
    'content IDs',
  );
  unique(
    s.resources.map((r) => r.id),
    'resource IDs',
  );
  const blocks = new Map(s.source_blocks.map((b) => [b.source_id, b]));
  const block = (id: string) => {
    const b = blocks.get(id);
    ensure(b, `missing source ${id}`);
    return b!;
  };
  const sameText = (id: string, text: string) =>
    ensure(block(id).text === text, `text differs at ${id}`);
  s.source_blocks.forEach((b, i) => {
    ensure(
      b.source_id === `p${String(i + 1).padStart(4, '0')}`,
      'source order',
    );
    ensure(
      b.in_table === !!(b.table && b.row && b.cell),
      `table coordinates ${b.source_id}`,
    );
  });
  ensure(
    new Set(s.source_blocks.filter((b) => b.in_table).map((b) => b.table))
      .size === 197,
    'table count',
  );
  s.modules.forEach((m, i) => {
    ensure(m.id === `f${i + 1}`, 'phase order');
    ensure(
      JSON.stringify(m.weeks) ===
        JSON.stringify(
          s.weeks.filter((w) => w.module_id === m.id).map((w) => w.number),
        ),
      `phase weeks ${m.id}`,
    );
  });
  s.weeks.forEach((w, i) => {
    ensure(
      w.number === i + 1 && w.id === `w${String(i + 1).padStart(2, '0')}`,
      'week sequence',
    );
    ensure(
      s.modules.some((m) => m.id === w.module_id),
      'unknown phase',
    );
    ensure(
      JSON.stringify(w.days) ===
        JSON.stringify(
          s.days.filter((d) => d.week_id === w.id).map((d) => d.id),
        ) && w.days.length === 7,
      `week days ${w.id}`,
    );
    [...w.source_blocks, ...w.roadmap_source_ids, w.source_id].forEach(block);
    sameText(w.main_evidence_source_id, w.main_evidence);
    for (const text of [
      w.objective,
      w.resources_instruction,
      w.phase_signal,
      w.source_dates_and_phase,
    ])
      ensure(
        w.source_blocks.some((ref) => block(ref).text.includes(text)),
        `week context ${w.id}`,
      );
  });
  s.days.forEach((d, i) => {
    ensure(
      d.number === i + 1 && d.id === `d${String(i + 1).padStart(3, '0')}`,
      'day sequence',
    );
    ensure(
      d.lesson_id === `${d.id}-learn` && d.exercise_id === `${d.id}-practice`,
      'unit identity',
    );
    ensure(
      s.weeks.some((w) => w.id === d.week_id && w.module_id === d.module_id),
      'day parent',
    );
    d.source_blocks.forEach(block);
    block(d.source_id);
    ensure(
      block(d.study_source_id).text ===
        `Uči / pročitaj: ${d.study_instruction}`,
      `study source ${d.id}`,
    );
    ensure(
      block(d.criterion_source_id).text ===
        `Gotovo kada: ${d.completion_criterion}`,
      `criterion source ${d.id}`,
    );
    ensure(
      d.source_blocks.some(
        (ref) => block(ref).text === `AI režim: ${d.ai_policy}`,
      ),
      `AI source ${d.id}`,
    );
    ensure(
      d.source_blocks.some(
        (ref) => block(ref).text === `${d.source_date} — ${d.title}`,
      ),
      `title source ${d.id}`,
    );
    ensure(
      d.source_blocks.some(
        (ref) => block(ref).text === `Vreme: ${d.estimated_minutes} min`,
      ),
      `duration source ${d.id}`,
    );
    d.tasks.forEach((t, n) => {
      ensure(
        t.order === n + 1 &&
          t.id === `${d.id}-task-${String(n + 1).padStart(2, '0')}`,
        'task order',
      );
      sameText(t.source_id, t.text);
    });
  });
  ensure(s.days.reduce((n, d) => n + d.tasks.length, 0) === 548, 'task count');
  s.preparation.forEach((p) => sameText(p.source_id, p.text));
  for (const m of s.source_mapping) {
    const b = blocks.get(m.source_id);
    const text = b?.text ?? s.other_text_parts[m.source_id]?.join('\n');
    ensure(text === m.source_text, `mapping text ${m.source_id}`);
    ensure(
      JSON.stringify(b?.links ?? []) === JSON.stringify(m.links),
      `mapping links ${m.source_id}`,
    );
    ensure(
      (b?.table ?? null) === m.source_table &&
        (b?.row ?? null) === m.source_row &&
        (b?.cell ?? null) === m.source_cell,
      `mapping coordinates ${m.source_id}`,
    );
    ensure(
      /^\/(course\/software-engineer(?:\/[a-z0-9/-]+)?|resources|progress\/scorecard)(?:#[a-z0-9-]+)?$/.test(
        m.website_location,
      ),
      'invalid mapped route',
    );
  }
  const mapped = new Set(s.source_mapping.map((m) => m.source_id));
  ensure(
    s.source_blocks
      .filter((b) => b.text.trim())
      .every((b) => mapped.has(b.source_id)),
    'unmapped substantive source',
  );
  const originalLinks = s.source_blocks.flatMap((b) => b.links);
  ensure(
    originalLinks.length === 19 &&
      new Set(originalLinks.map((l) => l.url)).size === 12,
    'hyperlink counts',
  );
  s.resources.forEach((r) => {
    r.source_ids.forEach(block);
    ensure(
      originalLinks.some((l) => l.url === r.url),
      `resource URL ${r.id}`,
    );
  });
  const contexts = new Set([
    ...s.weeks.map((w) => w.id),
    ...s.days.map((d) => d.lesson_id),
  ]);
  s.resource_mentions.forEach((m) => {
    ensure(contexts.has(m.context), 'resource context');
    ensure(
      block(m.source_id).text.includes(m.exact_instruction),
      `resource instruction ${m.source_id}`,
    );
  });
  return s;
}
