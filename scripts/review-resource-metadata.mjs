// Review artifacts only. Never called by setup/import or the running application.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import { loadArchivedCurriculum } from '../src/server/content/import.ts';

const root = path.resolve(import.meta.dirname, '..');
assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 && process.argv[2] === '--check'),
);
const plan = await loadArchivedCurriculum(root);
const source = plan.source;
const prefix = plan.releaseId + ':';
const key = (id) => id.slice(prefix.length);
const digest = (text) => createHash('sha256').update(text).digest('hex');
const bySource = new Map(
  source.source_blocks.map((block) => [block.source_id, block]),
);
const byItem = new Map(plan.items.map((item) => [item.id, item]));
const byResource = new Map(
  plan.resources.map((resource) => [resource.id, resource]),
);
const canonical = new Map(
  source.resources.map((resource) => [resource.id, resource]),
);
const definitions = {
  'res-01': ['course', 'The Odin Project', 'high'],
  'res-02': ['course', 'The Odin Project', 'high'],
  'res-03': ['course', 'CS50', 'high'],
  'res-04': ['practice', 'CS50', 'high'],
  'res-05': ['course', 'Full Stack Open', 'high'],
  'res-06': ['practice', 'Exercism', 'high'],
  'res-07': ['documentation', 'MDN', 'high'],
  'res-08': ['article', 'javascript.info', 'medium'],
  'res-09': ['documentation', 'React', 'high'],
  'res-10': ['documentation', 'Node.js', 'high'],
  'res-11': ['reference', 'Pro Git', 'high'],
  'res-12': ['documentation', 'PostgreSQL', 'high'],
};
const rules = {
  'catalog-reference':
    'Catalog/source-status links are references, not a new assignment.',
  'weekly-overview':
    'Weekly resource lists are overview references; explicit optional clauses take priority.',
  'daily-assignment':
    'A named resource in Uči / pročitaj is assigned reading of the named section only (p0025). No external course-wide completion is implied.',
  'as-needed-reference':
    'po potrebi/as reference/preview or personal notes remain supporting references; not mandatory external coursework.',
  'explicit-optional':
    'An explicit optional clause, or its same-provider weekly optional designation, is optional.',
  'alternative-choice':
    'An explicit alternative is conditional on the selected route; do not require both sources.',
  'used-topics-condition':
    'Only the topics used in the learner project are applicable; do not prescribe the whole course/docs.',
  'problem-set-primary':
    'The selected problem-set registry is the assigned source; the general CS50 parent is reference navigation.',
  'manual-instruction':
    'This record preserves a source instruction/review topic, not a newly supplied external learning link.',
  'unspecified-documentation':
    'Documentation is specified but its provider/library is not; retain this uncertainty.',
  'resource-restriction':
    'Preserve the exact no-new-resource/no-tutorial/first-120-minutes restriction; never turn it into a resource requirement.',
};
function coordinates(itemId) {
  const visited = new Set();
  let item = byItem.get(itemId);
  const result = { module: null, week: null, day: null };
  while (item) {
    assert.ok(!visited.has(item.id));
    visited.add(item.id);
    if (Object.hasOwn(result, item.kind)) result[item.kind] = item.stableKey;
    item = item.parentId ? byItem.get(item.parentId) : undefined;
  }
  return result;
}
const resources = plan.resources.map((raw) => {
  const original = canonical.get(raw.stableKey);
  const refs = original?.source_ids ?? [
    raw.stableKey.replace('unresolved-', ''),
  ];
  const text = original?.source_role ?? raw.title;
  let proposed;
  if (original) {
    const [type, provider, confidence] = definitions[raw.stableKey];
    proposed = {
      type,
      provider,
      confidence,
      category: 'named-resource',
      rationale:
        'Title and role in the original resource table. Type/provider are added presentation interpretations.',
    };
    if (raw.stableKey === 'res-08')
      proposed.rationale +=
        ' Tutorial/reference is mapped to article in the allowed vocabulary; this is a product choice, not a claim that the source specifies that type.';
  } else if (raw.stableKey === 'unresolved-p1679') {
    proposed = {
      type: 'documentation',
      provider: null,
      confidence: 'medium',
      category: 'composite-reference',
      rationale:
        'Node pg/sqlite library docs names multiple potential libraries; no library URL/provider selection is supplied.',
    };
  } else if (raw.stableKey === 'unresolved-p1604') {
    proposed = {
      type: 'documentation',
      provider: null,
      confidence: 'medium',
      category: 'unspecified-reference',
      rationale:
        'The source requests documentation but does not name a provider.',
    };
  } else if (/Dokumentacija|dokumentaciju/.test(text)) {
    proposed = {
      type: 'reference',
      provider: null,
      confidence: 'medium',
      category: 'composite-reference',
      rationale:
        'As-needed documentation and/or own notes are combined. A single external provider or mandatory documentation set cannot be inferred.',
    };
  } else {
    proposed = {
      type: 'guide',
      provider: 'Original manual',
      confidence: 'high',
      category: 'source-instruction',
      rationale:
        'This is original internal study/review guidance, not an external named website. Keep its exact wording and existing destination.',
    };
  }
  return {
    resourceId: raw.id,
    raw,
    proposed,
    evidenceRefs: refs,
    ambiguity: proposed.confidence !== 'high',
  };
});
const parentSuggestions = [];
const uses = plan.uses.map((raw) => {
  const useKey = key(raw.id);
  const mention = /^mention:(\d+):\d+$/.exec(useKey);
  const sourceId = mention
    ? source.resource_mentions[Number(mention[1]) - 1].source_id
    : useKey.split(':')[1];
  const resourceKey = key(raw.resourceId);
  const resource = byResource.get(raw.resourceId);
  const scope = coordinates(raw.contentItemId);
  const week = source.weeks.find((row) => row.id === scope.week);
  const text = raw.assignedText;
  let mode = 'reference';
  let rule = mention ? 'weekly-overview' : 'catalog-reference';
  const evidence = new Set([sourceId]);
  const caveats = [];
  let choiceGroup = null;
  if (mention && scope.day) {
    if (resource.linkOrigin !== 'unresolved') {
      mode = 'required';
      rule = 'daily-assignment';
      evidence.add('p0025');
      if (resourceKey === 'res-03' && /Pset\d|Problem Set \d/i.test(text)) {
        mode = 'reference';
        rule = 'problem-set-primary';
      }
      if (
        (sourceId === 'p0530' && resourceKey === 'res-02') ||
        sourceId === 'p1152'
      ) {
        mode = 'conditional';
        rule = 'alternative-choice';
        choiceGroup = 'choice:' + sourceId;
        caveats.push(
          'The source allows another route; consultation of both sources is not required. Missing alternative mentions are listed separately.',
        );
      }
      if (sourceId === 'p1831') {
        mode = 'conditional';
        rule = 'used-topics-condition';
      }
      if (
        (sourceId === 'p0767' && resourceKey === 'res-07') ||
        (sourceId === 'p1629' && resourceKey === 'res-12') ||
        (sourceId === 'p1866' && resourceKey === 'res-09') ||
        sourceId === 'p2188'
      ) {
        mode = 'reference';
        rule = 'as-needed-reference';
      }
      if (resourceKey === 'res-02' && scope.week === 'w17') {
        mode = 'optional';
        rule = 'explicit-optional';
        evidence.add('p1475');
        if (sourceId !== 'p1479')
          caveats.push(
            'Optional status is inherited only for the TOP data-structure supplement from this week; CS50 remains assigned.',
          );
      }
      if (sourceId === 'p1629')
        caveats.push(
          'Do not apply the PostgreSQL/SQLite po potrebi clause to the CS50 lecture. SQLite has no supplied URL.',
        );
      if (sourceId === 'p0917')
        caveats.push(
          'TOP is the assigned course; the separate ESLint getting-started mention is only po potrebi.',
        );
    } else {
      rule = 'manual-instruction';
      if (['p1604', 'p1679'].includes(sourceId)) {
        mode = 'required';
        rule = 'unspecified-documentation';
        caveats.push(
          'Assigned documentation/concept work, but no external library/provider or full documentation set is prescribed. Preserve learner choice.',
        );
      }
      if (
        /Bez novih resursa|Bez nove teorije|Bez tutoriala|Bez resursa/.test(
          text,
        )
      ) {
        rule = 'resource-restriction';
        caveats.push(
          'Source restriction is retained; this label does not remove the independently required study/review unit.',
        );
      }
      if (['p1756', 'p1906', 'p2131'].includes(sourceId)) {
        mode = 'required';
        rule = 'daily-assignment';
        evidence.add('p0025');
        const weeklyMention = source.resource_mentions.find(
          (row) => row.context === week.id,
        );
        assert.ok(weeklyMention);
        evidence.add(weeklyMention.source_id);
        caveats.push(
          'The FSO scope follows the original weekly course context and selected core exercises, not a newly invented complete-course requirement.',
        );
        parentSuggestions.push({
          useId: raw.id,
          proposedParentResourceKey: 'res-05',
          evidenceRefs: [...evidence],
          reason:
            'Implicit Part/core-exercise instruction belongs to the explicit FSO weekly context. Preserve the raw instruction record as well.',
        });
      }
    }
  }
  if (
    mention &&
    !scope.day &&
    resourceKey === 'res-02' &&
    scope.week === 'w17'
  ) {
    mode = 'optional';
    rule = 'explicit-optional';
  }
  const weekNumber = scope.week ? Number(scope.week.slice(1)) : null;
  if (resourceKey === 'res-02' && weekNumber !== null && weekNumber <= 6) {
    parentSuggestions.push({
      useId: raw.id,
      proposedParentResourceKey: 'res-01',
      evidenceRefs: [sourceId, 'p0084', 'p0087'],
      reason:
        'Generic TOP assignment in Foundations weeks 1–6; the importer literal-parent heuristic currently uses the later JavaScript course.',
    });
    caveats.push(
      'Parent binding correction proposed separately; no runtime relationship has changed.',
    );
  }
  return {
    useId: raw.id,
    raw,
    scope,
    sourceId,
    proposed: { requirementMode: mode, rule, choiceGroup },
    evidenceRefs: [...evidence],
    caveats,
    ambiguity: caveats.length > 0 || mode === 'conditional',
  };
});

