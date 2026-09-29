# Dependency licences and notices

No required package has a licence fee, subscription, credit-card requirement, hosted runtime service or paid API. Versions are locked in `package-lock.json`; runtime dependencies do not contact a cloud database or auth provider.

| Component                          | Pinned version | Licence                                          |
| ---------------------------------- | -------------- | ------------------------------------------------ |
| Next.js                            | 16.3.7         | MIT                                              |
| React / React DOM                  | 19.3.0         | MIT                                              |
| Drizzle ORM                        | 0.45.3         | Apache-2.0                                       |
| better-sqlite3                     | 13.0.3         | MIT; SQLite has its own public-domain dedication |
| Argon2 binding                     | 0.45.1         | MIT; bundled algorithm notices are preserved     |
| Zod                                | 4.6.5          | MIT                                              |
| Tailwind CSS / PostCSS integration | 4.3.3          | MIT                                              |
| TypeScript                         | 6.0.3          | Apache-2.0                                       |
| Vitest                             | 5.0.2          | MIT                                              |
| Playwright Test                    | 1.63.0         | Apache-2.0                                       |
| axe Playwright integration         | 4.13.0         | MPL-2.0                                          |

The machine-readable inventory covers the entire lockfile, including platform-specific optional packages and development dependencies. `THIRD_PARTY_NOTICES.txt` preserves supplied licence/notice files from this installation, including vendored component notices inside Next.js. Original files remain in npm's packages. Regenerate and review the inventory after dependency changes. Cross-platform installations may provide additional native notice files and must preserve them before distributing binary artifacts.

Next.js includes Sharp and platform-dependent libvips binaries. These include Apache-2.0 and LGPL-3.0-or-later components; they are free software, not paid dependencies. The delivered source uses unmodified npm packages and retains their notices. The corresponding native-library source/build recipes are available through [sharp-libvips](https://github.com/lovell/sharp-libvips); native dependency versions and upstream copyrights appear in the packages' bundled notices. Preserve licence texts, corresponding-source access and relinking rights when redistributing native binaries; do not strip these files from a packaged release. See the [upstream installation documentation](https://sharp.pixelplumbing.com/install/) for supported prebuilt platforms.

MPL components are unmodified test tools. No fonts or icons are downloaded at runtime; the UI uses OS fonts and text. The app's source and supplied curriculum have not been assigned an unsolicited redistribution licence.

Current decision: omit unused Drizzle Kit until migration generation is actually needed. Its optional legacy loader introduced four development-only advisory entries; removing that unused tool leaves zero reported npm advisories without changing the selected Drizzle ORM.

Upstream technical references: [Next.js setup](https://nextjs.org/docs/app/getting-started/installation), [Drizzle SQLite](https://orm.drizzle.team/docs/get-started/sqlite-new), [Argon2 binding](https://github.com/ranisalt/node-argon2). Registry metadata was checked on 2026-09-29. A passed advisory audit is a point-in-time result, not a guarantee about future releases.
