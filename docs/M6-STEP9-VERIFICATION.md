# M6 step 9 — source-backed resource metadata proposal

Date: 2026-10-08. Completes the agreed review after the step-8 filtering service. This is a proposal and reproducible audit, not a runtime classification change or final MVP acceptance.

## Deliverables and findings

- [Review and complete tables](RESOURCE-METADATA-REVIEW.md): all 69 existing resources and all 290 uses, with proposed type/provider/contextual mode and exact source references. [Structured proposal](resource-metadata-proposal.json) retains every raw record, assignment, locator, ID, URL/status, scope, decision rule, caveat and 252 source-evidence blocks with original text/hashes/table coordinates.
- The canonical twelve resources propose four courses, two practice sources, four documentation sources, one tutorial/article and one book/reference. javascript.info → article is an explicitly marked vocabulary choice. Unknown providers and compound library choices remain unspecified. Many of the 57 unresolved records are internal instructions such as no new theory; these are distinguished from missing external websites without deleting their original text or destinations.
- Across the existing records: proposed types article 1/course 4/documentation 6/guide 52/practice 2/reference 4; use modes required 151/optional 4/reference 131/conditional 4. Six resource classifications and 63 uses are flagged for ambiguity or important choice/scope/binding caveats. A flagged row is not automatically a source error; its exact reason remains visible.
- The original daily Learn rule p0025 says to read the exact named resource. Required tags cover the assigned section/concept, not an entire external course, new account, external grade, resource-click credit or additional progress unit. Week lists are reference overviews. Explicit optional/as-needed/alternative clauses are scoped to the relevant provider rather than applied to every resource in a compound sentence.
- Important cases: Day 25 TOP or Jest and Day 83 Exercism or custom problems; optional TOP supplements in week 17 alongside assigned CS50; Day 127 PostgreSQL/SQLite as needed; Day 146 used-topic scope; Day 182 no resources for the first 120 minutes. Restrictions and the existing exercise eligibility remain unchanged.
- Eighteen parent-binding proposals identify early TOP assignments incorrectly associated with the later JavaScript course and three implicit FSO core-exercise instructions. Fifteen named-mention candidates identify tools and references hidden in compound instructions, including Jest, ESLint, SQLite, Express and CS50 Practice. These concrete gap candidates are not claimed to be exhaustive entity extraction. Direct URLs are never invented; any supplied canonical parent link remains parent navigation. The pg/sqlite package/provider choice remains ambiguous.

## Recommended boundary for approval

Use a separate immutable versioned presentation interpretation, bound to the exact release/manifest/Word hashes and raw record/text identities. Preserve imported fields in provenance; display and filter derived tags as added product interpretations. Freeze the approved artifact and its explicit application-version binding; do not float to a latest label set or rewrite published content. A mismatch must be visible rather than applied to another release.

The next implementation increment should apply only the reviewed type/provider/contextual requirement labels and verify same-use filters, unchanged original metadata, reseed, manifests and learner records. Parent regrouping and new first-class mention/detail destinations require their own focused library/search/detail/coverage integration. Changes to prescribed scope, completion rules or source content need a new curriculum release and the reviewed M8 upgrade path. The overlay cannot bypass immutable releases.

No overlay reader, importer/runtime/migration/database change was made in this step. The original uniform reference/reference values remain active pending approval and implementation. Resource controls and final semantic resource acceptance remain open.

## Verification

- [Independent Word/proposal verification](m6-step9-source-review.json): original Word SHA-256 5e5884f8f919b24d4924c6393ece6d36256f288529499c4e9e5e3d0921377513; all 2365 body paragraphs exactly match the archived JSON. All 208 resource instructions match Word source text; all 19 hyperlink label/target occurrences and 12 distinct URLs match Word relationships. All 252 cited evidence blocks/text hashes/coordinates and raw resource/use origins match the archive. Canonical URL/description values remain exact; no unresolved candidate receives a fabricated direct URL.
- Review generator `--check` reproduces both artifacts exactly, checks unique complete 69/290 inventories, all 208 source-mention origins, 19 hyperlink origins and all valid evidence references. It only loads the archived source and writes/checks docs, never opens a student database or calls import/setup. The independent verifier uses only Python standard library; Python is a developer audit tool, not a new student runtime dependency.
- Source archive integrity/inventory, generator ESLint, repository formatting and diff checks pass. No dependency/notice/source/import/schema/application changes. Full runtime regression remains the **412 tests/35 files and successful build from M6 step 8**; it was not rerun for documentation/audit scripts. No new browser action, production startup or automated browser acceptance is claimed. Opening the review in Codex returned queued; the file link is available directly.

Reproduce:

```sh
node scripts/review-resource-metadata.mjs --check
python scripts/verify-resource-review.py
npm run curriculum:verify-source
npm run format:check
```

Use `node scripts/review-resource-metadata.mjs` to regenerate the proposal deliberately; it never applies the proposal. All labels remain explicitly proposed. Existing production/axe/accessibility/reboot/offline/target-OS/final A01–A26 gates remain pending. GitHub push remains the normal-PowerShell operator action.

## Exact next task

After approval of this concrete proposal: M6 step 10 — immutable presentation labels and resource-service integration. Bind a new frozen interpretation artifact to the current hashes and validate every original resource/use identity and requiredness decision. Apply separate effective tags in the owned resource read/filter service, retain original metadata/evidence and unresolved provider choices, and test same-use compound/optional/alternative scopes and unchanged learner/source records. Do not add the separate parent corrections/virtual mention routes/UI controls in that increment; those have their own following integration checks. Ask after the focused implementation step.
