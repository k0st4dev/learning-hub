# M6 step 10 — reviewed resource labels in the read/filter service

Date: 2026-10-08. Applies the type/provider/contextual requirement labels reviewed in step 9 and approved by the user's continuation. This is a service increment; resource-library HTTP controls, parent regrouping and new named-mention destinations remain separate work.

## Result and immutable boundary

The frozen `content/interpretations/se-26w-v1-resource-labels-v1.json` contains all 69 resource labels, 290 contextual labels, decision rules and 252 source-evidence references. It is outside the published source archive. The application explicitly binds this version to canonical JSON SHA-256 `c326c2b849fc4e41eaae4d7a27bdba09e0ccad49c31cde73e119af9be754cee3`, the original proposal digest, release `se-26w-v1`, manifest `064d4412b280d54c7bf2fb229e7ec643eb3dc8ab85f9311bf9f9a5749c5cb265` and original Word SHA-256 `5e5884f8f919b24d4924c6393ece6d36256f288529499c4e9e5e3d0921377513`.

Strict Zod validation and runtime checks require complete unique inventories, original resource/use identity hashes, valid vocabulary/rules and source-evidence text hashes/table coordinates. Every use retains its original parent, content item, exact wording, locator and order. Resource identity covers original title/provider/type/description/URL/link origin. Reviewed replacement URLs, link status and check time remain separate operational metadata and are preserved, not bound into immutable content identity. No link-health changes are made here.

The digest is SHA-256 of UTF-8 `JSON.stringify` of the frozen JSON object in its checked-in key order, not a whitespace-sensitive file checksum. There is no runtime latest-version lookup, user-selected label file, proposal regeneration or database write. The pinned version and artifact must change together in a separately reviewed application change; scope/completion/source changes still require the established curriculum-release upgrade procedure. Missing static artifacts fail the build; mismatched loaded labels or enrolled original content raise explicit service error 503 `RESOURCE_LABELS_UNAVAILABLE` and never silently fall back for this release. Other published releases explicitly report `imported-metadata` with null interpretation version/hash and use their own raw labels.

## Read/filter contract

- Original resource and use fields remain unchanged at their existing keys. Separate `effective` fields supply resource type/provider/source-filter key and use requirement mode. `interpretation` identifies added product interpretation, pinned version, exact cited Word text/coordinates, rationale/confidence, rule description, ambiguity, choice group and caveats. Unknown providers remain null. Raw `metadataCoverage` and separate `effectiveMetadataCoverage` remain distinguishable.
- Type and source filters use effective type/provider. Reviewed provider keys are `provider/` plus URL-encoded provider name; `provider-unspecified` is a distinct reserved key labelled “Provider not specified in manual.” The two Odin courses share a provider choice while retaining separate titles/IDs. Unsupported releases keep their raw source filter values. Consumers must submit the returned option value rather than raw title or display text; library controls have not shipped yet.
- Contextual requirement and phase/week/day filters must match one and the same original use. OR within a dimension and AND between dimensions, original title/ID order, 25-resource pagination, full related uses/related days and account/pinned-release checks are preserved. Text queries continue searching original indexed content, not new interpretation explanations or private records. General Search is unchanged.
- Required refers to the assigned section/concept, not an entire external course, external account/grade, resource-click credit or an extra progress unit. Day 25 TOP/Jest and Day 83 Exercism/custom choices stay conditional; Day 146 applies only used topics. Week 17 optional TOP stays separate from assigned CS50. Day 127 PostgreSQL as needed and Day 149 React references remain supporting references. Day 182's first-120-minute restriction remains exact source text and is not made an external reading requirement. Existing exercise eligibility/completion/resume rules are unchanged.
- Counts: types article 1/course 4/documentation 6/guide 52/practice 2/reference 4; use modes conditional 4/optional 4/reference 131/required 151. Six resource ambiguity flags and 63 contextual caveat-or-ambiguity flags remain visible. All 19 original hyperlink uses remain reference navigation. All 57 unresolved entries remain accessible without fabricated URLs.

