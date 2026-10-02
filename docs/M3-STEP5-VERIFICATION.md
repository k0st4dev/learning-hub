# M3 step 5 — mobile navigation

Verified 2026-10-02 against specification section 15. This increment does not complete M3 or final A01–A26 acceptance.

## Delivered

- Shared destinations for desktop and mobile: Dashboard, Course, Progress and Resources. Settings remains scheduled for M7; neither menu exposes an unimplemented page. The isolated M1 fixture omits full-release resources.
- Below 1024px, an accessible Menu trigger opens a native modal drawer. Labelled dialog, initial Close menu focus, explicit Tab/Shift+Tab wrapping, Escape close, trigger focus restoration, background scroll lock and close after navigation. Resizing to desktop closes the drawer and focuses the visible desktop navigation.
- Course outline jumps to and focuses the existing outline on the current page; from Dashboard it navigates to the course outline anchor. There is no duplicate course hierarchy. Compact mobile breadcrumbs retain every ancestor in a horizontally scrollable row.
- No database, immutable curriculum, release, dependency or progress changes.

## Evidence

| Check                     | Result                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit/integration suite    | 102 tests across 12 files pass; final run 38.31 seconds                                                                                                                                                |
| Navigation component      | Shared destinations/current marker, both focus-wrap directions, Escape/close focus and scroll restoration, route-change close, desktop resize, unmount cleanup, outline link and fixture behavior pass |
| Complete source rendering | Existing integration tests preserve all 2329 mappings and 19 original hyperlink occurrences                                                                                                            |
| HTTP regression           | 17 pages pass, including 17 matching desktop/mobile shells, 16 outlines and 15 daily/sequence views; strict missing-route 404 checks pass; progress/cursor unchanged                                   |
| Browser keyboard          | Enter opens and focuses Close menu; Tab from Sign out wraps to Close menu; Shift+Tab wraps back; Escape closes, restores Menu focus and unlocks scroll                                                 |
| Browser navigation        | Existing outline opens/focuses without duplication; Dashboard → Course outline returns to course; Dashboard, Resources and Progress destinations close the menu and render                             |
| Responsive browser        | 360×800 and 320×568 drawer fits without document overflow; 1440×900 shows desktop links, closes any open drawer and restores visible navigation focus                                                  |
| Build                     | ESLint, TypeScript and production build pass; two existing filesystem-tracing warnings remain                                                                                                          |

The first browser check exposed native dialog focus escaping into browser chrome; explicit boundary wrapping was added and verified in both unit tests and the real browser. Browser evidence used the existing development preview with synthetic data in `.tmp/m2-preview`. Production runtime and full screen-reader/axe acceptance retain their previously documented pending status; no new production startup attempt was made.

Screenshots: [mobile](m3-step5-mobile.png), [desktop](m3-step5-desktop.png). Machine-readable HTTP evidence: [served audit](m3-step5-served-audit.json).

## Reproduction

With the approved Node runtime on PATH, run:

```text
npm run lint
npm test
npm run test:integration
npm run build
```

Against the isolated development preview, set APP_DATA_DIR to the repository's absolute `.tmp/m2-preview` directory, then run `node scripts/audit-served-curriculum.mjs --m3-step5`. The audit creates only a synthetic account, compares enrollment before/after reading and signs it out. It refuses other data-directory configurations.

Next, only after user approval: M3 step 6, scorecard heading and final M3 navigation/curriculum integration gate. Full-course completion controls remain M4–M5.
