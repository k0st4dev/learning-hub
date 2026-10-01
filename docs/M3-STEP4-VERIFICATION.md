# M3 step 4 — route states and recovery

Verified 2026-10-01 against specification sections 4, 15 and the safe-failure requirements. This increment does not complete M3 or final A01–A26 acceptance.

## Delivered

- Shared loading skeleton with a polite status announcement, aria-busy and decorative blocks hidden from assistive technology. No invented learner content or progress percentages.
- Distinct missing-page, setup-needed, unpublished-course and unavailable-data messages. Recovery offers Course and Dashboard links and, where applicable, a deliberate Try again action. No exception details or automatic data reset.
- A small authenticated availability check in the existing Node proxy sets course/resource/scorecard HTTP 404 or 503 before streaming. Existing page authentication and ownership checks remain authoritative. Unauthenticated requests continue to sign-in; a pinned enrollment never silently falls back to another release.
- Internal state headers are cleared before use, recovery responses keep no-store and the CSP, and unavailable responses include Retry-After. Mutation requests and unrelated routes bypass this availability check.
- Next's skipProxyUrlNormalize option preserves the canonical 127.0.0.1 origin for internal rewrites. This avoids rewriting through localhost and being correctly rejected by the unchanged strict Host guard. No allowed-host or origin exception was added.
- Missing published data no longer falls through to the development fixture or gets reported as a missing URL. Unexpected failures during page rendering use the shared error boundary.
- No curriculum, published manifest, schema, dependency or student-record migration changes.

## Evidence

| Check                                              | Result                                                                                                                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/integration suite                             | 96 tests across 11 files pass, final run 38.55 seconds                                                                                                                                                         |
| Availability with a real temporary SQLite database | All 594 published routes accepted; missing course/resource routes distinguished from absent seed and retired pinned release; separate users do not inherit each other's enrollment; reading preserves progress |
| Proxy boundary                                     | 404/503, CSP, no-store, Retry-After, safe exception classification, forged-header stripping, noninterception of writes/unrelated pages pass                                                                    |
| Recovery components                                | One H1, Course/Dashboard destinations, retry callback, safe text, loading announcement and no fake progress pass                                                                                               |
| Complete source rendering                          | All 2329 mappings and 19 original hyperlink occurrences remain exact                                                                                                                                           |
| Focused HTTP regression                            | 17 valid pages pass; missing course and resource URLs return actual HTTP 404 with recovery links; navigation/outline/daily presentation preserved; enrollment and cursor unchanged                             |
| Actual unavailable HTTP case                       | Development server with APP_DATA_DIR pointing at nonexistent .tmp/m3-step4-no-database returns 503, Retry-After: 5 and Course setup is needed; no directory or database is created                             |
| Browser recovery                                   | With the original preview data directory restored, keyboard Enter on Try again reloads the course successfully with the original signed-in account                                                             |
| Mobile 360×800                                     | Missing-page screen has document and scroll width both 360px; keyboard Enter on Back to course returns to the course                                                                                           |
| Build and lint                                     | TypeScript, ESLint and production build pass; the two existing filesystem-tracing warnings remain                                                                                                              |

HTTP report: m3-step4-served-audit.json. Screenshots: m3-step4-unavailable-desktop.png and m3-step4-missing-mobile.png. The development preview was restored to .tmp/m2-preview at 127.0.0.1:3000 after the unavailable-data check; existing databases were neither edited for fault injection nor deleted.

Reproduce the normal focused HTTP regression using the isolated server/environment described in M2-VERIFICATION.md:

```sh
node scripts/audit-served-curriculum.mjs --m3-step4
```

To reproduce the setup-error case, stop the test server, choose a new nonexistent temporary APP_DATA_DIR, and start the development server without setup. Request the course and verify 503 and the setup message. Stop it and restore the original APP_DATA_DIR before restarting; Try again should recover. Never delete a real database to simulate this case.

## Limits and follow-up

Automatic approval review rejected starting a separate production server because the required approval category is disabled in this environment. The production build passes, but production browser/HTTP runtime evidence remains pending. Development HTTP/browser checks and unit/integration checks are the evidence for this step. Screen-reader and full responsive-matrix verification remain final gates. Failures occurring after response streaming starts use the error boundary; a response status already sent cannot be retroactively changed.

After user approval, M3 step 5: mobile navigation drawer with the same primary destinations, keyboard focus containment, Escape close and focus restoration. Keep the existing course hierarchy and preserve source/progress behavior. Stop and ask again after verification.