The 18 parent-binding proposals and 15 additional named-mention candidates remain proposals. No new virtual resource, resource detail route, canonical binding, importer, migration, source file, dependency or learning transaction is added or changed.

## Verification and limits

- Complete unit/integration regression: **419 tests / 35 files pass, 77.88 seconds**. Seven new integration cases cover complete approved inventories/evidence; reviewed provider/type filtering and raw-release fallback; alternatives/restrictions; mixed-provider same-use scoping; release/raw-content/evidence drift; tampered/stale/incomplete/foreign artifacts; unchanged reseeding/two-user records. Existing ownership/query/URL/pagination/private-data tests remain. The former “required gives no matches” assertion was intentionally replaced by approved semantic assertions; video/unknown/impossible filters still give no matches.
- Each original resource/use is compared to the imported source record. Stable fingerprints cover learner/enrollment/progress/tasks/preparation/notes/scorecards/activity/receipts and published release/content/resource/use/source-block/mapping/exercise-task tables. Reads and no-op import preserve fingerprints; two accounts return the same public curriculum with separate private records. Closing/reopening the same SQLite database returns exactly the same labels/provenance/results and leaves fingerprints unchanged.
- Integrity failure cases are pure cloned catalogs/artifacts; tests never rewrite the imported immutable release. Checks reject changed manifest/Word identity, original URLs/providers/text/modes/parents, missing/duplicate/foreign rows, invalid rule/evidence references, changed evidence text/coordinates and wrong artifact version/checksum. Null/undefined artifacts raise the explicit service error. Separate synthetic published fixture verifies raw fallback and operational URL/status preservation.
- Final focused resource/Search regression **35 tests / 3 files passes** after strengthening the missing-artifact error guard. Direct strict TypeScript and full ESLint pass. Final production build passes after that guard; its only warnings remain the two existing filesystem tracing warnings. Repository formatting and diff checks pass.
- Frozen-label `--check` exactly reproduces the approved subset. Step-9 proposal `--check`, independent Word/proposal audit, original ten-file archive verification and licence/notice checks pass: 2365 exact paragraphs/coordinates, 197 tables, 208 resource instructions, 290 original uses, 19 hyperlinks/12 URLs, 252 evidence blocks; 560 locked dependencies and 574 notices. The Word audit's `runtimeChanges: false` describes that audit's read-only operation, not this implementation increment.
- Existing preview was stopped only after verifying launcher/listener ownership against the portable Node runtime, then restarted on the same `.tmp/m2-preview` database with hidden launcher PID 55824. `/login` returns 200. No account reset or normal-data setup. Generated type declarations are excluded from the committed changes. Synthetic credentials remain ignored and were not printed/committed.

No new UI/browser, full served-page audit, production startup, performance target or final A01–A26 pass is claimed. Existing production/axe/browser-automation, reboot/offline/screen-reader/target-OS and later-MVP gates remain pending. Existing GitHub publishing remains a normal-PowerShell operator action.

Reproduce:

```sh
node scripts/freeze-resource-labels.mjs --check
node scripts/review-resource-metadata.mjs --check
python scripts/verify-resource-review.py
npm run curriculum:verify-source
node node_modules/vitest/vitest.mjs run tests/unit tests/integration --configLoader=native --maxWorkers=2
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run licenses:check
```

The developer-only freeze script supports `--write-new` exclusively for first creation: exclusive file creation refuses to overwrite this frozen version. Setup/import/runtime never run it. Student operation requires no Python or external service.

## Exact next task

Ask before M6 step 11: expose the existing owned resource-library service through a protected read-only HTTP endpoint, with strict query parsing, account-switch checks and explicit error states. Test exact effective/original metadata, same-use filters, query limits, two-user/private-data isolation and unchanged progress through actual route calls. Keep visible filter controls as the following focused increment; do not include parent regrouping/new mention destinations without their separately scoped approval and coverage checks.
