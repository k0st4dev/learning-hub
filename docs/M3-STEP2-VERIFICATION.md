# M3 step 2 — expandable course outline

Verified 2026-10-01 against specification section 15 and the read-only navigation rule in section 7. This increment does not complete M3 or final A01–A26 acceptance.

## Delivered

- Phase → week → day → study/exercise outline covering all 578 entries. Exercise and study are sibling destinations in the presentation; published parent relationships remain unchanged.
- Only the current phase/week/day path initially expands. The current destination is marked with text and aria-current and is not a link. Guide pages start with all phases collapsed.
- Native details/summary controls support keyboard operation. Summary controls contain no nested links. The entire outline can collapse, including on mobile.
- Desktop layout places the outline alongside the reading content; narrow screens use one column. Controls have a minimum height of 44px and visible focus styling.
- A shared pure navigation model and label renderer reuse existing source ordering and original language. Links do not write progress or cursor state. No schema, dependencies, licence obligations, original archive or release-manifest changes.

## Evidence

| Check                                            | Result                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Unit/integration suite                           | 78 tests pass across nine files; final run 41.31 seconds                                              |
| Outline model                                    | All 578 unique entries; study/exercise destinations for all 182 days; correct current ancestry        |
| Representative rendered pages                    | Day 1, Day 125, Day 182, week, overview and appendix; all 214 groups, current state and links checked |
| Source component coverage                        | All 2329 mappings and 19 original hyperlink occurrences remain exact                                  |
| Browser, final version                           | All 214 groups present; Day 182 exercise opens phase 6/week 26/day 182 and marks the current exercise |
| Keyboard                                         | Phase/week/day expansion and destination navigation; whole outline toggles with Enter and Space       |
| Desktop 1440×900                                 | Document width and scroll width both 1425px                                                           |
| Mobile 360×800                                   | Document width and scroll width both 345px; outline collapses above content                           |
| TypeScript, ESLint, formatting, production build | Pass; two existing filesystem-tracing warnings remain                                                 |
| Archived source integrity                        | All ten files verified; 6 phases, 26 weeks, 182 days, 548 tasks preserved                             |
| Actual served-page audit                         | 663 pages pass; outline on all 594 curriculum pages and ordered navigation on all 546 day/unit pages  |

HTTP evidence: m3-step2-served-audit.json confirms authenticated access, missing-route behavior, all 2329 mappings/19 original hyperlinks and unchanged enrollment/progress/cursor after traversal. Screenshots: m3-step2-outline-desktop.png and m3-step2-outline-mobile.png. Published manifest remains 064d4412b280d54c7bf2fb229e7ec643eb3dc8ab85f9311bf9f9a5749c5cb265.

The rendered-source test releases each document before continuing, allowing native details events to settle rather than retaining hundreds of large trees. The HTTP audit reconstructs literal React $RS stream segments before inspecting nested menus; it never evaluates page scripts. This matches the final browser DOM, which was independently checked.

One earlier HTTP run encountered a transient compile error while imports were being renamed during hot reload. A later run exposed the audit's missing stream-segment assembly. Both incomplete runs are excluded from passing evidence; the final passing audit ran against stable source.

Reproduce using the isolated server/environment documented in M2-VERIFICATION.md:

```sh
node scripts/audit-served-curriculum.mjs --m3-step2
```

Browser/HTTP checks use the development server. Production browser/axe, manual screen-reader review and the full responsive matrix remain later gates. The mobile global navigation drawer is not part of this step.

## Next step, only after user confirmation

M3 step 3: daily workspace presentation — clear study/exercise entry points and original duration, objective, AI criterion and contextual resources. Preserve source text and read-only behavior; do not introduce M4 completion controls. Stop and ask again after verification.
