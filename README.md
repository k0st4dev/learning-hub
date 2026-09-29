# Programming Learning Platform

A local programming-learning application built incrementally from the supplied 26-week manual. **Current increment: M0 foundation preview.** Accounts, curriculum seeding and student progress are not implemented yet. Do not use this increment to record study progress. See `PROJECT_STATUS.md` for the exact next task and `IMPLEMENTATION_PLAN.md` for the agreed milestones.

## Requirements and cost

- Node.js **24.21.0** with npm **11.19.0**; patch-compatible versions in those lines are accepted. The exact tested runtime is in `.node-version` and `.nvmrc`.
- Git for obtaining the source. No separate database server, SQLite CLI, Docker, cloud keys or paid software is required.
- Windows x64 native modules have been checked. macOS/Linux clean-install evidence remains pending.
- Installation needs internet access. The app shell and future bundled account/content/progress features run locally. External course resources need internet access.

Use the official [Node.js distribution](https://nodejs.org/dist/v24.21.0/). If an existing version manager reports a changed/untrusted npm script, do not blindly re-trust it. Repair that installation from its official source, or use a fresh official portable runtime after matching its SHA-256 against the official `SHASUMS256.txt`. This project does not modify system-wide Node settings.

## Install and run

From this repository directory:

```sh
npm ci
npm run setup
npm run dev
```

Open **http://127.0.0.1:3000**. Keep that terminal running; Ctrl+C stops the application. Always use the printed canonical address, not `localhost` or a LAN address.

For regular local use after the complete app is delivered:

```sh
npm run build
npm start
```

At M0, `setup` verifies the runtime, native SQLite/Drizzle write-and-reopen operation, Argon2id, and data-directory writability. It does **not** create student accounts, migrate a student database or import a curriculum. Those operations are added by their milestones.

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

Startup binds only to `127.0.0.1` in development and production. Wrong Host/Origin requests are rejected. CSP, frame restrictions, no-store responses and basic security headers are in place. Authentication and CSRF tokens belong to M1 and must be implemented before private writes exist. Next.js telemetry is disabled by the launch scripts. System fonts and local styles have no CDN dependency.

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
```

Browser tests use a production build, isolated test browser, port 3100, both themes and five viewport sizes:

```sh
npm run test:install-browser
npm run test:e2e
```

The automated browser suite is written but has not passed on the current restricted host: Playwright's child-process IPC fails with `EPERM`. This is recorded as pending, not a pass. The already-running development preview has been inspected in the in-app browser. Automated accessibility checks do not replace later manual keyboard/screen-reader review.

## Troubleshooting

- **Unsupported Node/npm:** use the pinned official runtime and retry `npm ci`.
- **Native module missing or ABI mismatch:** confirm Node 24.21.x and a matching OS/architecture, reinstall using `npm ci`, then run `npm run doctor`. It only touches a uniquely named temporary database. Do not delete a student database to fix dependencies.
- **No compatible prebuilt module:** ordinary students should not need a compiler. Stop and report the OS/architecture. If a source build is deliberately reviewed later, Windows needs Visual Studio 2022 Build Tools with Desktop development with C++, a supported Python and node-gyp; macOS needs Xcode command-line tools; Linux needs Python, make and a C++ compiler. No source-build fallback is currently advertised as verified.
- **Port in use:** stop the other application, or set matching `PORT` and `APP_ORIGIN` values. The app never silently switches ports.
- **Read-only data path:** choose a writable absolute `APP_DATA_DIR`. Setup never resets an existing database.
- **`spawn EPERM`:** this environment may prohibit subprocess pipes/IPC. Do not disable OS security protections. Use the verified build/test configuration; run the standard browser suite in an environment that permits its subprocesses.

## Repository and future data safety

`src/app` contains App Router pages; `src/server` contains configuration/request-boundary code; `scripts` contains cross-platform Node commands; `tests` contains unit, integration and browser checks. `src/i18n/en.ts` holds interface copy. Native database/auth imports stay out of browser components.

`data`, backups, secrets and temporary files are ignored by Git. Future authoritative records will live at `APP_DATA_DIR/learning.sqlite`; confirmed progress must survive browser/server/computer restart. Backup, restore, local password recovery, complete curriculum import and enrollment upgrade commands are not available at M0; their documented implementation gates remain open. No destructive placeholder commands are provided.

Dependency licences and supplied notices are recorded in `docs/DEPENDENCIES.md`, `docs/dependency-licenses.json` and `docs/THIRD_PARTY_NOTICES.txt`. The supplied curriculum's authorship and text remain separate from third-party software licences.