// Individually reviewed missing/hidden names. No direct URL is invented.
const extraDefinitions = [
  ['p0274', 'Node runtime', 'tool', 'Node.js', 'required', null, null],
  ['p0274', 'nvm', 'tool', 'nvm', 'required', null, null],
  ['p0274', 'VS Code', 'tool', 'VS Code', 'required', null, null],
  ['p0274', 'Git', 'tool', 'Git', 'required', null, null],
  [
    'p0530',
    'Jest Getting Started',
    'documentation',
    'Jest',
    'conditional',
    'choice:p0530',
    null,
  ],
  [
    'p0917',
    'ESLint getting started',
    'documentation',
    'ESLint',
    'reference',
    null,
    null,
  ],
  ['p1629', 'SQLite docs', 'documentation', 'SQLite', 'reference', null, null],
  [
    'p1679',
    'pg library docs',
    'documentation',
    null,
    'conditional',
    'choice:p1679',
    null,
  ],
  [
    'p1679',
    'sqlite library docs',
    'documentation',
    null,
    'conditional',
    'choice:p1679',
    null,
  ],
  ['p1811', 'React DevTools', 'tool', 'React', 'required', null, null],
  [
    'p1927',
    'Node docs',
    'documentation',
    'Node.js',
    'reference',
    null,
    'res-10',
  ],
  [
    'p1927',
    'Express docs',
    'documentation',
    'Express',
    'reference',
    null,
    null,
  ],
  ['p1173', 'CS50 Psets', 'practice', 'CS50', 'reference', null, 'res-04'],
  ['p1173', 'CS50 Practice', 'practice', 'CS50', 'reference', null, 'res-03'],
  ['p1250', 'CS50 Practice', 'practice', 'CS50', 'reference', null, 'res-03'],
];
const additionalMentions = extraDefinitions.map(
  (
    [sourceId, name, type, provider, mode, choiceGroup, parentResourceKey],
    index,
  ) => {
    const mention = source.resource_mentions.find(
      (row) => row.source_id === sourceId,
    );
    assert.ok(mention);
    return {
      candidateId: 'candidate:' + sourceId + ':' + (index + 1),
      name,
      sourceId,
      context: mention.context,
      exactInstruction: mention.exact_instruction,
      proposed: {
        type,
        provider,
        requirementMode: mode,
        choiceGroup,
        parentResourceKey,
      },
      originalUrl: null,
      sourceDirectLinkSupplied: false,
      evidenceRefs: [sourceId],
      ambiguity: sourceId === 'p1679',
      caveat:
        sourceId === 'p1679'
          ? 'pg/sqlite identifies alternative libraries, not a reviewed package choice. Do not assume sqlite means a specific npm package or prescribe both.'
          : 'A first-class named mention is proposed; parent links, when present, are navigation only and are not claimed to be the exact direct section URL.',
    };
  },
);
assert.equal(resources.length, 69);
assert.equal(uses.length, 290);
assert.equal(new Set(uses.map((row) => row.useId)).size, 290);
assert.equal(
  uses.filter((row) => key(row.useId).startsWith('hyperlink:')).length,
  19,
);
assert.equal(
  new Set(
    uses
      .filter((row) => key(row.useId).startsWith('mention:'))
      .map((row) => row.sourceId),
  ).size,
  208,
);
for (const row of [
  ...resources,
  ...uses,
  ...parentSuggestions,
  ...additionalMentions,
])
  for (const ref of row.evidenceRefs)
    assert.ok(bySource.has(ref), 'Unknown evidence ' + ref);
