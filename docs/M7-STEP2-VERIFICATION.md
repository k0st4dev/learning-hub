# M7 step 2 — settings editor and owned appearance

Verified 2026-10-12. `/settings` is available before course enrollment and from both student navigation menus. It shows the owned email read-only, display name, timezone and theme, plus a local-storage explanation and existing Sign out action. Password change/recovery remain the next M7 work; this is not full M7 or MVP acceptance.

## Behavior

Settings use an explicit Save settings action. Initial owned refresh protects against cached navigation state. The form validates name/timezone, shows inline errors and announces pending, unsaved, error and confirmed states. Controls lock during reads/writes to prevent duplicate submissions or acknowledgment overwrites of newer typing. Failed requests retain draft fields and the original mutation identifier. Exact retries refresh the current owned state before accepting an old acknowledgment. Conflicts show the saved name/timezone/theme and require an explicit replace-or-discard decision. Foreign response identities are rejected; account failures offer a separate-tab login while preserving the draft.

Unsaved settings register with the existing shared navigation/logout/history protection and browser-close warning. The existing native dialog provides Stay/Leave decisions. Settings do not autosave during navigation. Only explicit confirmed saves refresh the server-rendered layout and navigation name.

The root layout renders the signed-in user's saved theme on the initial HTML. Explicit light/dark preferences override the OS preference; system follows the existing color-scheme media query. Shared palette and error colors are retained. Anonymous/expired-session pages use system mode. No account/progress data or theme is written to browser storage. Draft theme selections do not preview before confirmation.

## Evidence and limits

- Focused editor/navigation suite: 14 tests passed. Editor cases cover explicit save, trimming, inline timezone errors, uncertain retry with a newer saved version, both conflict choices, foreign acknowledgment, Stay/browser-close protection and pending-save deduplication.
- Full unit/integration suite: **554 tests in 46 files passed**, 92.30 seconds. A subsequent focused eight-test editor rerun passed after moving the navigation-state ref update to an effect to satisfy React lint rules.
- Type checking, full lint, production build and repository formatting pass. Build retains the two preexisting filesystem tracing warnings in configuration. No dependency, migration, seed, source archive or curriculum change; prior source/licence inventory evidence remains applicable.
- Actual HTTP after restarting the same local application/database: two existing synthetic accounts, six settings/dashboard/resources pages, exact owned fields, read-only email, both navigation links/current-page markers, server-rendered light and dark themes, anonymous login redirect, and unchanged fingerprints for 25 durable tables. No new synthetic accounts or settings writes were needed in this increment. See [HTTP evidence](m7-step2-http-audit.json); reproduce with `node scripts/audit-settings-page.mjs` and the existing preview data directory.
- Native browser tool initialization still fails with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. No native keyboard, hydration/theme-switch, computed contrast, screenshot or responsive visual pass is claimed. These checks, prior M6 browser closeout and final A01–A26 gates remain open; DOM and HTTP checks do not replace them.

Next separately approved increment: M7 password-change service/API requiring the current password and revoking sessions atomically, with persistence/ownership/security tests. Then add its UI and complete the remaining authentication/recovery checks. Continue asking before each focused step as requested.
