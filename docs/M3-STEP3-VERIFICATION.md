# M3 step 3 — daily workspace presentation

Verified 2026-10-01 against specification sections 5, 6 and 15. This is the read-only presentation increment, not completion of M3 or A01–A26.

## Delivered

- Every day, lesson and exercise shows the original total daily minutes, unchanged weekly objective, and direct Day overview / Study / Exercise navigation. The current destination is not linked and uses aria-current.
- The day overview contains the exact study assignment, contextual resource cards, all original task lines in order, and expanded original AI policy and completion criterion. Study is the primary action; focused exercise practice is a separate link.
- Source provenance, original table coordinates, stable anchors and original resource URLs remain intact. Existing resource cards are shared rather than duplicated. No invented daily objectives, per-exercise durations, links, hints or theory.
- Daily content uses a maximum 76ch reading column and reflows on mobile. Coding stays in the local IDE. Full-release completion controls, learner status and notes remain in their planned M4–M6 increments; the reading-preview notice remains explicit.
- No database migration, new dependency, source/archive change, published-release change or learner-state write.

## Evidence

| Check                                | Result                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/integration suite               | 84 tests across nine files pass, 54.27 seconds                                                                                                                                                    |
| Full daily model                     | Every one of 182 days resolves identically through its day, study and exercise routes; original minutes, weekly objective, assignment, tasks, AI policy, criterion and resource assignments match |
| Rendered daily cases                 | Days 1, 7, 28, 125 and 182 preserve ordered sections, tasks, direct links and unique expanded review anchors                                                                                      |
| Complete source-rendering regression | All 2329 mappings and 19 original hyperlink occurrences remain exact                                                                                                                              |
| Focused served HTTP checks           | 17 pages pass: five day/study/exercise trios, Week 26 and a resource; 62 mapped paragraphs, 15 daily/sequence checks, 16 outline checks                                                           |
| Auth and persistence regression      | Protected access and missing routes pass; enrollment, progress and cursor unchanged after reading                                                                                                 |
| Browser journey                      | Day 1 → Open study lesson using Enter → Exercise → Day overview; each destination and current marker confirmed                                                                                    |
| Desktop 1440×900                     | Document width and scroll width both 1425px                                                                                                                                                       |
| Mobile 360×800                       | Document width and scroll width both 345px; original task count preserved, AI policy and completion visible, outline collapsible                                                                  |
| TypeScript, ESLint, production build | Pass; two existing Turbopack filesystem-tracing warnings remain                                                                                                                                   |

HTTP evidence: m3-step3-served-audit.json. Screenshots: m3-step3-daily-desktop.png and m3-step3-daily-mobile.png.

The focused HTTP run does not claim to recheck all 663 pages; that complete served evidence remains in M3 step 2. This increment reruns complete source rendering in the integration suite and checks representative daily routes on the actual server. Production browser/axe, screen-reader verification and the complete responsive matrix remain later acceptance gates.

Reproduce with the isolated server/environment in M2-VERIFICATION.md:

```sh
node scripts/audit-served-curriculum.mjs --m3-step3
```

Published manifest remains 064d4412b280d54c7bf2fb229e7ec643eb3dc8ab85f9311bf9f9a5749c5cb265.

## Next step, only after user approval

M3 step 4: course route states — loading, unavailable/missing content, recoverable error messages and clear return navigation. Review existing boundaries first; preserve ownership checks and distinguish loading/errors from genuinely empty content. Do not add M4 completion controls. The full mobile navigation drawer and remaining presentation polish stay in later M3 steps.
