# Programming Learning Platform

A local programming-learning application built incrementally from the supplied 26-week manual. **Current increment: M1, a working Day 1 preview.** Registration, login/logout, preparation, the original first lesson and four exercise tasks, evidence, completion and restart persistence are implemented. This is an isolated development fixture, not the complete course or final MVP. See `PROJECT_STATUS.md` for the exact next task and `IMPLEMENTATION_PLAN.md` for the agreed milestones.

## Requirements and cost

- Node.js **24.21.0** with npm **11.19.0**; patch-compatible versions in those lines are accepted. The exact tested runtime is in `.node-version` and `.nvmrc`.
- Git for obtaining the source. No separate database server, SQLite CLI, Docker, cloud keys or paid software is required.
- Windows x64 native modules have been checked. macOS/Linux clean-install evidence remains pending.
- Installation needs internet access. Accounts, bundled Day 1 content and progress run locally. External course resources need internet access.

Use the official [Node.js distribution](https://nodejs.org/dist/v24.21.0/). If an existing version manager reports a changed/untrusted npm script, do not blindly re-trust it. Repair that installation from its official source, or use a fresh official portable runtime after matching its SHA-256 against the official `SHASUMS256.txt`. This project does not modify system-wide Node settings.

## Install and run

From this repository directory:

```sh
npm ci
npm run setup:demo
npm run dev:demo
```

Open **http://127.0.0.1:3000**. Keep that terminal running; Ctrl+C stops the application. Always use the printed canonical address, not `localhost` or a LAN address.

For a production build of this preview:

```sh
npm run build
npm run start:demo
```

`setup:demo` verifies native dependencies, applies the checksummed reference migration and seeds a clearly named `development-day1-v1` release in `.tmp/m1-demo/learning.sqlite`. Repeat setup preserves accounts, tasks, evidence and completion. Keep this directory to retain your preview records; it is ignored by Git and is not an official student release. Do not delete it while the app is running. Ordinary `setup` creates the reference schema in `APP_DATA_DIR` but does not yet import the full curriculum; the M2 importer will provide that operation.

Register your own local test account, sign in, select Start course, and complete or explicitly defer preparation. Study Day 1, mark the lesson complete, then check the four original task lines, enter evidence, select a passing self-assessment and attest the original criterion. Confirm completion. Sign out, stop the server, restart with `npm run dev:demo`, and sign in again: confirmed progress remains. This fixture has exactly two required units; its 100% means Day 1 only. The full course will have 364 units.

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

`data`, backups, secrets and temporary files are ignored by Git. Records live at `APP_DATA_DIR/learning.sqlite`, with a separate `csrf-secret` file. Transactions use foreign keys, WAL, synchronous FULL and revision/idempotency receipts. Existing migrations and seeded fixture releases cannot change silently. Backup/restore, local password recovery, complete curriculum import and enrollment upgrades remain later milestones. Preserve the database, WAL/SHM files and secret; do not copy an open database as an improvised backup. No destructive placeholder recovery commands are provided.

The offline password blocklist is supplied by Django under its BSD licence; provenance and the complete notice are in `src/server/auth/BLOCKLIST.md` and `DJANGO-LICENSE.txt`.

Dependency licences and supplied notices are recorded in `docs/DEPENDENCIES.md`, `docs/dependency-licenses.json` and `docs/THIRD_PARTY_NOTICES.txt`. The supplied curriculum's authorship and text remain separate from third-party software licences.