const evidenceRefs = [
  ...new Set(
    [
      ...resources,
      ...uses,
      ...parentSuggestions,
      ...additionalMentions,
    ].flatMap((row) => row.evidenceRefs),
  ),
].sort();
const counts = (values) =>
  Object.fromEntries(
    [...new Set(values)]
      .sort()
      .map((value) => [
        value,
        values.filter((entry) => entry === value).length,
      ]),
  );
const proposal = {
  formatVersion: 1,
  status: 'proposal-only-not-runtime',
  interpretationId: 'se-26w-v1-resource-labels-proposal-v1',
  date: '2026-10-08',
  releaseId: plan.releaseId,
  manifestSha256: plan.manifestSha256,
  wordSha256: source.source.sha256,
  ruleOrigin:
    'Added product interpretations grounded in the supplied manual; not verbatim source metadata or implemented completion rules.',
  rules,
  summary: {
    resources: resources.length,
    uses: uses.length,
    sourceMentions: 208,
    originalUrlResources: 12,
    unresolvedInstructionRecords: 57,
    originalHyperlinkUses: 19,
    proposedTypes: counts(resources.map((row) => row.proposed.type)),
    proposedUseModes: counts(uses.map((row) => row.proposed.requirementMode)),
    ambiguityResources: resources.filter((row) => row.ambiguity).length,
    ambiguityUses: uses.filter((row) => row.ambiguity).length,
    parentSuggestions: parentSuggestions.length,
    additionalMentionCandidates: additionalMentions.length,
  },
  resources,
  uses,
  parentSuggestions,
  additionalMentions,
  evidence: evidenceRefs.map((ref) => {
    const block = bySource.get(ref);
    return {
      sourceId: ref,
      exactText: block.text,
      sha256: digest(block.text),
      table: block.table ?? null,
      row: block.row ?? null,
      cell: block.cell ?? null,
    };
  }),
};
const cell = (text) =>
  String(text ?? 'unspecified')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
