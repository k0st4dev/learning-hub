// Developer review only. Never imported by setup, seeding or the application.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import { loadArchivedCurriculum } from '../src/server/content/import.ts';

assert.ok(
  process.argv.length === 2 ||
    (process.argv.length === 3 && process.argv[2] === '--check'),
);
const root = path.resolve(import.meta.dirname, '..');
const plan = await loadArchivedCurriculum(root);
const previousBytes = await readFile(
  path.join(root, 'docs/resource-metadata-proposal.json'),
);
const previous = JSON.parse(previousBytes.toString('utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(previous.status, 'proposal-only-not-runtime');
assert.equal(previous.manifestSha256, plan.manifestSha256);
assert.equal(previous.wordSha256, plan.source.source.sha256);
assert.equal(previous.additionalMentions.length, 15);
const prefix = plan.releaseId + ':';
const items = new Map(
  plan.items.map((item) => {
    const route = JSON.parse(item.metadataJson).route;
    assert.match(route, /^\//);
    return [item.id, { ...item, route }];
  }),
);
const blocks = new Map(
  plan.source.source_blocks.map((block) => [block.source_id, block]),
);
const keys = new Map([
  ['Node runtime', 'named-node-runtime'],
  ['nvm', 'named-nvm'],
  ['VS Code', 'named-vs-code'],
  ['Git', 'named-git'],
  ['Jest Getting Started', 'named-jest-getting-started'],
  ['ESLint getting started', 'named-eslint-getting-started'],
  ['SQLite docs', 'named-sqlite-docs'],
  ['pg library docs', 'named-pg-library-docs'],
  ['sqlite library docs', 'named-sqlite-library-docs'],
  ['React DevTools', 'named-react-devtools'],
  ['Node docs', 'res-10'],
  ['Express docs', 'named-express-docs'],
  ['CS50 Psets', 'res-04'],
  ['CS50 Practice', 'named-cs50-practice'],
]);
const reasons = new Map([
  [
    'p0274',
    'Named setup tools share the complete Day 1 assignment. Required describes the named setup, not extra course credit or an application dependency. Keep nvm as the source name without selecting a platform-specific distribution.',
  ],
  [
    'p0530',
    'Jest is an alternative to TOP Testing Basics, not a second mandatory reading. Keep choice:p0530 shared with the existing TOP assignment.',
  ],
  [
    'p0917',
    'Only ESLint getting started is as-needed reference; TOP Linting remains assigned. Do not inherit the whole compound instruction’s required label.',
  ],
  [
    'p1629',
    'Only SQLite docs is as-needed reference; CS50 is assigned and the existing PostgreSQL reference remains separate. Do not identify SQLite documentation as an npm sqlite package.',
  ],
  [
    'p1679',
    'The original requires reading about parameterized queries but does not identify a concrete pg/sqlite package or unambiguously prescribe both libraries. Conditional display labels are tentative added interpretation; retain the original required compound instruction and defer activation of these two mentions.',
  ],
  [
    'p1811',
    'React DevTools is the named tool in this assigned debugging instruction; keep the FSO assignment and exact wording. No extension installation or new URL is proposed.',
  ],
  [
    'p1927',
    'Node/Express docs are reference in the weekly overview. Reuse Node.js Docs once; Express has no supplied direct URL. Weekly context does not create required daily assignments.',
  ],
  [
    'p1173',
    'Weekly Psets/Practice context is reference. Reuse CS50x Problem Sets; give CS50 Practice its own derived identity and label CS50x navigation as parent-only.',
  ],
  [
    'p1250',
    'Reuse the same derived CS50 Practice identity for this second weekly context; do not create another resource or infer required practice from the overview.',
  ],
]);
const evidenceRefs = new Set();
const mentions = previous.additionalMentions.map((candidate) => {
  const stableKey = keys.get(candidate.name);
  assert.ok(stableKey);
  const item = items.get(prefix + candidate.context);
  assert.ok(item);
  const origins = previous.uses.filter(
    (row) => row.sourceId === candidate.sourceId,
  );
  assert.ok(origins.length);
  const ancestors = [];
  const scope = { module: null, week: null, day: null };
  for (let current = item; current; current = items.get(current.parentId)) {
    ancestors.push({
      id: current.id,
      parentId: current.parentId,
      kind: current.kind,
      stableKey: current.stableKey,
      route: current.route,
    });
    if (current.kind in scope) scope[current.kind] = current.stableKey;
  }
  const canonical = plan.resources.find(
    (resource) => resource.stableKey === stableKey,
  );
  const parent = candidate.proposed.parentResourceKey
    ? plan.source.resources.find(
        (resource) => resource.id === candidate.proposed.parentResourceKey,
      )
    : null;
  assert.ok(!candidate.proposed.parentResourceKey || parent);
  const refs = new Set([candidate.sourceId]);
  if (item.kind === 'lesson') refs.add('p0025');
  if (parent) parent.source_ids.forEach((ref) => refs.add(ref));
  refs.forEach((ref) => evidenceRefs.add(ref));
  return {
    candidateId: candidate.candidateId,
    proposedMentionKey:
      'named-' + candidate.sourceId + '-' + stableKey.replace(/^named-/, ''),
    displayName: candidate.name,
    nameOrigin: 'added-display-label-grounded-in-source',
    resourceStableKey: stableKey,
    resourceId: prefix + stableKey,
    resourceAction: canonical
      ? 'reuse-existing-resource'
      : 'propose-derived-resource',
    proposedDetailHref: '/resources/' + stableKey,
    reviewDecision: candidate.ambiguity
      ? 'defer-ambiguous-package-mentions'
      : 'recommended-for-separate-approval',
    sourceId: candidate.sourceId,
    context: {
      id: item.id,
      stableKey: item.stableKey,
      title: item.title,
      route: item.route,
      sourceMappingHref: plan.source.source_mapping.find(
        (row) => row.source_id === candidate.sourceId,
      ).website_location,
      kind: item.kind,
      scope,
      ancestors,
    },
    exactInstruction: candidate.exactInstruction,
    originalUseIds: origins.map((row) => row.useId),
    originalAssignments: origins.map((row) => ({
      useId: row.useId,
      resourceId: row.raw.resourceId,
      assignedText: row.raw.assignedText,
      rawRequirementMode: row.raw.requirementMode,
      currentReviewedMode: row.proposed.requirementMode,
    })),
    proposed: candidate.proposed,
    originalUrl: null,
    sourceDirectLinkSupplied: false,
    navigation: {
      kind: parent ? 'existing-source-parent-only' : 'no-direct-link-supplied',
      parentResourceKey: parent?.id ?? null,
      parentHref: parent ? '/resources/' + parent.id : null,
      parentOriginalUrl: parent?.url ?? null,
      exactSectionUrl: null,
    },
    evidenceRefs: [...refs].sort(),
    reason: reasons.get(candidate.sourceId),
  };
});
assert.equal(new Set(mentions.map((row) => row.proposedMentionKey)).size, 15);
assert.equal(new Set(mentions.map((row) => row.resourceStableKey)).size, 14);
const proposal = {
  formatVersion: 1,
  status: 'proposal-only-not-runtime',
  date: '2026-10-09',
  proposalId: 'se-26w-v1-resource-named-mentions-proposal-v1',
  releaseId: plan.releaseId,
  manifestSha256: plan.manifestSha256,
  wordSha256: plan.source.source.sha256,
  previousProposalSha256: digest(previousBytes),
  recommendation:
    'Approve thirteen clear contextual mentions separately; defer the two ambiguous pg/sqlite mentions without changing their original instruction.',
  summary: {
    originalResources: 69,
    originalUses: 290,
    originalSourceMentions: 208,
    originalMappings: 2329,
    candidates: 15,
    distinctCandidateResourceIdentities: 14,
    reusedExistingResources: 2,
    proposedNewDerivedResources: 12,
    recommendedMentions: 13,
    deferredMentions: 2,
    recommendedNewDerivedResources: 10,
    originalRequiredUnits: 364,
  },
  boundaries: {
    runtimeApplied: false,
    newExternalUrls: 0,
    newRuntimeDependencies: 0,
    addedCompletionUnits: 0,
    importedRecordsChanged: false,
    studentRecordsReadOrWritten: false,
    privateSearchAdded: false,
  },
  mentions,
  evidence: [...evidenceRefs].sort().map((ref) => {
    const block = blocks.get(ref);
    assert.ok(block);
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
let md =
  '# Named resource mentions — review proposal\n\nDate: 2026-10-09. **Review only; no new resource or context is active.** The eighteen parent corrections from step 16 remain active and unchanged. This review covers the fifteen candidates already recorded in the original metadata proposal, not exhaustive entity extraction.\n\n';
md +=
  'Recommend **thirteen clear contextual mentions**, reusing two existing resources and adding ten derived resource identities only after separate approval. CS50 Practice shares one identity across two weeks. Defer the two ambiguous pg/sqlite mentions. Their source instruction stays available; no package, provider, direct link or requirement is guessed.\n\n';
md +=
  '## Concrete inventory\n\n| Source / context | Name | Proposed stable resource key | Type / contextual mode | Navigation | Decision |\n| --- | --- | --- | --- | --- | --- |\n';
for (const row of mentions)
  md += `| ${row.sourceId} / [${row.context.stableKey}](http://127.0.0.1:3000${row.context.sourceMappingHref}) | ${row.displayName} | ${row.resourceStableKey} | ${row.proposed.type} / ${row.proposed.requirementMode} | ${row.navigation.parentResourceKey ?? 'No direct link supplied in the manual'} | ${row.reviewDecision.startsWith('defer') ? 'Defer' : row.resourceAction === 'reuse-existing-resource' ? 'Reuse existing' : 'Propose derived'} |\n`;
md +=
  '\nStable mention keys are source ID plus named resource key, independent of proposal order. New `/resources/named-*` paths are proposed, not live links. Node docs and CS50 Psets reuse existing `/resources/res-10` and `/resources/res-04`. CS50 Practice has a separate practice identity; its CS50x URL is parent navigation, not a practice deep link. See [machine-readable inventory](resource-named-mentions-proposal.json) for exact origin IDs, ancestor scopes, wording, coordinates, hashes and evidence.\n\n## Context and exact source wording\n\n';
for (const sourceId of new Set(mentions.map((row) => row.sourceId))) {
  const rows = mentions.filter((row) => row.sourceId === sourceId);
  md += `### ${sourceId} — ${rows[0].context.stableKey}\n\n> ${rows[0].exactInstruction}\n\n${rows[0].reason}\n\n`;
}
md +=
  '## Integration boundaries for later approval\n\nKeep all 69 imported resources, 290 raw use IDs, 208 original mentions, 2,329 mappings, twelve URLs/nineteen hyperlink uses and 364 required units unchanged. Each derived mention retains its original use IDs and exact full instruction; narrower display names and contextual labels are added interpretation. Multiple names in one instruction are not multiple completion requirements. A weekly mention inherits the week/phase only; it must not be copied onto every day. Preserve conditional TOP/Jest alternatives and as-needed ESLint/SQLite scopes.\n\nIf the thirteen recommended mentions are approved, the combined library would contain 79 resource identities: 69 original plus ten derived. Two references enrich existing records instead of creating duplicate Node/Psets cards or Search results. Thirteen derived contextual edges are counted separately from the unchanged 290 original use origins. The full fifteen-candidate proposal would contain 81 identities only if the two deferred entries later receive separate approval. Do not report 303 or 305 as original source uses.\n\nA later immutable presentation artifact must pin release/manifest/Word/proposal hashes, stable identities, exact source evidence, origin uses and ancestor context. Only approved rows may activate; mismatches fail visibly with originals retained. Library/API/detail/daily/weekly/Search must share one projection, same-use filters and stable pagination. Search reused canonical records once with enriched exact text/context; one CS50 Practice record carries both weekly contexts. Retain current views when no interpretation exists, original-resource routes and exact source mappings. Do not change schema/imported associations, published releases or learning mutations to implement presentation.\n\nNo paid dependency, runtime dependency, new URL, external request, account, installer, cloud service or student/private-data access is proposed. Named tools describe the manual’s existing setup; the application does not install them or select platform-specific nvm/SQLite packages. No tool version or current availability is asserted. Parent links remain the original unchecked supplied URLs. New resource disclosures and missing-link states must retain descriptive keyboard-accessible links, clear original/added wording and existing new-tab announcements.\n\n## Focused acceptance before activation\n\nVerify exact Word/CSV context and all candidate origins; approve a frozen subset with unique stable keys. Compare all original inventories and source mappings; independently count derived contexts. Reused resources must not duplicate Search/library results. Verify nine reviewed source contexts, both Practice weeks, TOP/Jest choice, as-needed scopes and unchanged original pg/sqlite instruction. Test owned library/detail/API/Search and daily/weekly consistency, drift/fallback, restart/reseed and unchanged two-user durable records. Then check actual desktop/keyboard/Back and basic narrow reflow. This review does not perform or claim those runtime integration gates.\n\nReproduce with `node scripts/review-resource-named-mentions.mjs --check` and `python scripts/verify-resource-named-mentions.py`. The latter independently compares the review with original Word and CSV evidence. No runtime import or database access is needed.\n';
for (const [relative, content, parser] of [
  [
    'docs/resource-named-mentions-proposal.json',
    JSON.stringify(proposal),
    'json',
  ],
  ['docs/RESOURCE-NAMED-MENTIONS-REVIEW.md', md, 'markdown'],
]) {
  const output = await format(content, { parser });
  const target = path.join(root, relative);
  if (process.argv[2] === '--check')
    assert.equal(await readFile(target, 'utf8'), output, relative);
  else await writeFile(target, output);
}
console.log(
  JSON.stringify(
    {
      status:
        process.argv[2] === '--check' ? 'review-reproduced' : 'review-written',
      ...proposal.summary,
      evidenceBlocks: proposal.evidence.length,
      runtimeApplied: false,
    },
    null,
    2,
  ),
);
