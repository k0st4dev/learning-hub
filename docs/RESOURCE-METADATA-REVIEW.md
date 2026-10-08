# Resource metadata review — proposal only

Date: 2026-10-08. **No runtime/import/database/source change. Approval is required before applying these interpretations.** Original Word/content remains authoritative; these are separately labeled product interpretations.

Reviewed: **69 existing resource records, 290 uses, 208 source mentions, all 12 supplied URLs and 19 hyperlink uses**. The original has 57 unresolved instruction records; many mean no new external resource rather than a missing website. Complete exact text, source coordinates, hashes, raw values and per-use explanations are in [the proposal](resource-metadata-proposal.json).

## Proposed canonical types/providers

| Resource                       | Type          | Provider         | Source              |
| ------------------------------ | ------------- | ---------------- | ------------------- |
| The Odin Project — Foundations | course        | The Odin Project | p0082, p0083, p0084 |
| The Odin Project — JavaScript  | course        | The Odin Project | p0085, p0086, p0087 |
| CS50x 2026                     | course        | CS50             | p0088, p0089, p0090 |
| CS50x Problem Sets             | practice      | CS50             | p0091, p0092, p0093 |
| Full Stack Open                | course        | Full Stack Open  | p0094, p0095, p0096 |
| Exercism — JavaScript          | practice      | Exercism         | p0097, p0098, p0099 |
| MDN JavaScript Guide           | documentation | MDN              | p0100, p0101, p0102 |
| javascript.info                | article       | javascript.info  | p0103, p0104, p0105 |
| React Learn                    | documentation | React            | p0106, p0107, p0108 |
| Node.js Docs                   | documentation | Node.js          | p0109, p0110, p0111 |
| Pro Git                        | reference     | Pro Git          | p0112, p0113, p0114 |
| PostgreSQL Tutorial            | documentation | PostgreSQL       | p0115, p0116, p0117 |

Providers follow names already in the manual; authors/institutions are not invented. javascript.info → article is a medium-confidence vocabulary choice for its tutorial/reference role. Unnamed/composite documentation keeps an unspecified provider.

## Rules and material cases

- **catalog-reference**: Catalog/source-status links are references, not a new assignment.
- **weekly-overview**: Weekly resource lists are overview references; explicit optional clauses take priority.
- **daily-assignment**: A named resource in Uči / pročitaj is assigned reading of the named section only (p0025). No external course-wide completion is implied.
- **as-needed-reference**: po potrebi/as reference/preview or personal notes remain supporting references; not mandatory external coursework.
- **explicit-optional**: An explicit optional clause, or its same-provider weekly optional designation, is optional.
- **alternative-choice**: An explicit alternative is conditional on the selected route; do not require both sources.
- **used-topics-condition**: Only the topics used in the learner project are applicable; do not prescribe the whole course/docs.
- **problem-set-primary**: The selected problem-set registry is the assigned source; the general CS50 parent is reference navigation.
- **manual-instruction**: This record preserves a source instruction/review topic, not a newly supplied external learning link.
- **unspecified-documentation**: Documentation is specified but its provider/library is not; retain this uncertainty.
- **resource-restriction**: Preserve the exact no-new-resource/no-tutorial/first-120-minutes restriction; never turn it into a resource requirement.

Day 25 (p0530) is TOP **or** Jest; Day 83 (p1152) is Exercism **or custom problems**. Conditional labels cannot make both obligatory. Day 113/p1479 assigns CS50, with TOP Linked Lists optional; the TOP optional status extends only to that provider in week 17/p1475. Day 127/p1629 assigns CS50 with PostgreSQL/SQLite docs as needed. Day 146/p1831 restricts React/FSO to used topics. Day 182/p2218 forbids resources during the first 120 minutes; its internal instruction is not required external reading.

Generic early TOP parent bindings and implicit FSO scopes need reviewed presentation corrections. Named tools/Jest/ESLint/SQLite/Express/CS50 Practice hidden inside compound instructions need visible mentions. These are proposals, with exact source text retained and **no new direct URL**. For pg/sqlite, the package/provider choice is explicitly unresolved.

## All existing resources

