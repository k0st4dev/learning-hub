# Named resource mentions — review proposal

Date: 2026-10-09. **Review only; no new resource or context is active.** The eighteen parent corrections from step 16 remain active and unchanged. This review covers the fifteen candidates already recorded in the original metadata proposal, not exhaustive entity extraction.

Recommend **thirteen clear contextual mentions**, reusing two existing resources and adding ten derived resource identities only after separate approval. CS50 Practice shares one identity across two weeks. Defer the two ambiguous pg/sqlite mentions. Their source instruction stays available; no package, provider, direct link or requirement is guessed.

## Concrete inventory

| Source / context                                                                                        | Name                   | Proposed stable resource key | Type / contextual mode      | Navigation                            | Decision        |
| ------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------- | --------------------------- | ------------------------------------- | --------------- |
| p0274 / [d001-learn](http://127.0.0.1:3000/course/software-engineer/days/d001/lessons/d001-learn#study) | Node runtime           | named-node-runtime           | tool / required             | No direct link supplied in the manual | Propose derived |
| p0274 / [d001-learn](http://127.0.0.1:3000/course/software-engineer/days/d001/lessons/d001-learn#study) | nvm                    | named-nvm                    | tool / required             | No direct link supplied in the manual | Propose derived |
| p0274 / [d001-learn](http://127.0.0.1:3000/course/software-engineer/days/d001/lessons/d001-learn#study) | VS Code                | named-vs-code                | tool / required             | No direct link supplied in the manual | Propose derived |
| p0274 / [d001-learn](http://127.0.0.1:3000/course/software-engineer/days/d001/lessons/d001-learn#study) | Git                    | named-git                    | tool / required             | No direct link supplied in the manual | Propose derived |
| p0530 / [d025-learn](http://127.0.0.1:3000/course/software-engineer/days/d025/lessons/d025-learn#study) | Jest Getting Started   | named-jest-getting-started   | documentation / conditional | No direct link supplied in the manual | Propose derived |
| p0917 / [d061-learn](http://127.0.0.1:3000/course/software-engineer/days/d061/lessons/d061-learn#study) | ESLint getting started | named-eslint-getting-started | documentation / reference   | No direct link supplied in the manual | Propose derived |
| p1629 / [d127-learn](http://127.0.0.1:3000/course/software-engineer/days/d127/lessons/d127-learn#study) | SQLite docs            | named-sqlite-docs            | documentation / reference   | No direct link supplied in the manual | Propose derived |
| p1679 / [d132-learn](http://127.0.0.1:3000/course/software-engineer/days/d132/lessons/d132-learn#study) | pg library docs        | named-pg-library-docs        | documentation / conditional | No direct link supplied in the manual | Defer           |
| p1679 / [d132-learn](http://127.0.0.1:3000/course/software-engineer/days/d132/lessons/d132-learn#study) | sqlite library docs    | named-sqlite-library-docs    | documentation / conditional | No direct link supplied in the manual | Defer           |
| p1811 / [d144-learn](http://127.0.0.1:3000/course/software-engineer/days/d144/lessons/d144-learn#study) | React DevTools         | named-react-devtools         | tool / required             | No direct link supplied in the manual | Propose derived |
| p1927 / [w23](http://127.0.0.1:3000/course/software-engineer/weeks/w23)                                 | Node docs              | res-10                       | documentation / reference   | res-10                                | Reuse existing  |
| p1927 / [w23](http://127.0.0.1:3000/course/software-engineer/weeks/w23)                                 | Express docs           | named-express-docs           | documentation / reference   | No direct link supplied in the manual | Propose derived |
| p1173 / [w13](http://127.0.0.1:3000/course/software-engineer/weeks/w13)                                 | CS50 Psets             | res-04                       | practice / reference        | res-04                                | Reuse existing  |
| p1173 / [w13](http://127.0.0.1:3000/course/software-engineer/weeks/w13)                                 | CS50 Practice          | named-cs50-practice          | practice / reference        | res-03                                | Propose derived |
| p1250 / [w14](http://127.0.0.1:3000/course/software-engineer/weeks/w14)                                 | CS50 Practice          | named-cs50-practice          | practice / reference        | res-03                                | Propose derived |

Stable mention keys are source ID plus named resource key, independent of proposal order. New `/resources/named-*` paths are proposed, not live links. Node docs and CS50 Psets reuse existing `/resources/res-10` and `/resources/res-04`. CS50 Practice has a separate practice identity; its CS50x URL is parent navigation, not a practice deep link. See [machine-readable inventory](resource-named-mentions-proposal.json) for exact origin IDs, ancestor scopes, wording, coordinates, hashes and evidence.

## Context and exact source wording

### p0274 — d001-learn

> Node preko nvm (install --lts), VS Code, terminal, Git; TOP Foundations: Problem Solving (samo pročitati, ne gledati rešenja).

Named setup tools share the complete Day 1 assignment. Required describes the named setup, not extra course credit or an application dependency. Keep nvm as the source name without selecting a platform-specific distribution.

### p0530 — d025-learn

> TOP Testing Basics (uvod) ili Jest Getting Started; prvo koncept testova.

Jest is an alternative to TOP Testing Basics, not a second mandatory reading. Keep choice:p0530 shared with the existing TOP assignment.

### p0917 — d061-learn

> TOP Linting; current ESLint getting started po potrebi.

Only ESLint getting started is as-needed reference; TOP Linting remains assigned. Do not inherit the whole compound instruction’s required label.

### p1629 — d127-learn

> CS50x Week 7 lecture/notes; PostgreSQL/SQLite docs po potrebi.

Only SQLite docs is as-needed reference; CS50 is assigned and the existing PostgreSQL reference remains separate. Do not identify SQLite documentation as an npm sqlite package.

### p1679 — d132-learn

> Node pg/sqlite library docs; fokus na konceptu parameterized queries.

The original requires reading about parameterized queries but does not identify a concrete pg/sqlite package or unambiguously prescribe both libraries. Conditional display labels are tentative added interpretation; retain the original required compound instruction and defer activation of these two mentions.

### p1811 — d144-learn

> React DevTools + FSO debugging guidance.

React DevTools is the named tool in this assigned debugging instruction; keep the FSO assignment and exact wording. No extension installation or new URL is proposed.

### p1927 — w23

> Full Stack Open Part 3, Node/Express docs as reference

Node/Express docs are reference in the weekly overview. Reuse Node.js Docs once; Express has no supplied direct URL. Weekly context does not create required daily assignments.

### p1173 — w13

> CS50x Week 0, CS50x Week 1, CS50 Psets/Practice

Weekly Psets/Practice context is reference. Reuse CS50x Problem Sets; give CS50 Practice its own derived identity and label CS50x navigation as parent-only.

### p1250 — w14

> CS50x Week 2, CS50 Practice

Reuse the same derived CS50 Practice identity for this second weekly context; do not create another resource or infer required practice from the overview.

## Integration boundaries for later approval

Keep all 69 imported resources, 290 raw use IDs, 208 original mentions, 2,329 mappings, twelve URLs/nineteen hyperlink uses and 364 required units unchanged. Each derived mention retains its original use IDs and exact full instruction; narrower display names and contextual labels are added interpretation. Multiple names in one instruction are not multiple completion requirements. A weekly mention inherits the week/phase only; it must not be copied onto every day. Preserve conditional TOP/Jest alternatives and as-needed ESLint/SQLite scopes.

If the thirteen recommended mentions are approved, the combined library would contain 79 resource identities: 69 original plus ten derived. Two references enrich existing records instead of creating duplicate Node/Psets cards or Search results. Thirteen derived contextual edges are counted separately from the unchanged 290 original use origins. The full fifteen-candidate proposal would contain 81 identities only if the two deferred entries later receive separate approval. Do not report 303 or 305 as original source uses.

A later immutable presentation artifact must pin release/manifest/Word/proposal hashes, stable identities, exact source evidence, origin uses and ancestor context. Only approved rows may activate; mismatches fail visibly with originals retained. Library/API/detail/daily/weekly/Search must share one projection, same-use filters and stable pagination. Search reused canonical records once with enriched exact text/context; one CS50 Practice record carries both weekly contexts. Retain current views when no interpretation exists, original-resource routes and exact source mappings. Do not change schema/imported associations, published releases or learning mutations to implement presentation.

No paid dependency, runtime dependency, new URL, external request, account, installer, cloud service or student/private-data access is proposed. Named tools describe the manual’s existing setup; the application does not install them or select platform-specific nvm/SQLite packages. No tool version or current availability is asserted. Parent links remain the original unchecked supplied URLs. New resource disclosures and missing-link states must retain descriptive keyboard-accessible links, clear original/added wording and existing new-tab announcements.

## Focused acceptance before activation

Verify exact Word/CSV context and all candidate origins; approve a frozen subset with unique stable keys. Compare all original inventories and source mappings; independently count derived contexts. Reused resources must not duplicate Search/library results. Verify nine reviewed source contexts, both Practice weeks, TOP/Jest choice, as-needed scopes and unchanged original pg/sqlite instruction. Test owned library/detail/API/Search and daily/weekly consistency, drift/fallback, restart/reseed and unchanged two-user durable records. Then check actual desktop/keyboard/Back and basic narrow reflow. This review does not perform or claim those runtime integration gates.

Reproduce with `node scripts/review-resource-named-mentions.mjs --check` and `python scripts/verify-resource-named-mentions.py`. The latter independently compares the review with original Word and CSV evidence. No runtime import or database access is needed.
