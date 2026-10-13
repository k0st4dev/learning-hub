# M8 Linux baseline (step 0)

Date: 2026-10-13. Scope: re-establish a verified development baseline on a new Linux host after development moved from Windows. No application, test, schema, dependency, curriculum or student-record change.

## Host and runtime

- Arch Linux x86_64, kernel 7.1.9, 8 logical CPUs, ~9 GiB RAM.
- System Node v26.7.0 is outside `engines` (`24.21.x`, `engine-strict=true`); it was not used and the policy was not relaxed.
- Official Node **v24.21.0 linux-x64** downloaded to user-local `~/.local/toolchain/node-v24.21.0-linux-x64`; tarball SHA-256 matched the official `SHASUMS256.txt` (`sha256sum -c` OK). The SHASUMS file's GPG signature was not verified. npm 11.19.0. Only the session `PATH` was changed; no system-wide setting.
- Previous Windows-only ignored state (`.tmp/m2-preview`, synthetic credentials, `data/`) is absent on this host and cannot be recovered from Git. Earlier evidence remains historical.

## Results

| Gate                                                  | Result                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm ci` (lockfile, `ignore-scripts=true`)            | Pass, 456 packages installed                                                                     |
| `npm run doctor`                                      | Pass: SQLite write/reopen/integrity, Drizzle, Argon2id 64 MiB/3/p1 using shipped Linux prebuilds |
| `npm run curriculum:verify-source`                    | Pass: 26 weeks, 182 days, 548 tasks, 7 preparation, 2365 source blocks, 2329 mappings            |
| `npm run typecheck`                                   | Pass                                                                                             |
| `npm run lint`                                        | Pass (ESLint 9 deprecation notice retained)                                                      |
| `npm test` (unit)                                     | Pass, 364 tests / 34 files                                                                       |
| `npm run test:integration` (default parallel)         | **Fail: 267/272 pass, 5 timeouts, no assertion failures**                                        |
| Same 4 files, `--no-file-parallelism`                 | Pass, 127/127                                                                                    |
| `npm run build`                                       | Pass; the two existing Turbopack tracing warnings retained                                       |
| `npm run format:check`                                | Pass                                                                                             |
| `npm run licenses:check`                              | **Fail: inventory stale only for platform-optional packages**                                    |
| `APP_DATA_DIR=.tmp/linux-preview npm run setup` twice | Pass: migrations 0001/0002, full import 182/548/364; repeat is a no-op                           |

`npm audit`: 7 high-severity advisories (`next` 16.3.7 direct; `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`; `source-map-js`). Recorded only; dependency updates need separate approval.

## Findings

1. **Integration timeouts under parallel load.** In the full parallel run the 15 s/60 s per-test limits were exceeded by 4 whole-curriculum tests and the 364-unit transaction test. Isolated serial durations: 9.1 s, 7.5 s, 10.9 s, 7.8 s (15 s limit) and 32.6 s (60 s limit). These are host-load timing limits; behavior assertions pass. Not fixed: options are a documented serial/limited-worker integration run or reviewed per-test limits, without removing assertions.
2. **Licence check is host-platform dependent.** `scripts/licenses.mjs` collects notice files from installed `node_modules`. The committed inventory was generated on Windows (`@img/sharp-win32-x64`, `@tailwindcss/oxide-win32-x64-msvc`, `lightningcss-win32-x64-msvc` ×2 notices). On Linux the corresponding `linux-x64(-gnu)` notices replace them. Package count (560), licence identifiers and notice count (574) are identical. A dry run wrote only to a scratch directory; committed docs were not regenerated. Fix needs a decision: make the check platform-independent rather than regenerate per host.
3. Setup creates `learning.sqlite` with mode 0644 under the default umask while `csrf-secret` is 0600. Recorded for the M8/M10 permissions review; no change.

## Not covered

No dev server, HTTP audits, browser checks or new synthetic accounts in this step. M8 step 2 restore has not started.
