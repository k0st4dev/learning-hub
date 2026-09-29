# M0 verification — 2026-09-29

## Passed

- Official portable Node.js 24.21.0 ZIP matched the vendor's SHA-256: `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`. npm 11.19.0 runs from that isolated installation. The machine-wide version manager was not modified.
- Independent clean directory: `npm ci`, `npm run setup`, `npm test` and `npm run test:integration` all passed. No dependencies were copied from the working installation.
- Native SQLite disk write, connection close/reopen and integrity check passed through better-sqlite3; Drizzle parameterized SQL passed.
- Argon2id hashing/verification passed at 64 MiB memory, three iterations and parallelism one; incorrect-password verification failed as expected.
- 23 configuration/request-boundary unit tests and three integration tests passed, including occupied-port and network-bind override rejection.
- TypeScript strict checking and ESLint passed. Production build passed with full Next.js TypeScript validation and both initial routes generated.
- Development server started on 127.0.0.1:3000 and returned HTTP 200. Production server started on 127.0.0.1:3100 and returned HTTP 200 before the browser automation attempt.
- In-app browser inspection confirmed the development page at 360px and 1440px; one H1, no horizontal overflow at those settled widths, and keyboard Tab reaches Skip to content. Screenshots are in this directory.
- npm reported zero dependency vulnerabilities after removing unused Drizzle Kit. Inventory contains 560 locked package records, including platform-optional dependencies; 574 supplied licence/notice files were preserved.

## Pending, not passed

- The 11-case Playwright/axe production browser suite is implemented but not executed successfully. This host rejects Playwright child-process IPC with `EPERM`; a separate CDP experiment also timed out and was removed from product code.
- A later production-server restart was rejected by automatic approval review because sandbox escalation is disabled. Earlier successful production startup/HTTP evidence remains valid; no rejected action was retried.
- Full dark-theme, viewport, screen-reader, 200% zoom and offline acceptance belongs to later milestones. The visual preview is not a WCAG conformance claim.
- macOS/Linux clean installation and real computer-reboot acceptance remain pending.
- ESLint 9 is compatible with the current Next React/accessibility plugin peers but reports an upstream support warning. Follow its supported upgrade path before release.

M0 foundation checks are complete. No student-account/progress or full MVP acceptance criterion is claimed complete yet. M1 is the next implementation gate.
