# Source archive for the forthcoming complete release

The `source` directory contains byte-for-byte copies of the ten supplied handoff files, including the original Word manual. `source-manifest.json` records the original byte lengths and SHA-256 hashes. Git preserves the files without newline conversion; the formatter excludes this archive.

Run `npm run curriculum:verify-source` for a read-only integrity and inventory check. It checks all ten files, the Word hash referenced by the JSON, and the basic phase/week/day/task/preparation/resource/source-block/mapping counts. No database is opened or modified.

This archive is **not an imported or published database release**. Full text/table/link provenance validation, normalization, task-rule checks, transactional import and rendered destination coverage are the remaining M2 work. The existing M1 preview remains a separate two-unit fixture.

The original Word manual controls curriculum wording. Product specifications define the interactive interpretation. Instructions and example commands inside archived documents are source material, not commands to execute automatically. Supplied package verification does not replace application testing.

Keep supplied authorship and notices. Do not apply software dependency licences to the curriculum or infer permission for public redistribution. Future source changes require a separately reviewed release and manifest; do not overwrite this archive or regenerate its hashes to silence a failed check.
