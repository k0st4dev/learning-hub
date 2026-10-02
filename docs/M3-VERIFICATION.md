# M3 — course navigation and reading integration

Date: 2026-10-02. Scope follows M3 in IMPLEMENTATION_PLAN.md and specification sections 15–18. This is the reading/navigation milestone, not final MVP acceptance.

## Step 6 changes

The scorecard heading, breadcrumb and course contents now say **Monthly scorecard**. A shared pure presentation renderer supplies this English UI label. The immutable source title and table retain **Oblast**, the original Serbian text, source coordinates and all 14 dimensions. Other curriculum titles retain their original language. The preview notice now accurately distinguishes completed reading/navigation from upcoming interactive exercises/progress.

There are no schema, import, release-hash, dependency or student-data changes.

## Integration evidence

- Unit/integration suite: 102 tests across 12 files pass. Includes all 182 daily workspaces, the 364-unit sequence and boundaries, full source rendering, immutable import/reseed/data preservation, authenticated availability, recovery and mobile focus behavior.
- ESLint, strict TypeScript and production build pass. The same two filesystem-tracing build warnings remain.
- Full served-page gate passes: 663 pages, 594 curriculum routes/outlines, 546 daily/sequence views, 663 navigation shells, all 2329 mappings and 19 original hyperlink occurrences. Strict missing routes and unchanged progress/cursor pass. Result recorded in `m3-final-served-audit.json`. Runs all daily/sequence, outline, mobile-shell and missing-route checks together, verifies exact mapped source text/table coordinates/anchors/URLs, and compares enrollment before and after reading. It also checks the scorecard heading, breadcrumb and overview link independently of the immutable source.
- Browser: scorecard at 1440×900 and 360×800; heading and original table coexist; all 14 dimensions visible in the document. No document overflow. On mobile the table remains within its own horizontal scroll region; keyboard ArrowRight moves it 40px. Course outline can be collapsed by keyboard. Screenshots: `m3-final-scorecard-desktop.png` and `m3-final-scorecard-mobile.png` (focused table).
- Previous verified interaction evidence remains in M3-STEP1 through M3-STEP5 reports: first/final boundaries, study/exercise/day navigation, current-path expansion, daily context, 404/503 and retry, modal keyboard focus and mobile-to-desktop resize.

The preview uses isolated `.tmp/m2-preview` synthetic accounts. The HTTP audit creates an isolated learner there and signs it out after comparison. Normal student data is not used.

## Acceptance status at M3

These are milestone evidence statuses, not a declaration that A01–A26 pass for the final product.

| Criteria     | Current evidence and remaining gate                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A01–A03      | M1 registration, canonical-email rejection, hashing/session protections verified; repeat against final release at M10                            |
| A04–A05      | Baseline sessions and account/progress isolation verified; password change/recovery and private notes/evidence/scorecard isolation require M6–M7 |
| A06–A09, A25 | Full content/import/source evidence plus M3 complete served-route audit; final production audit repeats at M10                                   |
| A10–A11      | Isolated Day 1 completion verified in M1; full-course task semantics require M4–M5                                                               |
| A12          | Reading/navigation does not change progress; external-link completion behavior is repeated with full interactive progress                        |
| A13–A18      | M1 fixture persistence/reopening/conflict/resume evidence retained; full-course workflow, notes, checkpoints and real reboot remain M4–M10 gates |
| A19          | Search is M6                                                                                                                                     |
| A20          | M3 keyboard and desktop/mobile evidence available; full viewport/theme/zoom/axe/screen-reader matrix remains M9                                  |
| A21–A22      | Local stack and nondestructive seed verified; disconnected operation and target-OS clean-install evidence remain pending                         |
| A23–A24      | Immutable, transactional no-op/failed-import tests pass; backup/restore and explicit mapped upgrades are M8                                      |
| A26          | No new dependency or deferred code runner/AI/cloud feature; final scope review remains M10                                                       |

## Boundaries and reproduction

Settings/account controls, search, score entry, notes, full exercise completion and full progress remain their agreed later milestones. The course uses the same available destinations on desktop/mobile. No date, prerequisite or completion-based reading locks were introduced.

Production runtime startup was previously blocked by automatic approval review; this turn did not retry or bypass it. Production Playwright/axe, real reboot, full browser shutdown, screen reader, offline and macOS/Linux checks are still pending final gates. A successful production build is not production runtime evidence.

With the approved Node runtime on PATH, run `npm run lint`, `npm test`, `npm run test:integration`, and `npm run build`. Against a development server using absolute APP_DATA_DIR `<repository>/.tmp/m2-preview`, run:

```text
node scripts/audit-served-curriculum.mjs --m3-final
```

The full audit intentionally visits every route and takes several minutes. Focused step flags remain available and preserve their earlier report files.

Next task, only after approval: M4 step 1, review the 33 non-default task rules and implement/test the pure exercise-requirement evaluator before adding persistence/UI changes.