let md = `# Resource metadata review — proposal only\n\nDate: 2026-10-08. **No runtime/import/database/source change. Approval is required before applying these interpretations.** Original Word/content remains authoritative; these are separately labeled product interpretations.\n\n`;
md += `Reviewed: **69 existing resource records, 290 uses, 208 source mentions, all 12 supplied URLs and 19 hyperlink uses**. The original has 57 unresolved instruction records; many mean no new external resource rather than a missing website. Complete exact text, source coordinates, hashes, raw values and per-use explanations are in [the proposal](resource-metadata-proposal.json).\n\n`;
md += `## Proposed canonical types/providers\n\n| Resource | Type | Provider | Source |\n| --- | --- | --- | --- |\n`;
for (const row of resources.filter((row) => canonical.has(key(row.resourceId))))
  md += `| ${cell(row.raw.title)} | ${row.proposed.type} | ${row.proposed.provider} | ${row.evidenceRefs.join(', ')} |\n`;
md += `\nProviders follow names already in the manual; authors/institutions are not invented. javascript.info → article is a medium-confidence vocabulary choice for its tutorial/reference role. Unnamed/composite documentation keeps an unspecified provider.\n\n## Rules and material cases\n\n`;
for (const [name, description] of Object.entries(rules))
  md += `- **${name}**: ${description}\n`;