| Key              | Original title                                                                               | Type          | Provider         | Category              | Ambiguous | Source              |
| ---------------- | -------------------------------------------------------------------------------------------- | ------------- | ---------------- | --------------------- | --------- | ------------------- |
| res-01           | The Odin Project — Foundations                                                               | course        | The Odin Project | named-resource        | no        | p0082, p0083, p0084 |
| res-02           | The Odin Project — JavaScript                                                                | course        | The Odin Project | named-resource        | no        | p0085, p0086, p0087 |
| res-03           | CS50x 2026                                                                                   | course        | CS50             | named-resource        | no        | p0088, p0089, p0090 |
| res-04           | CS50x Problem Sets                                                                           | practice      | CS50             | named-resource        | no        | p0091, p0092, p0093 |
| res-05           | Full Stack Open                                                                              | course        | Full Stack Open  | named-resource        | no        | p0094, p0095, p0096 |
| res-06           | Exercism — JavaScript                                                                        | practice      | Exercism         | named-resource        | no        | p0097, p0098, p0099 |
| res-07           | MDN JavaScript Guide                                                                         | documentation | MDN              | named-resource        | no        | p0100, p0101, p0102 |
| res-08           | javascript.info                                                                              | article       | javascript.info  | named-resource        | yes       | p0103, p0104, p0105 |
| res-09           | React Learn                                                                                  | documentation | React            | named-resource        | no        | p0106, p0107, p0108 |
| res-10           | Node.js Docs                                                                                 | documentation | Node.js          | named-resource        | no        | p0109, p0110, p0111 |
| res-11           | Pro Git                                                                                      | reference     | Pro Git          | named-resource        | no        | p0112, p0113, p0114 |
| res-12           | PostgreSQL Tutorial                                                                          | documentation | PostgreSQL       | named-resource        | no        | p0115, p0116, p0117 |
| unresolved-p0325 | Bez nove teorije. Koristi samo ono iz dana 1–5.                                              | guide         | Original manual  | source-instruction    | no        | p0325               |
| unresolved-p0335 | Ponovi svoje notes, bez novih resursa.                                                       | guide         | Original manual  | source-instruction    | no        | p0335               |
| unresolved-p0400 | Kombinuj strings, loops, functions, objects, error handling.                                 | guide         | Original manual  | source-instruction    | no        | p0400               |
| unresolved-p0410 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p0410               |
| unresolved-p0465 | Bez nove teorije. Fokus na modelovanju.                                                      | guide         | Original manual  | source-instruction    | no        | p0465               |
| unresolved-p0475 | Node, bez UI. Arrays/objects/functions.                                                      | guide         | Original manual  | source-instruction    | no        | p0475               |
| unresolved-p0485 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p0485               |
| unresolved-p0550 | Funkcije, closures/modules, tests.                                                           | guide         | Original manual  | source-instruction    | no        | p0550               |
| unresolved-p0560 | Ponovi sve iz nedelja 1–4.                                                                   | guide         | Original manual  | source-instruction    | no        | p0560               |
| unresolved-p0625 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p0625               |
| unresolved-p0635 | Ponovi DOM/events.                                                                           | guide         | Original manual  | source-instruction    | no        | p0635               |
| unresolved-p0670 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p0670               |
| unresolved-p0680 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p0680               |
| unresolved-p0700 | Bez tutoriala. DOM + state + arrays/objects.                                                 | guide         | Original manual  | source-instruction    | no        | p0700               |
| unresolved-p0710 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p0710               |
| unresolved-p0747 | DOM + odvajanje logike.                                                                      | guide         | Original manual  | source-instruction    | no        | p0747               |
| unresolved-p0777 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p0777               |
| unresolved-p0787 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p0787               |
| unresolved-p0812 | DOM/events.                                                                                  | guide         | Original manual  | source-instruction    | no        | p0812               |
| unresolved-p0852 | Moduli/classes/factories po izboru.                                                          | guide         | Original manual  | source-instruction    | no        | p0852               |
| unresolved-p0862 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p0862               |
| unresolved-p0897 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p0897               |
| unresolved-p0927 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p0927               |
| unresolved-p0937 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p0937               |
| unresolved-p0962 | Bez UI-a.                                                                                    | guide         | Original manual  | source-instruction    | no        | p0962               |
| unresolved-p0972 | DOM/forms.                                                                                   | guide         | Original manual  | source-instruction    | no        | p0972               |
| unresolved-p1012 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p1012               |
| unresolved-p1077 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p1077               |
| unresolved-p1087 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1087               |
| unresolved-p1162 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1162               |
| unresolved-p1314 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p1314               |
| unresolved-p1389 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1389               |
| unresolved-p1464 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1464               |
| unresolved-p1529 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p1529               |
| unresolved-p1539 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1539               |
| unresolved-p1594 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p1594               |
| unresolved-p1604 | Dokumentacija kao primarni alat.                                                             | documentation | unspecified      | unspecified-reference | yes       | p1604               |
| unresolved-p1614 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1614               |
| unresolved-p1679 | Node pg/sqlite library docs; fokus na konceptu parameterized queries.                        | documentation | unspecified      | composite-reference   | yes       | p1679               |
| unresolved-p1756 | Završi Part1 exercises koje si započeo.                                                      | guide         | Original manual  | source-instruction    | no        | p1756               |
| unresolved-p1766 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1766               |
| unresolved-p1821 | Bez backend-a. Koristi postojeći Expense Tracker model kao inspiraciju, ne copy-paste.       | guide         | Original manual  | source-instruction    | no        | p1821               |
| unresolved-p1841 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1841               |
| unresolved-p1906 | Završi preostale core exercises.                                                             | guide         | Original manual  | source-instruction    | no        | p1906               |
| unresolved-p1916 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1916               |
| unresolved-p1991 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p1991               |
| unresolved-p2066 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p2066               |
| unresolved-p2121 | Spoji React frontend sa Part4 backendom.                                                     | guide         | Original manual  | source-instruction    | no        | p2121               |
| unresolved-p2131 | Završi core exercises u ciljnom opsegu.                                                      | guide         | Original manual  | source-instruction    | no        | p2131               |
| unresolved-p2141 | Bez novih resursa.                                                                           | guide         | Original manual  | source-instruction    | no        | p2141               |
| unresolved-p2158 | Bez tutoriala. Koristi dokumentaciju po potrebi.                                             | reference     | unspecified      | composite-reference   | yes       | p2158               |
| unresolved-p2168 | Dokumentacija + tvoje prethodne beleške.                                                     | reference     | unspecified      | composite-reference   | yes       | p2168               |
| unresolved-p2178 | Testing/security notes.                                                                      | guide         | Original manual  | source-instruction    | no        | p2178               |
| unresolved-p2198 | Testing notes.                                                                               | guide         | Original manual  | source-instruction    | no        | p2198               |
| unresolved-p2208 | Bez nove teorije.                                                                            | guide         | Original manual  | source-instruction    | no        | p2208               |
| unresolved-p2218 | Bez resursa prvih 120 min.                                                                   | guide         | Original manual  | source-instruction    | no        | p2218               |
| unresolved-p2152 | Dokumentacija po potrebi, Tvoji prethodni projekti/notes, AI samo nakon samostalnog pokušaja | reference     | unspecified      | composite-reference   | yes       | p2152               |

## All existing uses

All raw assignments/locators/IDs remain in the JSON. required denotes the assigned section/concept, not a new completion gate, resource click or whole external course.

