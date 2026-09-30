# M2 verification — 2026-09-30

Scope: complete immutable import and authenticated reading preview. M2 is complete; this does not claim the final A01–A26 suite passes.

## Inventory and provenance

| Item                                                  |  Verified count |
| ----------------------------------------------------- | --------------: |
| Phases / weeks / days                                 |    6 / 26 / 182 |
| Lessons / exercises / task lines                      | 182 / 182 / 548 |
| Required progress units                               |             364 |
| Preparation items / appendices / scorecard dimensions |      7 / 7 / 14 |
| Original body paragraphs / header-footer records      |        2365 / 2 |
| Original tables / source mappings                     |      197 / 2329 |
| Original URL registry / hyperlink occurrences         |         12 / 19 |
| Exact contextual resource instructions                |             208 |
| Curriculum routes / resource-detail routes            |        594 / 69 |

Original DOCX SHA-256: `5e5884f8f919b24d4924c6393ece6d36256f288529499c4e9e5e3d0921377513`.
Published normalized manifest: `064d4412b280d54c7bf2fb229e7ec643eb3dc8ab85f9311bf9f9a5749c5cb265`.

All ten source files retain their committed byte hashes. The independent Python standard-library audit compares original Word XML text, hyperlink labels/targets, table/row/cell relationships, header/footer records and both CSV inventories with the structured source. Fourteen checks pass in `m2-source-audit.json`. Python is an optional developer audit tool, not an application dependency.

Task interpretations retain all 515 required, 16 alternative, 13 conditional, two mixed and two optional lines. There are 25 weekly checkpoints and one final exam. Implementing their complete interactive semantics remains M4.

## Import contract and decisions

- Zod validates the release, counts, ordering, unique IDs, parents, source references, exact wording, HTTP(S) links and target routes before any writes.
- Deterministic IDs and hashes exclude timestamps. The importer re-normalizes validated input at its boundary and uses one immediate SQLite transaction. It checks stored text hashes, foreign keys and the 364-unit denominator before publishing.
- A simulated mid-import insert failure leaves no partially published curriculum. Retry succeeds. Identical import is a no-op; a changed published release is rejected.
- Existing accounts, pinned enrollments and progress are unchanged. Import never upgrades enrollment, resets student tables or rewrites the isolated M1 fixture.
- Guides and tables are rendered from escaped source paragraphs, including original labels and exact table coordinates. Original Serbian text is language-tagged. Product task rules are visibly separate from source text. Archived HTML is not executed.
- Contextual resource matching is an added interpretation using explicitly named original parent resources. Full original assignment/section instructions remain intact. No new external URL or unverified deep link is invented. Instructions with no matched original parent remain 57 explicit unresolved references; together with the 12 original URL resources these produce 69 resource records. External availability remains unchecked.
- Preparation, resources, guides, tasks and scorecard definitions add no required progress units. Navigation does not write progress or the learning cursor.
- Ordinary setup now installs the entire release. The M1 demo commands continue to use their own database. The existing reference migration and archive bytes were not changed.
- Registration/login forms explicitly use POST even before JavaScript hydration, preventing native form fallback from putting credentials into query strings. Normal browser registration/login passed after this fix.

## Verification evidence

| Check                                                                  | Result                                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Unit and file-database integration suite                               | 64 tests pass across eight files                                                                   |
| Import rollback, no-op, immutable rejection, record preservation       | Pass                                                                                               |
| Rendered React source audit                                            | Every mapping, exact paragraph, table coordinate, target anchor and original URL passes            |
| Actual authenticated Next HTTP audit                                   | 663/663 pages, 2329 mappings and 19 hyperlinks pass                                                |
| Anonymous access / unknown destination / read-only browsing            | Redirect without content leak; not-found boundary; enrollment snapshot unchanged                   |
| Native checks and repeated setup                                       | Pass; first full import followed by identical no-op                                                |
| Strict TypeScript, ESLint and production build                         | Pass; existing tracing warnings retained                                                           |
| Browser register → login → start course → defer preparation → Continue | Pass; reaches Day 1 lesson and study anchor                                                        |
| Browser course overview / Day 182 / scorecard                          | Original content present; scorecard has 14 dimensions                                              |
| Desktop 1440×900 / mobile 360×800                                      | No document overflow (1425px / 345px content widths); wide table stays within its scrolling region |

Machine-readable served-page evidence: `m2-served-audit.json`. This parses actual streamed server HTML without executing scripts; the separate browser smoke test confirms visible content and working controls. Screenshots: `m2-course-desktop.png` and `m2-day182-mobile.png`.

The browser and HTTP audit used a separate `.tmp/m2-preview` database. Existing M1 accounts remain in `.tmp/m1-demo`. No test accounts, session tokens, passwords, live databases or secrets are committed.

## Reproduce the served audit

Use a free matching loopback port, and the same environment in both terminals. Example PowerShell from the repository:

```powershell
$env:APP_DATA_DIR = Join-Path (Get-Location) '.tmp/m2-preview'
$env:APP_ORIGIN = 'http://127.0.0.1:3000'
$env:PORT = '3000'
npm run setup
npm run dev
```

In a second terminal with the same three environment variables:

```powershell
node scripts/audit-served-curriculum.mjs
```

The script refuses another data-directory configuration, creates a synthetic local account, checks all destinations and logs out. It leaves its test account in the isolated database and writes only aggregate evidence to `docs/m2-served-audit.json`. Do not point the server at student data for this audit.

## Remaining work

- Full reading/navigation polish, previous/next boundaries and stronger route-state UX: M3. The scorecard preview currently takes its heading from the first mapped cell; improve the page label without changing the published manifest.
- Full interactive task/checkpoint rules and course completion/resume: M4–M5. M2 exposes original content, not a claim that those workflows are complete.
- Search, notes, scorecard entry, profiles, recovery, operations and complete accessibility remain their agreed milestones.
- Production build passes. Starting a separate production server was rejected by this host's automatic approval policy, even after network permission was granted; development-server browser and HTTP evidence is recorded instead. Production Playwright/axe, real reboot, screen reader, disconnected operation and macOS/Linux remain final verification gates.
- The two existing Turbopack dynamic filesystem-tracing warnings and ESLint 9 support warning remain documented for later packaging review.