md += `\nDay 25 (p0530) is TOP **or** Jest; Day 83 (p1152) is Exercism **or custom problems**. Conditional labels cannot make both obligatory. Day 113/p1479 assigns CS50, with TOP Linked Lists optional; the TOP optional status extends only to that provider in week 17/p1475. Day 127/p1629 assigns CS50 with PostgreSQL/SQLite docs as needed. Day 146/p1831 restricts React/FSO to used topics. Day 182/p2218 forbids resources during the first 120 minutes; its internal instruction is not required external reading.\n\n`;
md += `Generic early TOP parent bindings and implicit FSO scopes need reviewed presentation corrections. Named tools/Jest/ESLint/SQLite/Express/CS50 Practice hidden inside compound instructions need visible mentions. These are proposals, with exact source text retained and **no new direct URL**. For pg/sqlite, the package/provider choice is explicitly unresolved.\n\n`;
md += `## All existing resources\n\n| Key | Original title | Type | Provider | Category | Ambiguous | Source |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
for (const row of resources)
  md += `| ${key(row.resourceId)} | ${cell(row.raw.title)} | ${row.proposed.type} | ${cell(row.proposed.provider)} | ${row.proposed.category} | ${row.ambiguity ? 'yes' : 'no'} | ${row.evidenceRefs.join(', ')} |\n`;
md += `\n## All existing uses\n\nAll raw assignments/locators/IDs remain in the JSON. required denotes the assigned section/concept, not a new completion gate, resource click or whole external course.\n\n| Use key | Raw resource | Context | Proposed mode | Rule | Source | Ambiguous |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
for (const row of uses)
  md += `| ${key(row.useId)} | ${key(row.raw.resourceId)} | ${key(row.raw.contentItemId)} | ${row.proposed.requirementMode} | ${row.proposed.rule} | ${row.evidenceRefs.join(', ')} | ${row.ambiguity ? 'yes' : 'no'} |\n`;
md += `\n## Parent binding proposals\n\n| Use | Proposed parent | Evidence |\n| --- | --- | --- |\n`;
for (const row of parentSuggestions)
  md += `| ${key(row.useId)} | ${row.proposedParentResourceKey} | ${row.evidenceRefs.join(', ')} |\n`;
md += `\n## Named-mention candidates\n\n| Name | Context | Type | Mode | Known parent only | Source |\n| --- | --- | --- | --- | --- | --- |\n`;
for (const row of additionalMentions)
  md += `| ${cell(row.name)} | ${row.context} | ${row.proposed.type} | ${row.proposed.requirementMode} | ${cell(row.proposed.parentResourceKey)} | ${row.sourceId} |\n`;
md += `\n## Recommended implementation boundary\n\nKeep the imported database rows and archived curriculum byte-for-byte unchanged. Store an immutable, versioned **presentation interpretation** outside the source archive, bound to the exact release/manifest/Word hashes and expected raw record IDs/text hashes. Validate completeness, vocabulary, evidence, local destinations and original URLs before enabling it. Freeze the approved artifact and explicit application-version binding; never select a floating latest interpretation or silently overwrite it. A stale/mismatching interpretation must fail visibly instead of being applied to another release.\n\nPreserve original type/provider/requirement/parent fields in provenance. Show/filter separately named derived tags, identified as added interpretations. Keep all 69 raw records and 290 use origins accessible; virtual named mentions or corrected parent groupings must preserve their raw origins and avoid duplicate result IDs. Never turn these display tags into extra progress units, external grading, account requirements or changed exercise eligibility.\n\nFirst implement the reviewed labels and same-use filter projection; verify private records/manifests/reseed stay unchanged and raw fallbacks remain explicit. Parent corrections and new first-class mention/detail destinations require their own focused integration checks across library/search/details/source mapping; do not silently add them via a keyword rewrite. The candidate list is a concrete set of reviewed gaps, not a claim of exhaustive token-by-token entity extraction. Additional ambiguous library identity choices remain unspecified.\n\nIf a proposed change affects lesson/task completion, prescribed scope, original content or published release identity, create a new curriculum release and use the separately reviewed M8 upgrade path. A presentation overlay must not be used to evade immutable curriculum releases. This step only proposes the boundary; no overlay loader, schema migration, import reset or student enrollment change has been made.\n\n## Review coverage\n\n`;
md += '```json\n' + JSON.stringify(proposal.summary, null, 2) + '\n```\n';
for (const [file, contents, parser] of [
  [
    'resource-metadata-proposal.json',
    JSON.stringify(proposal, null, 2) + '\n',
    'json',
  ],
  ['RESOURCE-METADATA-REVIEW.md', md, 'markdown'],
]) {
  const rendered = await format(contents, { parser, singleQuote: true });
  const target = path.join(root, 'docs', file);
  if (process.argv[2] === '--check')
    assert.equal(
      await readFile(target, 'utf8'),
      rendered,
      'Review drift: ' + file,
    );
  else await writeFile(target, rendered);
}
console.log(
  JSON.stringify(
    {
      status:
        process.argv[2] === '--check'
          ? 'review-verified'
          : 'proposal-generated',
      ...proposal.summary,
    },
    null,
    2,
  ),
);