| Use key           | Raw resource     | Context             | Proposed mode | Rule                      | Source              | Ambiguous |
| ----------------- | ---------------- | ------------------- | ------------- | ------------------------- | ------------------- | --------- |
| mention:1:0       | res-01           | d001-learn          | required      | daily-assignment          | p0274, p0025        | no        |
| mention:2:0       | res-07           | d002-learn          | required      | daily-assignment          | p0285, p0025        | no        |
| mention:2:1       | res-08           | d002-learn          | required      | daily-assignment          | p0285, p0025        | no        |
| mention:3:0       | res-02           | d003-learn          | required      | daily-assignment          | p0295, p0025        | yes       |
| mention:3:1       | res-08           | d003-learn          | required      | daily-assignment          | p0295, p0025        | no        |
| mention:4:0       | res-07           | d004-learn          | required      | daily-assignment          | p0305, p0025        | no        |
| mention:4:1       | res-08           | d004-learn          | required      | daily-assignment          | p0305, p0025        | no        |
| mention:5:0       | res-07           | d005-learn          | required      | daily-assignment          | p0315, p0025        | no        |
| mention:5:1       | res-08           | d005-learn          | required      | daily-assignment          | p0315, p0025        | no        |
| mention:6:0       | unresolved-p0325 | d006-learn          | reference     | resource-restriction      | p0325               | yes       |
| mention:7:0       | unresolved-p0335 | d007-learn          | reference     | manual-instruction        | p0335               | no        |
| mention:8:0       | res-02           | d008-learn          | required      | daily-assignment          | p0350, p0025        | yes       |
| mention:8:1       | res-08           | d008-learn          | required      | daily-assignment          | p0350, p0025        | no        |
| mention:9:0       | res-07           | d009-learn          | required      | daily-assignment          | p0360, p0025        | no        |
| mention:9:1       | res-08           | d009-learn          | required      | daily-assignment          | p0360, p0025        | no        |
| mention:10:0      | res-02           | d010-learn          | required      | daily-assignment          | p0370, p0025        | yes       |
| mention:10:1      | res-08           | d010-learn          | required      | daily-assignment          | p0370, p0025        | no        |
| mention:11:0      | res-07           | d011-learn          | required      | daily-assignment          | p0380, p0025        | no        |
| mention:11:1      | res-08           | d011-learn          | required      | daily-assignment          | p0380, p0025        | no        |
| mention:12:0      | res-02           | d012-learn          | required      | daily-assignment          | p0390, p0025        | yes       |
| mention:13:0      | unresolved-p0400 | d013-learn          | reference     | manual-instruction        | p0400               | no        |
| mention:14:0      | unresolved-p0410 | d014-learn          | reference     | resource-restriction      | p0410               | yes       |
| mention:15:0      | res-07           | d015-learn          | required      | daily-assignment          | p0425, p0025        | no        |
| mention:15:1      | res-08           | d015-learn          | required      | daily-assignment          | p0425, p0025        | no        |
| mention:16:0      | res-07           | d016-learn          | required      | daily-assignment          | p0435, p0025        | no        |
| mention:16:1      | res-08           | d016-learn          | required      | daily-assignment          | p0435, p0025        | no        |
| mention:17:0      | res-07           | d017-learn          | required      | daily-assignment          | p0445, p0025        | no        |
| mention:17:1      | res-08           | d017-learn          | required      | daily-assignment          | p0445, p0025        | no        |
| mention:18:0      | res-08           | d018-learn          | required      | daily-assignment          | p0455, p0025        | no        |
| mention:19:0      | unresolved-p0465 | d019-learn          | reference     | resource-restriction      | p0465               | yes       |
| mention:20:0      | unresolved-p0475 | d020-learn          | reference     | manual-instruction        | p0475               | no        |
| mention:21:0      | unresolved-p0485 | d021-learn          | reference     | resource-restriction      | p0485               | yes       |
| mention:22:0      | res-07           | d022-learn          | required      | daily-assignment          | p0500, p0025        | no        |
| mention:22:1      | res-08           | d022-learn          | required      | daily-assignment          | p0500, p0025        | no        |
| mention:23:0      | res-08           | d023-learn          | required      | daily-assignment          | p0510, p0025        | no        |
| mention:24:0      | res-07           | d024-learn          | required      | daily-assignment          | p0520, p0025        | no        |
| mention:24:1      | res-08           | d024-learn          | required      | daily-assignment          | p0520, p0025        | no        |
| mention:25:0      | res-02           | d025-learn          | conditional   | alternative-choice        | p0530, p0025        | yes       |
| mention:26:0      | res-02           | d026-learn          | required      | daily-assignment          | p0540, p0025        | yes       |
| mention:26:1      | res-08           | d026-learn          | required      | daily-assignment          | p0540, p0025        | no        |
| mention:27:0      | unresolved-p0550 | d027-learn          | reference     | manual-instruction        | p0550               | no        |
| mention:28:0      | unresolved-p0560 | d028-learn          | reference     | manual-instruction        | p0560               | no        |
| mention:29:0      | res-02           | d029-learn          | required      | daily-assignment          | p0575, p0025        | yes       |
| mention:29:1      | res-08           | d029-learn          | required      | daily-assignment          | p0575, p0025        | no        |
| mention:30:0      | res-02           | d030-learn          | required      | daily-assignment          | p0585, p0025        | yes       |
| mention:30:1      | res-08           | d030-learn          | required      | daily-assignment          | p0585, p0025        | no        |
| mention:31:0      | res-02           | d031-learn          | required      | daily-assignment          | p0595, p0025        | yes       |
| mention:32:0      | res-02           | d032-learn          | required      | daily-assignment          | p0605, p0025        | yes       |
| mention:33:0      | res-02           | d033-learn          | required      | daily-assignment          | p0615, p0025        | yes       |
| mention:34:0      | unresolved-p0625 | d034-learn          | reference     | resource-restriction      | p0625               | yes       |
| mention:35:0      | unresolved-p0635 | d035-learn          | reference     | manual-instruction        | p0635               | no        |
| mention:36:0      | res-02           | d036-learn          | required      | daily-assignment          | p0650, p0025        | yes       |
| mention:36:1      | res-08           | d036-learn          | required      | daily-assignment          | p0650, p0025        | no        |
| mention:37:0      | res-02           | d037-learn          | required      | daily-assignment          | p0660, p0025        | yes       |
| mention:38:0      | unresolved-p0670 | d038-learn          | reference     | resource-restriction      | p0670               | yes       |
| mention:39:0      | unresolved-p0680 | d039-learn          | reference     | resource-restriction      | p0680               | yes       |
| mention:40:0      | res-01           | d040-learn          | required      | daily-assignment          | p0690, p0025        | no        |
| mention:41:0      | unresolved-p0700 | d041-learn          | reference     | resource-restriction      | p0700               | yes       |
| mention:42:0      | unresolved-p0710 | d042-learn          | reference     | resource-restriction      | p0710               | yes       |
| mention:43:0      | res-02           | d043-learn          | required      | daily-assignment          | p0727, p0025        | no        |
| mention:43:1      | res-08           | d043-learn          | required      | daily-assignment          | p0727, p0025        | no        |
| mention:44:0      | res-02           | d044-learn          | required      | daily-assignment          | p0737, p0025        | no        |
| mention:45:0      | unresolved-p0747 | d045-learn          | reference     | manual-instruction        | p0747               | no        |
| mention:46:0      | res-02           | d046-learn          | required      | daily-assignment          | p0757, p0025        | no        |
| mention:46:1      | res-08           | d046-learn          | required      | daily-assignment          | p0757, p0025        | no        |
| mention:47:0      | res-07           | d047-learn          | reference     | as-needed-reference       | p0767, p0025        | no        |
| mention:48:0      | unresolved-p0777 | d048-learn          | reference     | resource-restriction      | p0777               | yes       |
| mention:49:0      | unresolved-p0787 | d049-learn          | reference     | resource-restriction      | p0787               | yes       |
| mention:50:0      | res-02           | d050-learn          | required      | daily-assignment          | p0802, p0025        | no        |
| mention:51:0      | unresolved-p0812 | d051-learn          | reference     | manual-instruction        | p0812               | no        |
| mention:52:0      | res-02           | d052-learn          | required      | daily-assignment          | p0822, p0025        | no        |
| mention:52:1      | res-07           | d052-learn          | required      | daily-assignment          | p0822, p0025        | no        |
| mention:52:2      | res-08           | d052-learn          | required      | daily-assignment          | p0822, p0025        | no        |
| mention:53:0      | res-02           | d053-learn          | required      | daily-assignment          | p0832, p0025        | no        |
| mention:53:1      | res-07           | d053-learn          | required      | daily-assignment          | p0832, p0025        | no        |
| mention:54:0      | res-02           | d054-learn          | required      | daily-assignment          | p0842, p0025        | no        |
| mention:55:0      | unresolved-p0852 | d055-learn          | reference     | manual-instruction        | p0852               | no        |
| mention:56:0      | unresolved-p0862 | d056-learn          | reference     | resource-restriction      | p0862               | yes       |
| mention:57:0      | res-02           | d057-learn          | required      | daily-assignment          | p0877, p0025        | no        |
| mention:58:0      | res-02           | d058-learn          | required      | daily-assignment          | p0887, p0025        | no        |
| mention:59:0      | unresolved-p0897 | d059-learn          | reference     | resource-restriction      | p0897               | yes       |
| mention:60:0      | res-02           | d060-learn          | required      | daily-assignment          | p0907, p0025        | no        |
| mention:60:1      | res-08           | d060-learn          | required      | daily-assignment          | p0907, p0025        | no        |
| mention:61:0      | res-02           | d061-learn          | required      | daily-assignment          | p0917, p0025        | yes       |
| mention:62:0      | unresolved-p0927 | d062-learn          | reference     | resource-restriction      | p0927               | yes       |
| mention:63:0      | unresolved-p0937 | d063-learn          | reference     | resource-restriction      | p0937               | yes       |
| mention:64:0      | res-02           | d064-learn          | required      | daily-assignment          | p0952, p0025        | no        |
| mention:65:0      | unresolved-p0962 | d065-learn          | reference     | manual-instruction        | p0962               | no        |
| mention:66:0      | unresolved-p0972 | d066-learn          | reference     | manual-instruction        | p0972               | no        |
| mention:67:0      | res-07           | d067-learn          | required      | daily-assignment          | p0982, p0025        | no        |
| mention:68:0      | res-02           | d068-learn          | required      | daily-assignment          | p0992, p0025        | no        |
| mention:69:0      | res-02           | d069-learn          | required      | daily-assignment          | p1002, p0025        | no        |
| mention:70:0      | unresolved-p1012 | d070-learn          | reference     | resource-restriction      | p1012               | yes       |
| mention:71:0      | res-02           | d071-learn          | required      | daily-assignment          | p1027, p0025        | no        |
| mention:71:1      | res-08           | d071-learn          | required      | daily-assignment          | p1027, p0025        | no        |
| mention:72:0      | res-07           | d072-learn          | required      | daily-assignment          | p1037, p0025        | no        |
| mention:72:1      | res-08           | d072-learn          | required      | daily-assignment          | p1037, p0025        | no        |
| mention:73:0      | res-02           | d073-learn          | required      | daily-assignment          | p1047, p0025        | no        |
| mention:73:1      | res-07           | d073-learn          | required      | daily-assignment          | p1047, p0025        | no        |
| mention:74:0      | res-02           | d074-learn          | required      | daily-assignment          | p1057, p0025        | no        |
| mention:74:1      | res-08           | d074-learn          | required      | daily-assignment          | p1057, p0025        | no        |
| mention:75:0      | res-02           | d075-learn          | required      | daily-assignment          | p1067, p0025        | no        |
| mention:76:0      | unresolved-p1077 | d076-learn          | reference     | resource-restriction      | p1077               | yes       |
| mention:77:0      | unresolved-p1087 | d077-learn          | reference     | resource-restriction      | p1087               | yes       |
| mention:78:0      | res-02           | d078-learn          | required      | daily-assignment          | p1102, p0025        | no        |
| mention:79:0      | res-02           | d079-learn          | required      | daily-assignment          | p1112, p0025        | no        |
| mention:80:0      | res-02           | d080-learn          | required      | daily-assignment          | p1122, p0025        | no        |
| mention:80:1      | res-08           | d080-learn          | required      | daily-assignment          | p1122, p0025        | no        |
| mention:81:0      | res-02           | d081-learn          | required      | daily-assignment          | p1132, p0025        | no        |
| mention:82:0      | res-02           | d082-learn          | required      | daily-assignment          | p1142, p0025        | no        |
| mention:83:0      | res-06           | d083-learn          | conditional   | alternative-choice        | p1152, p0025        | yes       |
| mention:84:0      | unresolved-p1162 | d084-learn          | reference     | resource-restriction      | p1162               | yes       |
| mention:85:0      | res-03           | d085-learn          | required      | daily-assignment          | p1179, p0025        | no        |
| mention:86:0      | res-03           | d086-learn          | required      | daily-assignment          | p1189, p0025        | no        |
| mention:87:0      | res-03           | d087-learn          | required      | daily-assignment          | p1199, p0025        | no        |
| mention:88:0      | res-03           | d088-learn          | required      | daily-assignment          | p1209, p0025        | no        |
| mention:89:0      | res-03           | d089-learn          | reference     | problem-set-primary       | p1219, p0025        | no        |
| mention:90:0      | res-03           | d090-learn          | reference     | problem-set-primary       | p1229, p0025        | no        |
| mention:91:0      | res-03           | d091-learn          | required      | daily-assignment          | p1239, p0025        | no        |
| mention:92:0      | res-03           | d092-learn          | required      | daily-assignment          | p1254, p0025        | no        |
| mention:93:0      | res-03           | d093-learn          | required      | daily-assignment          | p1264, p0025        | no        |
| mention:94:0      | res-03           | d094-learn          | required      | daily-assignment          | p1274, p0025        | no        |
| mention:95:0      | res-03           | d095-learn          | required      | daily-assignment          | p1284, p0025        | no        |
| mention:96:0      | res-03           | d096-learn          | reference     | problem-set-primary       | p1294, p0025        | no        |
| mention:96:1      | res-04           | d096-learn          | required      | daily-assignment          | p1294, p0025        | no        |
| mention:97:0      | res-03           | d097-learn          | reference     | problem-set-primary       | p1304, p0025        | no        |
| mention:98:0      | unresolved-p1314 | d098-learn          | reference     | resource-restriction      | p1314               | yes       |
| mention:99:0      | res-03           | d099-learn          | required      | daily-assignment          | p1329, p0025        | no        |
| mention:100:0     | res-03           | d100-learn          | required      | daily-assignment          | p1339, p0025        | no        |
| mention:101:0     | res-02           | d101-learn          | required      | daily-assignment          | p1349, p0025        | no        |
| mention:101:1     | res-03           | d101-learn          | required      | daily-assignment          | p1349, p0025        | no        |
| mention:102:0     | res-07           | d102-learn          | required      | daily-assignment          | p1359, p0025        | no        |
| mention:103:0     | res-03           | d103-learn          | reference     | problem-set-primary       | p1369, p0025        | no        |
| mention:103:1     | res-04           | d103-learn          | required      | daily-assignment          | p1369, p0025        | no        |
| mention:104:0     | res-03           | d104-learn          | reference     | problem-set-primary       | p1379, p0025        | no        |
| mention:105:0     | unresolved-p1389 | d105-learn          | reference     | resource-restriction      | p1389               | yes       |
| mention:106:0     | res-03           | d106-learn          | required      | daily-assignment          | p1404, p0025        | no        |
| mention:107:0     | res-03           | d107-learn          | required      | daily-assignment          | p1414, p0025        | no        |
| mention:108:0     | res-03           | d108-learn          | required      | daily-assignment          | p1424, p0025        | no        |
| mention:109:0     | res-03           | d109-learn          | required      | daily-assignment          | p1434, p0025        | no        |
| mention:110:0     | res-03           | d110-learn          | reference     | problem-set-primary       | p1444, p0025        | no        |
| mention:110:1     | res-04           | d110-learn          | required      | daily-assignment          | p1444, p0025        | no        |
| mention:111:0     | res-08           | d111-learn          | required      | daily-assignment          | p1454, p0025        | no        |
| mention:112:0     | unresolved-p1464 | d112-learn          | reference     | resource-restriction      | p1464               | yes       |
| mention:113:0     | res-02           | d113-learn          | optional      | explicit-optional         | p1479, p0025, p1475 | no        |
| mention:113:1     | res-03           | d113-learn          | required      | daily-assignment          | p1479, p0025        | no        |
| mention:114:0     | res-03           | d114-learn          | required      | daily-assignment          | p1489, p0025        | no        |
| mention:115:0     | res-02           | d115-learn          | optional      | explicit-optional         | p1499, p0025, p1475 | yes       |
| mention:115:1     | res-03           | d115-learn          | required      | daily-assignment          | p1499, p0025        | no        |
| mention:116:0     | res-02           | d116-learn          | optional      | explicit-optional         | p1509, p0025, p1475 | yes       |
| mention:116:1     | res-03           | d116-learn          | required      | daily-assignment          | p1509, p0025        | no        |
| mention:117:0     | res-03           | d117-learn          | reference     | problem-set-primary       | p1519, p0025        | no        |
| mention:117:1     | res-04           | d117-learn          | required      | daily-assignment          | p1519, p0025        | no        |
| mention:118:0     | unresolved-p1529 | d118-learn          | reference     | resource-restriction      | p1529               | yes       |
| mention:119:0     | unresolved-p1539 | d119-learn          | reference     | resource-restriction      | p1539               | yes       |
| mention:120:0     | res-03           | d120-learn          | required      | daily-assignment          | p1554, p0025        | no        |
| mention:121:0     | res-03           | d121-learn          | required      | daily-assignment          | p1564, p0025        | no        |
| mention:122:0     | res-03           | d122-learn          | required      | daily-assignment          | p1574, p0025        | no        |
| mention:123:0     | res-03           | d123-learn          | reference     | problem-set-primary       | p1584, p0025        | no        |
| mention:123:1     | res-04           | d123-learn          | required      | daily-assignment          | p1584, p0025        | no        |
| mention:124:0     | unresolved-p1594 | d124-learn          | reference     | resource-restriction      | p1594               | yes       |
| mention:125:0     | unresolved-p1604 | d125-learn          | required      | unspecified-documentation | p1604               | yes       |
| mention:126:0     | unresolved-p1614 | d126-learn          | reference     | resource-restriction      | p1614               | yes       |
| mention:127:0     | res-03           | d127-learn          | required      | daily-assignment          | p1629, p0025        | yes       |
| mention:127:1     | res-12           | d127-learn          | reference     | as-needed-reference       | p1629, p0025        | yes       |
| mention:128:0     | res-03           | d128-learn          | required      | daily-assignment          | p1639, p0025        | no        |
| mention:129:0     | res-03           | d129-learn          | required      | daily-assignment          | p1649, p0025        | no        |
| mention:130:0     | res-03           | d130-learn          | required      | daily-assignment          | p1659, p0025        | no        |
| mention:131:0     | res-03           | d131-learn          | reference     | problem-set-primary       | p1669, p0025        | no        |
| mention:131:1     | res-04           | d131-learn          | required      | daily-assignment          | p1669, p0025        | no        |
| mention:132:0     | unresolved-p1679 | d132-learn          | required      | unspecified-documentation | p1679               | yes       |
| mention:133:0     | res-03           | d133-learn          | required      | daily-assignment          | p1689, p0025        | no        |
| mention:134:0     | res-05           | d134-learn          | required      | daily-assignment          | p1706, p0025        | no        |
| mention:135:0     | res-05           | d135-learn          | required      | daily-assignment          | p1716, p0025        | no        |
| mention:136:0     | res-05           | d136-learn          | required      | daily-assignment          | p1726, p0025        | no        |
| mention:137:0     | res-05           | d137-learn          | required      | daily-assignment          | p1736, p0025        | no        |
| mention:138:0     | res-05           | d138-learn          | required      | daily-assignment          | p1746, p0025        | no        |
| mention:139:0     | unresolved-p1756 | d139-learn          | required      | daily-assignment          | p1756, p0025, p1700 | yes       |
| mention:140:0     | unresolved-p1766 | d140-learn          | reference     | resource-restriction      | p1766               | yes       |
| mention:141:0     | res-05           | d141-learn          | required      | daily-assignment          | p1781, p0025        | no        |
| mention:142:0     | res-05           | d142-learn          | required      | daily-assignment          | p1791, p0025        | no        |
| mention:143:0     | res-05           | d143-learn          | required      | daily-assignment          | p1801, p0025        | no        |
| mention:144:0     | res-05           | d144-learn          | required      | daily-assignment          | p1811, p0025        | no        |
| mention:145:0     | unresolved-p1821 | d145-learn          | reference     | manual-instruction        | p1821               | no        |
| mention:146:0     | res-05           | d146-learn          | conditional   | used-topics-condition     | p1831, p0025        | yes       |
| mention:146:1     | res-09           | d146-learn          | conditional   | used-topics-condition     | p1831, p0025        | yes       |
| mention:147:0     | unresolved-p1841 | d147-learn          | reference     | resource-restriction      | p1841               | yes       |
| mention:148:0     | res-05           | d148-learn          | required      | daily-assignment          | p1856, p0025        | no        |
| mention:149:0     | res-05           | d149-learn          | required      | daily-assignment          | p1866, p0025        | no        |
| mention:149:1     | res-09           | d149-learn          | reference     | as-needed-reference       | p1866, p0025        | no        |
| mention:150:0     | res-05           | d150-learn          | required      | daily-assignment          | p1876, p0025        | no        |
| mention:151:0     | res-05           | d151-learn          | required      | daily-assignment          | p1886, p0025        | no        |
| mention:152:0     | res-05           | d152-learn          | required      | daily-assignment          | p1896, p0025        | no        |
| mention:153:0     | unresolved-p1906 | d153-learn          | required      | daily-assignment          | p1906, p0025, p1852 | yes       |
| mention:154:0     | unresolved-p1916 | d154-learn          | reference     | resource-restriction      | p1916               | yes       |
| mention:155:0     | res-05           | d155-learn          | required      | daily-assignment          | p1931, p0025        | no        |
| mention:156:0     | res-05           | d156-learn          | required      | daily-assignment          | p1941, p0025        | no        |
| mention:157:0     | res-05           | d157-learn          | required      | daily-assignment          | p1951, p0025        | no        |
| mention:158:0     | res-05           | d158-learn          | required      | daily-assignment          | p1961, p0025        | no        |
| mention:159:0     | res-05           | d159-learn          | required      | daily-assignment          | p1971, p0025        | no        |
| mention:160:0     | res-05           | d160-learn          | required      | daily-assignment          | p1981, p0025        | no        |
| mention:161:0     | unresolved-p1991 | d161-learn          | reference     | resource-restriction      | p1991               | yes       |
| mention:162:0     | res-05           | d162-learn          | required      | daily-assignment          | p2006, p0025        | no        |
| mention:163:0     | res-05           | d163-learn          | required      | daily-assignment          | p2016, p0025        | no        |
| mention:164:0     | res-05           | d164-learn          | required      | daily-assignment          | p2026, p0025        | no        |
| mention:165:0     | res-05           | d165-learn          | required      | daily-assignment          | p2036, p0025        | no        |
| mention:166:0     | res-05           | d166-learn          | required      | daily-assignment          | p2046, p0025        | no        |
| mention:167:0     | res-05           | d167-learn          | required      | daily-assignment          | p2056, p0025        | no        |
| mention:168:0     | unresolved-p2066 | d168-learn          | reference     | resource-restriction      | p2066               | yes       |
| mention:169:0     | res-05           | d169-learn          | required      | daily-assignment          | p2081, p0025        | no        |
| mention:170:0     | res-05           | d170-learn          | required      | daily-assignment          | p2091, p0025        | no        |
| mention:171:0     | res-05           | d171-learn          | required      | daily-assignment          | p2101, p0025        | no        |
| mention:172:0     | res-05           | d172-learn          | required      | daily-assignment          | p2111, p0025        | no        |
| mention:173:0     | unresolved-p2121 | d173-learn          | reference     | manual-instruction        | p2121               | no        |
| mention:174:0     | unresolved-p2131 | d174-learn          | required      | daily-assignment          | p2131, p0025, p2077 | yes       |
| mention:175:0     | unresolved-p2141 | d175-learn          | reference     | resource-restriction      | p2141               | yes       |
| mention:176:0     | unresolved-p2158 | d176-learn          | reference     | resource-restriction      | p2158               | yes       |
| mention:177:0     | unresolved-p2168 | d177-learn          | reference     | manual-instruction        | p2168               | no        |
| mention:178:0     | unresolved-p2178 | d178-learn          | reference     | manual-instruction        | p2178               | no        |
| mention:179:0     | res-05           | d179-learn          | reference     | as-needed-reference       | p2188, p0025        | no        |
| mention:180:0     | unresolved-p2198 | d180-learn          | reference     | manual-instruction        | p2198               | no        |
| mention:181:0     | unresolved-p2208 | d181-learn          | reference     | resource-restriction      | p2208               | yes       |
| mention:182:0     | unresolved-p2218 | d182-learn          | reference     | resource-restriction      | p2218               | yes       |
| mention:183:0     | res-01           | w01                 | reference     | weekly-overview           | p0268               | no        |
| mention:183:1     | res-06           | w01                 | reference     | weekly-overview           | p0268               | no        |
| mention:183:2     | res-07           | w01                 | reference     | weekly-overview           | p0268               | no        |
| mention:183:3     | res-08           | w01                 | reference     | weekly-overview           | p0268               | no        |
| mention:184:0     | res-02           | w02                 | reference     | weekly-overview           | p0346               | yes       |
| mention:184:1     | res-07           | w02                 | reference     | weekly-overview           | p0346               | no        |
| mention:184:2     | res-08           | w02                 | reference     | weekly-overview           | p0346               | no        |
| mention:185:0     | res-06           | w03                 | reference     | weekly-overview           | p0421               | no        |
| mention:185:1     | res-07           | w03                 | reference     | weekly-overview           | p0421               | no        |
| mention:185:2     | res-08           | w03                 | reference     | weekly-overview           | p0421               | no        |
| mention:186:0     | res-02           | w04                 | reference     | weekly-overview           | p0496               | yes       |
| mention:186:1     | res-07           | w04                 | reference     | weekly-overview           | p0496               | no        |
| mention:186:2     | res-08           | w04                 | reference     | weekly-overview           | p0496               | no        |
| mention:187:0     | res-01           | w05                 | reference     | weekly-overview           | p0571               | no        |
| mention:187:1     | res-08           | w05                 | reference     | weekly-overview           | p0571               | no        |
| mention:188:0     | res-01           | w06                 | reference     | weekly-overview           | p0646               | no        |
| mention:188:1     | res-07           | w06                 | reference     | weekly-overview           | p0646               | no        |
| mention:189:0     | res-02           | w07                 | reference     | weekly-overview           | p0721               | no        |
| mention:189:1     | res-08           | w07                 | reference     | weekly-overview           | p0721               | no        |
| mention:190:0     | res-02           | w08                 | reference     | weekly-overview           | p0798               | no        |
| mention:190:1     | res-07           | w08                 | reference     | weekly-overview           | p0798               | no        |
| mention:191:0     | res-02           | w09                 | reference     | weekly-overview           | p0873               | no        |
| mention:192:0     | res-02           | w10                 | reference     | weekly-overview           | p0948               | no        |
| mention:192:1     | res-07           | w10                 | reference     | weekly-overview           | p0948               | no        |
| mention:193:0     | res-02           | w11                 | reference     | weekly-overview           | p1023               | no        |
| mention:193:1     | res-07           | w11                 | reference     | weekly-overview           | p1023               | no        |
| mention:193:2     | res-08           | w11                 | reference     | weekly-overview           | p1023               | no        |
| mention:194:0     | res-02           | w12                 | reference     | weekly-overview           | p1098               | no        |
| mention:194:1     | res-06           | w12                 | reference     | weekly-overview           | p1098               | no        |
| mention:194:2     | res-08           | w12                 | reference     | weekly-overview           | p1098               | no        |
| mention:195:0     | res-03           | w13                 | reference     | weekly-overview           | p1173               | no        |
| mention:196:0     | res-03           | w14                 | reference     | weekly-overview           | p1250               | no        |
| mention:197:0     | res-03           | w15                 | reference     | weekly-overview           | p1325               | no        |
| mention:197:1     | res-07           | w15                 | reference     | weekly-overview           | p1325               | no        |
| mention:198:0     | res-03           | w16                 | reference     | weekly-overview           | p1400               | no        |
| mention:198:1     | res-08           | w16                 | reference     | weekly-overview           | p1400               | no        |
| mention:199:0     | res-02           | w17                 | optional      | explicit-optional         | p1475               | no        |
| mention:199:1     | res-03           | w17                 | reference     | weekly-overview           | p1475               | no        |
| mention:200:0     | res-03           | w18                 | reference     | weekly-overview           | p1550               | no        |
| mention:201:0     | res-03           | w19                 | reference     | weekly-overview           | p1625               | no        |
| mention:202:0     | res-05           | w20                 | reference     | weekly-overview           | p1700               | no        |
| mention:203:0     | res-05           | w21                 | reference     | weekly-overview           | p1777               | no        |
| mention:203:1     | res-09           | w21                 | reference     | weekly-overview           | p1777               | no        |
| mention:204:0     | res-05           | w22                 | reference     | weekly-overview           | p1852               | no        |
| mention:205:0     | res-05           | w23                 | reference     | weekly-overview           | p1927               | no        |
| mention:206:0     | res-05           | w24                 | reference     | weekly-overview           | p2002               | no        |
| mention:207:0     | res-05           | w25                 | reference     | weekly-overview           | p2077               | no        |
| mention:208:0     | unresolved-p2152 | w26                 | reference     | weekly-overview           | p2152               | no        |
| hyperlink:p0083:0 | res-01           | resource-catalog    | reference     | catalog-reference         | p0083               | no        |
| hyperlink:p0086:0 | res-02           | resource-catalog    | reference     | catalog-reference         | p0086               | no        |
| hyperlink:p0089:0 | res-03           | resource-catalog    | reference     | catalog-reference         | p0089               | no        |
| hyperlink:p0092:0 | res-04           | resource-catalog    | reference     | catalog-reference         | p0092               | no        |
| hyperlink:p0095:0 | res-05           | resource-catalog    | reference     | catalog-reference         | p0095               | no        |
| hyperlink:p0098:0 | res-06           | resource-catalog    | reference     | catalog-reference         | p0098               | no        |
| hyperlink:p0101:0 | res-07           | resource-catalog    | reference     | catalog-reference         | p0101               | no        |
| hyperlink:p0104:0 | res-08           | resource-catalog    | reference     | catalog-reference         | p0104               | no        |
| hyperlink:p0107:0 | res-09           | resource-catalog    | reference     | catalog-reference         | p0107               | no        |
| hyperlink:p0110:0 | res-10           | resource-catalog    | reference     | catalog-reference         | p0110               | no        |
| hyperlink:p0113:0 | res-11           | resource-catalog    | reference     | catalog-reference         | p0113               | no        |
| hyperlink:p0116:0 | res-12           | resource-catalog    | reference     | catalog-reference         | p0116               | no        |
| hyperlink:p2357:0 | res-01           | guide-source-status | reference     | catalog-reference         | p2357               | no        |
| hyperlink:p2358:0 | res-02           | guide-source-status | reference     | catalog-reference         | p2358               | no        |
| hyperlink:p2359:0 | res-03           | guide-source-status | reference     | catalog-reference         | p2359               | no        |
| hyperlink:p2360:0 | res-05           | guide-source-status | reference     | catalog-reference         | p2360               | no        |
| hyperlink:p2361:0 | res-06           | guide-source-status | reference     | catalog-reference         | p2361               | no        |
| hyperlink:p2362:0 | res-07           | guide-source-status | reference     | catalog-reference         | p2362               | no        |
| hyperlink:p2363:0 | res-08           | guide-source-status | reference     | catalog-reference         | p2363               | no        |

