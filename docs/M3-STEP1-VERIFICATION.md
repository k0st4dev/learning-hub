# M3 step 1 — ordered reading navigation

Verified 2026-09-30 against specification section 15 and the navigation-only rule in section 7. This is one M3 increment, not completion of M3 or final A01–A26 acceptance.

## Delivered

- One pure navigation model orders published content by original day number and study-before-exercise order, independent of database row order, dates, completion or cursor.
- Study 1 → Exercise 1 → Study 2, through Exercise 182. First study offers Back to preparation; final exercise offers Review progress.
- Separate Previous day/Next day controls, with readable first/last-day boundary labels.
- Breadcrumbs and content links include day/week numbers and unchanged original titles. The current page uses aria-current and is not linked. Exercise breadcrumbs use module → week → day → exercise.
- Shared numbered labels distinguish repeated checkpoint titles and study/exercise destinations. Course contents no longer link back to themselves.
- Navigation uses ordinary links, has no mutations, and wraps into one column on narrow screens. No schema, source archive, published manifest or completion-rule changes.

## Evidence

| Check                                                                   | Result                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Unit/integration tests                                                  | 70 pass across nine files                                                                                          |
| Every unit's previous and next destination                              | All 364 pass, including week/phase transitions and both boundaries                                                 |
| Every day's previous and next destination                               | All 182 pass, including first/last boundaries                                                                      |
| Reordered input / duplicate titles / missing items / malformed ancestry | Correct order, stable IDs, null unknown result, guarded invalid ancestry                                           |
| Rendered component audit                                                | All original mappings/links/coordinates/anchors retained; every rendered unit link and current-page marker checked |
| Actual served-page audit                                                | 663 pages, 2329 mappings, 19 original hyperlinks; navigation on all 546 day/unit pages passes                      |
| Reading and learner state                                               | Enrollment snapshot, progress and cursor unchanged after traversal                                                 |
| Browser smoke                                                           | Keyboard navigation from Day 1 study → exercise → Day 2 study succeeds                                             |
| Mobile 360×800                                                          | Stacked links, readable labels, document width and scroll width both 345px                                         |
| TypeScript, ESLint, formatting, production build                        | Pass; existing two filesystem-tracing warnings remain                                                              |

Evidence files: m3-step1-served-audit.json and m3-step1-navigation-mobile.png. The source manifest remains 064d4412b280d54c7bf2fb229e7ec643eb3dc8ab85f9311bf9f9a5749c5cb265.

Reproduce the HTTP audit with the isolated server and environment described in M2-VERIFICATION.md:

```sh
node scripts/audit-served-curriculum.mjs --m3-step1
```

The flag preserves the earlier M2 report and writes separate M3 evidence. Browser/HTTP checks use the development server; full production browser/axe and manual screen-reader verification remain later gates.

## Next step, only after user confirmation

M3 step 2: compact expandable course outline showing phase → week → day → study/exercise, opening the current path, with keyboard and mobile checks. Stop and ask again before the following increment.
