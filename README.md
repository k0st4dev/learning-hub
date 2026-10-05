# Programming Learning Platform

A local programming-learning application built incrementally from the supplied 26-week manual. **Current increment: M5 step 1, explicit study completion and reference context; M4 exercise/checkpoint work complete.** All six phases, 26 weeks, 182 days, 548 task lines, guides, appendices and original links are available. Registration, login/logout and preparation work locally. Mobile Menu provides the same available destinations as desktop, traps keyboard focus, closes with Escape, and links to the existing course outline. Settings will join both menus when implemented in M7. Loading and recovery screens distinguish missing pages, setup needs and unavailable course data, with retry and Course/Dashboard navigation. Daily views show the original total time and weekly objective, with direct study/exercise links; the day overview includes the exact assignment, ordered tasks, resources and expanded AI policy and completion criterion. The outline opens the current phase, week and day, marks the current page, and supports keyboard and mobile use. Numbered breadcrumbs and Previous/Next follow the source order without changing progress. The exercise-rule evaluator now enforces atomic full-course API saves for decisions, scope and evidence; all 182 exercise screens now support explicit draft saving, confirmed completion, reopening, alternatives and Day 125 reflection. Failed saves preserve input; conflicts require an explicit resolution. Save drafts before using browser Back/Forward. All 25 checkpoints and the final exam now show original criteria and AI rules, save score evidence and review notes, and retain Needs review without completion credit. All 182 study lessons now support confirmed completion and explicit reopening, independently from exercise credit. Study this day deliberately selects unfinished work; Open reference preserves the active cursor. Completed review visits cannot replace unfinished study. Day views show exact 0/2, 1/2 or 2/2 fractions. Broader progress rollups, anchors and activity presentation remain in M5; the separate M1 Day 1 fixture retains its verified completion workflow. This is not the final MVP. See `PROJECT_STATUS.md`, `IMPLEMENTATION_PLAN.md` and [M3 verification](docs/M3-VERIFICATION.md).

## Requirements and cost

- Node.js **24.21.0** with npm **11.19.0**; patch-compatible versions in those lines are accepted. The exact tested runtime is in `.node-version` and `.nvmrc`.
- Git for obtaining the source. No separate database server, SQLite CLI, Docker, cloud keys or paid software is required.
- Windows x64 native modules have been checked. macOS/Linux clean-install evidence remains pending.
- Installation needs internet access. Accounts, the complete bundled curriculum and saved records run locally. External course resources need internet access.