## Parent binding proposals

| Use           | Proposed parent | Evidence            |
| ------------- | --------------- | ------------------- |
| mention:3:0   | res-01          | p0295, p0084, p0087 |
| mention:8:0   | res-01          | p0350, p0084, p0087 |
| mention:10:0  | res-01          | p0370, p0084, p0087 |
| mention:12:0  | res-01          | p0390, p0084, p0087 |
| mention:25:0  | res-01          | p0530, p0084, p0087 |
| mention:26:0  | res-01          | p0540, p0084, p0087 |
| mention:29:0  | res-01          | p0575, p0084, p0087 |
| mention:30:0  | res-01          | p0585, p0084, p0087 |
| mention:31:0  | res-01          | p0595, p0084, p0087 |
| mention:32:0  | res-01          | p0605, p0084, p0087 |
| mention:33:0  | res-01          | p0615, p0084, p0087 |
| mention:36:0  | res-01          | p0650, p0084, p0087 |
| mention:37:0  | res-01          | p0660, p0084, p0087 |
| mention:139:0 | res-05          | p1756, p0025, p1700 |
| mention:153:0 | res-05          | p1906, p0025, p1852 |
| mention:174:0 | res-05          | p2131, p0025, p2077 |
| mention:184:0 | res-01          | p0346, p0084, p0087 |
| mention:186:0 | res-01          | p0496, p0084, p0087 |

