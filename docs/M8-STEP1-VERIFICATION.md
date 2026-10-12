# M8 step 1 — verified online backup

Date: 2026-10-12. Scope: the public backup CLI, immutable snapshot metadata, integrity verification and operator documentation. Restore and curriculum/enrollment upgrades are separate increments. No schema, dependency, curriculum or learning-rule change.

## Implemented behavior

`npm run backup` selects the same configured installation as setup/start and refuses extra arguments or missing database files. It uses `better-sqlite3`'s SQLite online backup API on an existing read-only connection. Ordinary learning writes stay available; `.setup.lock` fences supported migrations, recovery and other backups. Existing locks and changed lock ownership are retained rather than silently removed.

A unique private `.partial` directory holds the new snapshot until verification succeeds. Only this snapshot is finalized to DELETE journal mode, opened read-only and checked for SQLite integrity, foreign keys and exact reviewed migration checksums. Release hashes are read from the snapshot. The original ten-file archive is verified through the existing curriculum validator; the installed official release must match its immutable source/content hashes. Metadata also records three interpretation-file hashes, runtime and dependency-lock hash. The database and metadata files are flushed before the bundle is renamed to its final timestamp/UUID directory. Earlier backups are retained. Failed/interrupted partial directories are not verified backups.

Bundles contain `learning.sqlite`, `manifest.json` and `source-manifest.json`. All local users, password hashes, sessions and private learning records are in the database. No private record values or credentials appear in the manifest, reports or command output. CSRF secret/environment/lock files are excluded deliberately: the forthcoming stopped-server restore must revoke restored sessions and create a fresh secret. Keep the compatible source repository with a bundle; the source manifest inventories original files rather than embedding the Word manual/application.

Directory/file modes request 0700/0600; Windows inherits the selected storage permissions. README explains protected storage, separate-disk copies, .partial/stale-lock handling and current restore limits. Symlinked backup destinations are refused before writing into their targets.

## Automated and local checks

The backup integration suite covers the entire imported curriculum, two real Argon2id accounts, confirmed orientation/Day 1 lesson/exercise/tasks, receipts, private notes and exact next-lesson behavior. Every durable table is fingerprinted and compared before/after backup and against an isolated standalone copy. Fresh account login/private-note reads/Continue work in that copy; no old session token is treated as a restore guarantee. A second backup has a distinct directory and identical database bytes without overwriting the first.

A real native incremental transfer test commits an atomic two-account change from another connection while the backup has pages remaining; the snapshot passes integrity and contains the consistent committed pair. Negative cases cover missing database, foreign/stale fence, changed fence ownership, migration checksum/newer history, orphan foreign key, modified immutable release, symlink destination and driver/storage interruption. Failures preserve original records and refuse to publish a completed bundle.

The initial whole-curriculum test exceeded its 15-second limit while comparing large object/byte trees. It now compares exact per-table SHA-256 fingerprints and native byte equality, preserving all checks without raising the timeout. Final complete regression: **636 tests / 54 files pass in 191.55s**, including all eleven backup integration cases. Strict TypeScript, full ESLint, production build, original archive inventory/hash verification and licence checks pass. Two existing dynamic-filesystem tracing build warnings are retained. Repository formatting and diff checks pass at commit closeout.

Actual online CLI evidence is in [m8-step1-backup-audit.json](m8-step1-backup-audit.json). The supported script was invoked directly with the pinned portable Node runtime against the existing `.tmp/m2-preview` installation while its ordinary development server held its server lease. All **27 tables including accounts/sessions** matched the snapshot and remained unchanged; the original CSRF secret was unchanged; database/source-manifest checksums, DELETE journal mode, integrity/FK and both migrations passed. Source counts were queried directly: 6 phases, 26 weeks, 182 days, 548 task lines. Two existing synthetic recovery accounts could freshly log in to a separate verification copy, with their exact distinct private notes and different Continue destinations preserved. The live server served `/login` before/after and was not stopped for backup.

The audit uses separate prepare → public backup script → verify commands because this host rejects nested piped child-process launch with `spawn EPERM`. No permissions were broadened. An audit-only note-column typo was corrected before the final verification; application data and backup creation were unaffected. Synthetic credentials stay in ignored existing fixtures. Isolated verification directories are removed only after validating their fixed workspace parent/prefix. Finished ignored backup bundles remain available.

## Remaining gates

This is not the `restore` command or an A23 restore rehearsal. Stopped-server target confirmation, pre-replacement safety backup, session revocation, fresh secret, atomic replacement/rollback and actual restore acceptance follow in the next separately approved step. The existing migration backup behavior was retained; broader maintenance/update integration follows later in M8.

M6/M7 native browser closeout, manual accessibility/theme checks, clean setup on all supported operating systems, actual computer reboot and final A01–A26 acceptance remain open. This increment changes no pages, so no new native-browser result is claimed. Existing build tracing warnings are unrelated and retained.