Use the official [Node.js distribution](https://nodejs.org/dist/v24.21.0/). If an existing version manager reports a changed/untrusted npm script, do not blindly re-trust it. Repair that installation from its official source, or use a fresh official portable runtime after matching its SHA-256 against the official `SHASUMS256.txt`. This project does not modify system-wide Node settings.

## Install and run

From this repository directory:

```sh
npm ci
npm run setup
npm run dev
```

Open **http://127.0.0.1:3000**. Keep that terminal running; Ctrl+C stops the application. Always use the printed canonical address, not `localhost` or a LAN address.

For a production build of this preview:

```sh
npm run build
npm start
```

`setup` verifies native dependencies, applies the checksummed reference migration and imports the complete `se-26w-v1` release into `data/learning.sqlite` (or `APP_DATA_DIR`). Repeating it preserves existing accounts, enrollment releases and progress. The importer checks every archived file, validates source text and relationships, and publishes the complete release in one transaction. Changed published releases are rejected. Its machine-readable report is saved as `APP_DATA_DIR/curriculum-import-report.json`; rendered coverage evidence is recorded separately in `docs/M2-VERIFICATION.md`.

Register, sign in and start the course. Review or defer preparation, then browse the full curriculum. The increment notice identifies remaining learner tools. Study and exercise completion work across the full course; scorecard entry, notes and search remain later increments. Complete a study lesson explicitly, then follow Continue to exercise and confirm its tasks, evidence and passing self-assessment. Continue learning resumes the correct unfinished unit. Reference browsing preserves active study. Reload the page after restarting the development server before resuming an already-open client document.

To retain the earlier working completion demonstration, use `npm run setup:demo` followed by `npm run dev:demo` (or `npm run start:demo` after building). This uses the separate `.tmp/m1-demo/learning.sqlite` database and its `development-day1-v1` release. Keep that directory to retain your existing M1 accounts and records. Both databases are ignored by Git. Stop the running server before switching modes; do not delete either database.

In the M1 demonstration, register a local test account, start the course and review or defer preparation. Study Day 1, mark the lesson complete, then check its four tasks, enter evidence, select a passing self-assessment and attest the original criterion. Confirm completion. Sign out, stop the server, restart with `npm run dev:demo`, and sign in again: confirmed progress remains. This fixture has exactly two required units; its 100% means Day 1 only. The complete release has 364 required units.

## Curriculum maintenance

```sh
npm run curriculum:verify-source
npm run curriculum:import -- --dry-run
npm run curriculum:import
```

The dry run validates and reports without opening a database. Actual import requires an initialized database; ordinary `setup` handles both operations. The archive and its manifest are committed in `content/se-26w-v1`. Do not edit archived files, hashes or published content to bypass a validation failure. Future curriculum changes require a reviewed new release and explicit enrollment upgrade (M8).

`python scripts/audit-original-source.py` is an optional developer audit using Python's standard library. It independently compares DOCX paragraphs, links, table coordinates and CSV mappings against the structured source; Python is not needed to install or run the application. `scripts/audit-served-curriculum.mjs` verifies every served source destination and resource page against a running isolated `.tmp/m2-preview` server; reproduction commands are in `docs/M2-VERIFICATION.md`.

Dependency lifecycle scripts are disabled in `.npmrc`. The pinned native packages ship prebuilt modules; `setup`/`doctor` explicitly load and exercise them. This avoids implicit install scripts and allows deterministic installation on this restricted Windows host. Do not remove this policy or silently enable arbitrary installation scripts. A supported platform without a matching prebuilt module must fail clearly and receive a reviewed dependency/build-tool decision.

## Configuration and local security

Copy `.env.example` to `.env.local` only if changing defaults. Shell environment variables take precedence, then `.env.local`, then `.env`. Never commit local configuration.

| Setting        | Default                 | Meaning                                                                    |
| -------------- | ----------------------- | -------------------------------------------------------------------------- |
| `APP_MODE`     | `local`                 | Only local mode is supported.                                              |
| `APP_ORIGIN`   | `http://127.0.0.1:3000` | Exact permitted origin.                                                    |
| `PORT`         | `3000`                  | Must match the origin; 1024–65535.                                         |
| `APP_DATA_DIR` | `<repository>/data`     | Optional absolute path outside public/build/source/dependency directories. |
| `LOG_LEVEL`    | `info`                  | `error`, `warn`, or `info`; reserved for structured service logs.          |

Startup binds only to `127.0.0.1` in development and production. Wrong Host/Origin requests are rejected. Every write checks a signed, session-bound CSRF token. Argon2id uses 64 MiB, three iterations and parallelism one; at most two password operations run concurrently. Only session-token digests are stored. Persistent HttpOnly, SameSite=Lax cookies enforce seven-day idle and 30-day absolute limits. Login and registration throttles live in SQLite. CSP, frame restrictions and no-store responses are enabled. Next.js telemetry is disabled. System fonts and local styles have no CDN dependency.

The development launcher uses the public Next.js server API in a single process because this execution host restricts subprocess pipes. Production uses the standard Next.js CLI. Next builds use worker threads and the TypeScript API, retaining full type checks. TypeScript 6 and ESLint 9 are pinned for compatibility with the Next ESLint configuration; ESLint 9 reports an upstream support warning, so track migration when its React/accessibility plugins support ESLint 10. The dependency audit currently reports zero advisories.

## Verification

```sh
npm run doctor
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:integration
npm run build
npm run licenses:check
npm run curriculum:verify-source
```

Browser tests use a production build, isolated test browser, port 3100, both themes and five viewport sizes:

```sh
npm run test:install-browser
npm run test:e2e
```

The production foundation browser suite has not passed on the current restricted host: Playwright's child-process IPC fails with `EPERM`. This is recorded as pending, not a pass. M1's registration/completion/restart journey was exercised in the in-app development browser, alongside automated service and request-boundary tests. See `docs/M1-VERIFICATION.md`. Automated checks do not replace later screen-reader and real-computer-reboot review.

## Troubleshooting

- **Unsupported Node/npm:** use the pinned official runtime and retry `npm ci`.
- **Native module missing or ABI mismatch:** confirm Node 24.21.x and a matching OS/architecture, reinstall using `npm ci`, then run `npm run doctor`. It only touches a uniquely named temporary database. Do not delete a student database to fix dependencies.
- **No compatible prebuilt module:** ordinary students should not need a compiler. Stop and report the OS/architecture. If a source build is deliberately reviewed later, Windows needs Visual Studio 2022 Build Tools with Desktop development with C++, a supported Python and node-gyp; macOS needs Xcode command-line tools; Linux needs Python, make and a C++ compiler. No source-build fallback is currently advertised as verified.
- **Port in use:** stop the other application, or set matching `PORT` and `APP_ORIGIN` values. The app never silently switches ports.
- **Read-only data path:** choose a writable absolute `APP_DATA_DIR`. Setup never resets an existing database.
- **`spawn EPERM`:** this environment may prohibit subprocess pipes/IPC. Do not disable OS security protections. Use the verified build/test configuration; run the standard browser suite in an environment that permits its subprocesses.

## Repository and future data safety

`src/app` contains App Router pages; `src/server` contains configuration/request-boundary code; `scripts` contains cross-platform Node commands; `tests` contains unit, integration and browser checks. `src/i18n/en.ts` holds interface copy. Native database/auth imports stay out of browser components.

`data`, backups, secrets and temporary files are ignored by Git. Records live at `APP_DATA_DIR/learning.sqlite`, with a separate `csrf-secret` file. Transactions use foreign keys, WAL, synchronous FULL and revision/idempotency receipts. Existing migrations and published releases cannot change silently. Backup/restore, local password recovery and enrollment upgrades remain later milestones. Preserve the database, WAL/SHM files and secret; do not copy an open database as an improvised backup. No destructive placeholder recovery commands are provided.

The offline password blocklist is supplied by Django under its BSD licence; provenance and the complete notice are in `src/server/auth/BLOCKLIST.md` and `DJANGO-LICENSE.txt`.

Dependency licences and supplied notices are recorded in `docs/DEPENDENCIES.md`, `docs/dependency-licenses.json` and `docs/THIRD_PARTY_NOTICES.txt`. The supplied curriculum's authorship and text remain separate from third-party software licences.