## Named-mention candidates

| Name                   | Context    | Type          | Mode        | Known parent only | Source |
| ---------------------- | ---------- | ------------- | ----------- | ----------------- | ------ |
| Node runtime           | d001-learn | tool          | required    | unspecified       | p0274  |
| nvm                    | d001-learn | tool          | required    | unspecified       | p0274  |
| VS Code                | d001-learn | tool          | required    | unspecified       | p0274  |
| Git                    | d001-learn | tool          | required    | unspecified       | p0274  |
| Jest Getting Started   | d025-learn | documentation | conditional | unspecified       | p0530  |
| ESLint getting started | d061-learn | documentation | reference   | unspecified       | p0917  |
| SQLite docs            | d127-learn | documentation | reference   | unspecified       | p1629  |
| pg library docs        | d132-learn | documentation | conditional | unspecified       | p1679  |
| sqlite library docs    | d132-learn | documentation | conditional | unspecified       | p1679  |
| React DevTools         | d144-learn | tool          | required    | unspecified       | p1811  |
| Node docs              | w23        | documentation | reference   | res-10            | p1927  |
| Express docs           | w23        | documentation | reference   | unspecified       | p1927  |
| CS50 Psets             | w13        | practice      | reference   | res-04            | p1173  |
| CS50 Practice          | w13        | practice      | reference   | res-03            | p1173  |
| CS50 Practice          | w14        | practice      | reference   | res-03            | p1250  |

## Recommended implementation boundary

Keep the imported database rows and archived curriculum byte-for-byte unchanged. Store an immutable, versioned **presentation interpretation** outside the source archive, bound to the exact release/manifest/Word hashes and expected raw record IDs/text hashes. Validate completeness, vocabulary, evidence, local destinations and original URLs before enabling it. Freeze the approved artifact and explicit application-version binding; never select a floating latest interpretation or silently overwrite it. A stale/mismatching interpretation must fail visibly instead of being applied to another release.

Preserve original type/provider/requirement/parent fields in provenance. Show/filter separately named derived tags, identified as added interpretations. Keep all 69 raw records and 290 use origins accessible; virtual named mentions or corrected parent groupings must preserve their raw origins and avoid duplicate result IDs. Never turn these display tags into extra progress units, external grading, account requirements or changed exercise eligibility.

First implement the reviewed labels and same-use filter projection; verify private records/manifests/reseed stay unchanged and raw fallbacks remain explicit. Parent corrections and new first-class mention/detail destinations require their own focused integration checks across library/search/details/source mapping; do not silently add them via a keyword rewrite. The candidate list is a concrete set of reviewed gaps, not a claim of exhaustive token-by-token entity extraction. Additional ambiguous library identity choices remain unspecified.

If a proposed change affects lesson/task completion, prescribed scope, original content or published release identity, create a new curriculum release and use the separately reviewed M8 upgrade path. A presentation overlay must not be used to evade immutable curriculum releases. This step only proposes the boundary; no overlay loader, schema migration, import reset or student enrollment change has been made.

## Review coverage

```json
{
  "resources": 69,
  "uses": 290,
  "sourceMentions": 208,
  "originalUrlResources": 12,
  "unresolvedInstructionRecords": 57,
  "originalHyperlinkUses": 19,
  "proposedTypes": {
    "article": 1,
    "course": 4,
    "documentation": 6,
    "guide": 52,
    "practice": 2,
    "reference": 4
  },
  "proposedUseModes": {
    "conditional": 4,
    "optional": 4,
    "reference": 131,
    "required": 151
  },
  "ambiguityResources": 6,
  "ambiguityUses": 63,
  "parentSuggestions": 18,
  "additionalMentionCandidates": 15
}
```
