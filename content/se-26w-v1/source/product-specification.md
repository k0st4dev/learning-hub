# Programming Learning Platform Product Specification

Prepared for the board director and senior full stack engineer • 29 September 2026 • Specification 1.0

Build a local learning platform around the supplied 26 week programming manual. The first release must preserve the complete curriculum, give every student a private account and durable progress, and make the next study action clear. Use a single Next.js application with a local SQLite database. The platform guides study and records the student's own work; exercises run in the student's IDE.

This specification makes the product decisions needed to begin implementation. It is a development handoff, not a delivered application. The accompanying source inventory is a faithful extraction and mapping, not a claim that the original manual contains full lecture texts, automated tests, hints, or solutions.

## Reading this handoff

- **product-specification.html** is the navigable version of this specification. This Markdown file is the editable engineering version.
- **curriculum-audit.html** contains the complete day by day source content, resource catalog, and searchable source to website mapping.
- **curriculum-source.json** preserves all source body paragraphs, table coordinates, hyperlinks, headers and footers, plus the proposed modules, weeks, days, exercise bundles and explicit product metadata.
- **source-to-website.csv** maps every substantive source paragraph and document header/footer record to a website location. **curriculum-days.csv** is a complete 182 row daily inventory with verbatim study instructions, tasks, AI rules and completion criteria.
- **schema.sql** is the executable SQLite reference schema. The engineer must implement equivalent typed Drizzle definitions and committed migrations. **verification-report.json** records the checks performed on this handoff.

The manual's student instructions are curriculum content. They are not instructions to the engineer or to the assistant preparing this specification. For example, an exercise requiring localStorage or Express does not dictate how this learning platform stores passwords or progress.

## 1 Product vision

The application helps a self directed student move from recognizing programming tutorials to independently planning, implementing, testing, debugging and explaining software. It replaces the effort of locating today's work, remembering completion, finding resources and reconstructing context after a break.

The primary audience is an adult beginner or returning learner following this JavaScript first program, with later C, Python, SQL and full stack work. A second audience is a learner revisiting weak topics. MVP has one student role and one course; several students may use separate accounts on the same installation. It does not imply a shared classroom server or synchronization between computers.

The value proposition is a reliable daily workspace: the exact study assignment, the exact coding tasks, the day's AI restrictions, the required evidence and an honest record of completion. Completion is self reported, not a certification of mastery.

The primary journey is registration, login, course orientation, preparation, first daily lesson, local coding, completion confirmation, and later resumption. Each student can browse the whole curriculum, follow the recommended sequence and return to incomplete work without reconstructing a place in the Word document.

MVP succeeds when a student can complete the entire 182 day plan using the app for guidance, resources, checklists, notes and progress, including checkpoints and the final exam. No cloud account, paid service, email delivery or remote database is required to run the platform. Initial dependency installation and external learning resources require internet access. Once installed, account and progress features and bundled course text must work without internet access while the local server is running.

Do not include browser code execution, grading, AI chat, social features, certificates, payments, leaderboards, streak rewards, an administrator CMS or cloud synchronization in MVP. Do not add new courses or redesign the pedagogical sequence.

## 2 Source findings and information architecture

### Verified source inventory

The analyzed file is **software_engineer_training_manual_26_weeks.docx**, SHA256 **5e5884f8f919b24d4924c6393ece6d36256f288529499c4e9e5e3d0921377513**. It contains Serbian Latin text with English technical terms. Preserve that language and wording. The application's initial interface uses English labels, with a central string dictionary for later localization; mark curriculum text with `lang="sr-Latn"`.

| Source element | Verified count | Website treatment |
| --- | ---: | --- |
| Phases | 6 | Modules using original phase names |
| Weeks | 26 | Week overview and seven ordered day cards |
| Numbered days | 182 | One day workspace per original day |
| Daily study instruction sections | 182 | One required study lesson per day |
| Daily assignment bundles | 182 | One exercise page per day with ordered task checklist |
| Task bullet lines | 548 | Preserve each line and its conditions; do not equate lines with individual coding problems |
| Preparation tasks | 7 | Preparation checklist outside the 182 day denominator |
| Appendices | 7 | Searchable course handbook; relevant contextual links |
| Scorecard dimensions | 14 | Saved self assessment form using the original 0 to 3 rubric |
| Hyperlink occurrences | 19 | Preserve all uses and labels |
| Distinct hyperlink URLs | 12 | Canonical resource records with contextual uses |
| Substantive body paragraphs | 2327 | Full source mapping, including table cells |
| Tables | 197 | Preserve their relationships when converting to cards, lists or structured tables |
| Header and footer records | 2 | Course source metadata; pagination has no learning function |

There are 2365 body paragraphs in total; 38 contain only whitespace or layout breaks. Their raw records are retained in the JSON. The source mapping has 2329 rows: 2327 substantive body paragraphs plus two header/footer records. No embedded drawings were found. Paragraph identifiers are extraction locators, not page numbers or permanent content IDs across future Word versions.

### Hierarchy and release structure

```text
Course
  Published curriculum release
    Course orientation and preparation
    Module corresponding to a source phase
      Week
        Day
          Study lesson
            Daily exercise bundle
              Ordered task lines
          Daily AI policy and completion criteria
    Resource catalog and contextual resource uses
    Handbook including Appendices A to G
```

Resource records are shared references, not children that must be duplicated under each exercise. A resource use connects a resource to a course guide, module, week, day, lesson or exercise. The UI derives the module/day context through that location. Notes can belong to any content item. The learner's enrollment pins a published release.

| Module | Original phase title | Weeks | Days | Main transition |
| --- | --- | --- | --- | --- |
| F1 | JavaScript reset i logika | 1 to 4 | 1 to 28 | Fundamentals, decomposition, debugging, data, functions and testing |
| F2 | Web kao laboratorija za logiku | 5 to 6 | 29 to 42 | DOM, events, Foundations projects and independent UI work |
| F3 | Organizacija većeg JS koda | 7 to 12 | 43 to 84 | Larger JS projects, modules, tooling, async, testing and complexity |
| F4 | Computer Science osnova | 13 to 19 | 85 to 133 | CS50 based C, algorithms, memory, structures, Python and SQL |
| F5 | Moderni full stack | 20 to 25 | 134 to 175 | Full Stack Open based React, APIs, persistence, authentication and tests |
| F6 | Samostalni software engineer | 26 | 176 to 182 | DevTrack capstone, review, final exam and next steps |

Preserve all 26 weekly goals, primary resource instructions, roadmap evidence statements and the five explicit phase signal callouts present in the body. Do not invent a missing phase signal for F2. Each week ends in a checkpoint, except week 26 whose seventh day is the final exam: 25 weekly checkpoints plus one final exam.

Use ascending original day numbers as the recommended path. Dependencies are advisory: earlier days, the current week's objectives, and the previous checkpoint. A project continuation should link to its earlier project days. For MVP, these links are content metadata, not a general dependency engine. All published lessons remain available. A failed checkpoint creates a review recommendation and prevents that checkpoint from being counted as complete; it does not lock the website.

### Decisions resolving source ambiguity

| Finding | Product decision |
| --- | --- |
| Original schedule is 31 August 2026 to 28 February 2027, preceded by preparation dates | Show original dates only in source details. Primary labels are Week and Day numbers. No overdue labels, automatic skipping or date based locks. Students resume at their own pace. |
| Source gives reading directions rather than full lectures | Show the directions intact and connect them to resource cards. Support theory, explanations, code and video blocks, but do not fabricate material or copy external courses into the product. Additional authored explanations must be labeled as platform additions with provenance. |
| Source gives one daily task list, with several problems or constraints in each bullet | One daily exercise bundle preserves context and shared completion criteria. Each original line is a task/checklist item. A line such as “do not use eval” is an attestation of a constraint, not a separate programming problem. |
| Most daily references lack exact URLs or exercise ranges | Preserve the exact title/section locator; link to the provided parent resource where identifiable. Label it “Open course and find this section.” Record unlinked mentions and never guess a deep URL. Scope choices are recorded by the student before work and assessed against the original daily criterion. |
| Optional work and alternatives occur inside otherwise required tasks | Keep core requirements required; explicitly separate optional clauses in checklist help text. Required alternatives need one selected path, not every alternative. Conditional steps permit “Not applicable” with a reason. |
| Day 125 makes Go/Java optional while its completion wording mentions a third language | Keep the original text visible. Offer optional Go/Java transfer or a short reflection with evidence from the JS/C/Python work already completed. Neither a new language nor a falsely marked task is required. Record the selected path. |
| Some CS50 days require a substantial attempt rather than a finished problem set | Count the stated attempt and evidence criterion. Do not claim the student completed the whole external problem set or external course. |
| Full Stack Open core sets and some tools are intentionally described as current or equivalent | Preserve those instructions. Student records the chosen section/exercise identifiers in Selected scope. Named tasks still apply. The app does not silently expand a day's workload when an external course changes. |
| Daily time estimates coexist with minimum attempt times and short checkpoint windows | Display original estimates as planning guidance, never a timer based gate. Preserve the more specific minimum attempt instructions. Students can take longer or spread a day across sessions. |
| Header and resource claims say verified on 25 August 2026, including Exercism counts | Label these as source snapshot claims. Do not display them as freshly verified facts. Keep link checks separate from curriculum verification. |
| Curriculum teaches localStorage, MongoDB, tokens and deployment in student projects | Preserve those assignments. The platform itself uses SQLite and server cookies. Local platform operation does not guarantee that every external course activity is offline or avoids third party accounts. |
| General AI permissions and daily restrictions differ | Daily restrictions take priority in the learning UI. External course rules still apply to external assignments. Copyable prompt templates remain guidance; MVP makes no AI calls. |
| Day 1 repo folders omit checkpoints while preparation includes it | Show both original instructions; the preparation checklist creates all four folders. No destructive reconciliation is necessary. |

Explicit conditional treatment: Day 20 JSON import/export, Day 76 debounce and Day 131 EXPLAIN are optional; Day 20 memory storage and Day 76 README remain required. Day 25 automated tests apply if Jest is selected, while the overall testing objective still applies. Day 76 unit toggle, Day 87 practice availability, Day 88 course environment tools, Day 108 memory checker, Day 110 permitted walkthrough, Day 134 current exercise identifiers and Day 138 topic availability accept a recorded applicability decision. Day 113's optional Odin reading does not make the linked list implementation optional. Day 115 allows a recorded later Odin implementation path; collision understanding and the day's other tasks remain required. Day 159 deployment is conditional on reasonable effort. Day 179 permits login only for the student's capstone; registration remains mandatory for this platform.

The source's learning recommendations in Appendices A through G remain available in full. Appendix A becomes a copyable problem file template; B a Git checklist; C a concept mastery checklist; D the saved scorecard; E a stuck workflow; F guidance on AI after mastery; G the postcourse branching guide. Global study rules, the five daily operating blocks, the 13 step problem solving ritual, all eight prompt templates and the complete hint ladder are preserved.

## 3 Complete page and screen structure

All authenticated pages share a consistent shell, error boundary and loading skeleton. A skeleton must never show invented completion percentages. Progress information is private to the signed in user. URL examples below omit the common `/course/software-engineer` prefix where indicated.

| Screen and route | Purpose and main elements | Interaction and navigation | Empty, error and completion states |
| --- | --- | --- | --- |
| Registration `/register` | Email, password, confirm password, optional display name, Show password and local account explanation | Validate fields, submit once, create account, redirect to login with email prefilled and success message | Empty form initially; inline validation; duplicate account message; save failure keeps nonsecret fields; password never echoed |
| Login `/login` | Email, password, Show password, sign in, link to register and local recovery help | Successful login returns to a validated internal return path or Dashboard; no external return URL | Generic incorrect credentials; rate limit with retry time; database unavailable; signed in visitors go to Dashboard |
| Dashboard `/dashboard` | Continue Learning, current context, course progress, day totals, recent completions | Primary action resolves saved study cursor; secondary course overview and recommended earliest incomplete day | New student sees Start course and preparation; no activity copy; all complete shows Review course and next steps; read failure shows retry, not zero |
| Course overview `/course/software-engineer` | Course purpose, orientation, six modules, 26 week roadmap, release and course totals | Start/continue, expand modules, open guides, access source details | Missing seed is a setup error; completed modules marked with text/icon; incomplete counts remain explicit |
| Roadmap `/roadmap` | Original week focus, evidence and optional source dates | Link each row to week overview; module filter | Source date display never implies lateness; data missing gives course availability error |
| Preparation `/preparation` | Seven original checklist items, setup help and course rules | Each item persists independently; acknowledge orientation then Start Day 1; defer with visible preparation reminder | 0 of 7 to 7 of 7; failed save restores confirmed state; no contribution to course percentage |
| Module `/modules/f1` | Original phase name, purpose, phase signal if supplied, weeks, module percentage and count | Expand weeks, continue inside this module or browse | Empty published module is invalid content; complete means all required lessons and exercises in scope complete; no hard lock |
| Week `/weeks/w01` | Goal, primary resources, roadmap evidence, day cards, checkpoint and remediation | Seven ordered cards; previous/next week; contextual resources | Checkpoint needs review state; unfinished days visible; complete week shows evidence and Review link |
| Day workspace `/days/d001` | Title, time, weekly objective, study lesson, assignment, AI policy, evidence and completion checklist | Open lesson or exercise; save notes; previous/next day; Mark study complete; explicit Study this day when browsing ahead | Not started, in progress, complete or checkpoint needs review; absent content blocks omitted; failed writes show Unsaved and Retry |
| Lesson `/days/d001/lessons/d001-learn` | Daily study instructions, resource cards, supported content blocks, notes and completion control | Mark study complete only after reading/reviewing; next goes to exercise; previous goes to prior day's exercise | The original no new theory instruction is shown verbatim; absence of extra lecture blocks is normal; completed lesson shows completion time and Reopen |
| Exercise `/days/d001/exercises/d001-practice` | Original task lines, requirements, expected result, AI rules, evidence, selected scope, hints if available | Check tasks, record evidence, attest criterion, mark complete; backlink to related lesson | Missing hints/solutions show no empty controls; task failure does not lose other work; complete remains reviewable; needs review keeps exercise incomplete |
| Resources `/resources` | Search, source/type/module/week/day and required/optional/reference filters | Open resource detail, external link in new tab, back to related lesson | No matches offers Clear filters; unknown link state labeled unchecked; unavailable link keeps original URL and instructions |
| Resource detail `/resources/res-01` | Title, provider, original URL, description, required contexts, all related locations | Open external source; select a related day | Unresolved reference shows exact source wording and parent resource if known; no false completion on click |
| Progress `/progress` | Overall and module breakdown, completed days, unfinished lessons/exercises, recent activity, checkpoint results, notes links | Filter incomplete/completed; open a day; open scorecard | New student sees zero confirmed units; needs review visible separately; all complete offers handbook and next steps |
| Scorecard `/progress/scorecard` | Fourteen original dimensions, exact scale 0 to 3, evidence per dimension, selected review period | Edit and save; compare with previous period only when it exists | No ratings means Not assessed, not zero; validation rejects out of range; save conflict offers reload/copy draft; no effect on course percentage |
| Profile `/settings` | Display name, email read only, password change, timezone, theme, local storage explanation, logout | Save settings; current password required for password change; revoke sessions on password change | Inline errors; confirmed Saved state; last valid settings persist on failure |
| Handbook `/guide/[slug]` | Full orientation, AI protocol, appendices, source status and learning outcome | In page navigation, copy prompt/template, return to current day | Unknown guide is 404; copy failure exposes selectable text; no completion requirement |
| Continue `/continue` | Server resolved navigation entry, no independent content screen | Validate session/enrollment, resolve target, redirect to the canonical lesson/exercise and saved anchor | Unenrolled learner goes to Course with Start; enrolled learner starts preparation; removed target falls back deterministically with notice; all complete goes to Progress |
| Not found and unavailable | Useful explanation, Dashboard and Course links, retry where applicable | Back and safe recovery; no automatic database reset | 404 for missing route; 503 for unavailable data; no stack traces in UI |

Completed lesson state includes a checked icon, the word Completed, completion date and a secondary Reopen action. Reopening changes status deliberately; merely revisiting does not. Locked lesson state is not used for progression in MVP. Authentication required, missing release and unpublished content have distinct messages rather than padlock icons. A future prerequisite lock would need a reason and an actionable prerequisite link before it can ship.

## 4 Student dashboard

Desktop order: heading and name; full width Continue Learning card; four compact counts; current module/week/day panel; recent activity; preparation or checkpoint reminder only when relevant. On mobile retain that order in one column. Do not display a decorative activity chart or empty leaderboard.

The Continue card shows module name, Week N, Day N and title, current action such as “Finish the study lesson” or “Continue task 2 of 3,” last saved date and one primary Resume button. A secondary link opens the recommended earliest unfinished day if it differs from a deliberately selected later day. The card must make that distinction explicit.

| Component | Required data and behavior |
| --- | --- |
| Overall course progress | Confirmed required units completed divided by required units in the enrolled release; percentage and exact fraction |
| Completed days | Completed days out of 182; remaining days = 182 minus completed days |
| Remaining study lessons | 182 minus completed required study lessons; label distinguishes them from exercises |
| Remaining exercises | 182 minus completed required exercise bundles |
| Current module | Derived from the resolved resume target, with its own progress fraction |
| Current week and day | Derived from the same target; original dates are not primary labels |
| Recent activity | Latest five state transition events with content title, event type and localized timestamp; link to full Progress history |
| Checkpoint reminder | Latest incomplete checkpoint the learner attempted, its original criterion and suggested review days |

A learner with no enrollment sees a short course introduction and Start course. Starting creates an enrollment in the latest published release and opens preparation. A learner who completed the course sees “All 182 days completed,” the final retrospective and Appendix G. Continue becomes Review course. Do not show 100 percent for partially complete work due to rounding.

Streaks are excluded. The source emphasizes quality, independent problem solving and artifacts. Days studied this week may be considered later, but MVP must not reward superficial checkbox activity.

## 5 Daily learning experience

The daily workspace follows five questions: what am I learning, why does it matter, what should I study, what should I code, and what proves I am done. Use a reading column of about 68 to 76 characters, with a small local outline on wide screens. Present one primary action at a time.

The top shows the exact day title, original estimated minutes, week goal and day status. “Why this matters” initially uses the original weekly objective. A bespoke daily objective is optional author enrichment and cannot be presented as source text. The source study assignment is the lesson body. Theory, explanation, code examples, images and videos are supported block types; absent blocks are omitted, not filled with generated placeholders.

Use sections in this order:

1. **Orient** shows weekly objective, the original daily assignment context and relevant preparation/project links.
2. **Study** shows the exact “Uči / pročitaj” text and contextual resource cards. Place section locators next to parent resource links. For “No new theory” days, show the original review instruction and allow confirmation after review.
3. **Practice** shows the complete ordered “Uradi” list. Each task has a completion checkbox or an applicability/choice control when required. Open the dedicated exercise view for focused work.
4. **Review** shows the full daily AI policy, evidence field and exact “Gotovo kada” criterion. The student attests that the criterion is met; this is not automatic grading.
5. **Continue** shows the next action and previous/next navigation, with a calm completion panel after the save succeeds.

Provide collapsible supporting material for the daily operating system, problem solving ritual, hints, and handbook. Keep required instructions, AI restrictions and completion criteria expanded. Avoid tabs that hide required assignments by default. Code blocks use monospace, a language label, selectable text and Copy; long lines scroll inside the block.

Add one private note per day, with optional lesson/exercise notes supported by the same component. Save after 800 milliseconds of inactivity and on blur. Show Saving, Saved and Could not save. Flush on intentional navigation and prompt before leaving with an unsaved draft. Store notes only in the server database; do not silently fall back to browser storage. A browser crash can lose unacknowledged text, so “Saved” must mean the server transaction committed.

Evidence accepts a commit identifier, repository URL, relative local file path or short description of the artifact. At least one nonempty evidence entry is required to complete an exercise; it is not uploaded or verified. Do not access local files from a submitted path. Optional plain text evidence is limited to 2000 characters, notes to 20000 characters and selected scope to 2000 characters.

Weekly checkpoints display the original no AI rules and pass criteria. Let the student choose Criteria met or Needs review, record score evidence when applicable and add a remediation note. For Day 7, show the original 7/10 plus all three problems rule and link Days 3 to 5 on failure. For Day 28, preserve the average at least 4/5 criterion and two day review advice. Where no numerical pass mark exists, do not create one. No countdown timer or proctoring in MVP. The final exam prominently preserves its first 120 minutes without resources and the 45/45/30 minute task breakdown.

The scorecard period key is `YYYY-MM`, defaulting to the current month in the student timezone. Offer a review after weeks 4, 8, 12, 16, 20, 24 and the final exam; if that month already has a scorecard, open it for deliberate revision rather than creating or overwriting another. This is a prompt to reflect, not a progress gate.

## 6 Exercise system

MVP contains 182 exercise bundles linked one to one to the 182 study lessons. Each bundle has stable ID, title, source instructions, ordered tasks, expected result copied from the daily completion criterion, related lesson, requirement rule, evidence, selected scope, completion state and timestamps. Difficulty and exercise duration are nullable. The manual specifies daily time, not reliable time for each subproblem; show “Within today's 120 minute plan” instead of inventing exercise estimates. Authored difficulty labels must be marked as editorial estimates.

Task modes are required, optional, conditional, alternative or mixed. Required tasks must be done. Optional tasks do not block. Conditional tasks must be done or marked Not applicable with a reason. Alternative tasks require recording the chosen permitted route and completing that route. A mixed task must satisfy its required clause; the optional clause is separately described and does not block. Checking a constraint means the student confirms their work follows it. Do not treat an unfulfilled required step as skipped completion.

The completion button is enabled when required task rules are satisfied, evidence is nonempty and the criterion attestation is checked. The server repeats all checks. It must reject a forged completion request that bypasses these requirements. On checkpoints, result must be passed; Needs review leaves progress started. If the optional Day 125 transfer is declined, require the specified existing language transfer reflection instead.

Hints and solutions are optional content fields, empty for the initial source unless independently authored and reviewed. Hide the UI when none exist. When hints exist, reveal one level at a time, preserving the manual's Level 0 to 5 guidance. A solution is hidden initially and requires explicit reveal after an attempted plan and confirmation that earlier hints were exhausted. Record reveal time, and require a rewrite from memory attestation before completion after a solution reveal. Daily AI OFF restrictions override reveal controls until the permitted review stage. Do not add or expose solutions to external graded assignments merely because the content model supports them. The source's external course rules remain visible guidance, not a live policy verification claim.

Future browser editing should add an ExerciseRunner interface without replacing exercise identity or progress. Store starter files, language/runtime version, tests, limits and attempt records in new tables. An editor alone can arrive before execution. Any code runner requires a separately isolated environment with CPU/memory/time limits, no default outbound network, no app secrets and controlled filesystem access. Never evaluate submitted JavaScript in the application server or in the authenticated page origin. Automatic test results may support later grading but must not silently reinterpret existing self reported completions.

## 7 Progress tracking and exact resume rules

Canonical state is per enrollment, pinned release and content item. Store started and completed lesson state; exercise state and task checks; criterion/evidence and checkpoint result; completion timestamps; last opened location; active resume location and section anchor; notes; preparation checks; scorecard entries; and immutable activity events for meaningful transitions. Use UTC timestamps and display them in the user's selected timezone.

Do not store mutable overall percentages, completed day counters or independent current module/day values. Derive them from canonical progress and the resume resolver. This avoids contradictory counters after undo, retries or content updates.

### Completion and percentages

For the initial release there are **364 required units**: 182 study lessons and 182 daily exercise bundles. Each unit has equal weight. Task lines, resource clicks, notes, preparation, guide reading and scorecards add no extra units. A day's exercise may contain several problems, but the source does not supply reliable comparable effort weights.

For a scope S, let R be its required lesson and exercise IDs, and C the subset currently complete for this enrollment. Progress is `100 × |C| / |R|`. Display whole percentages rounded down, and show the exact fraction. If no required items exist, show Not applicable; a published day or module with no required items is rejected at import. Display 100 percent only when all required units are complete.

Initial release denominators: each day 2; each week 14; F1 56; F2 28; F3 84; F4 98; F5 84; F6 14. Course denominator is 364. These are derived from content, never hardcoded into application calculations. Completing one study lesson makes its day 50 percent. Completing both required units makes the day complete. Completing six whole days and the next study lesson yields 13/364, displayed as 3 percent overall and 13/14, displayed as 92 percent for that week.

A day is complete only when all its required lessons and exercises are complete. Day completion time is the latest completion timestamp among these required units. Weekly/module/course completion uses the same all required descendants rule. A completed lesson can be reopened; its day and ancestors become incomplete immediately. Reopening an exercise preserves notes, evidence and task checks, but clears its completed timestamp and criterion attestation so it must be explicitly confirmed again. Unchecking a required task in a completed exercise automatically reopens that exercise in the same transaction. History retains prior completion and reopening events.

### Continue Learning algorithm

1. If there is no enrollment, the GET Continue route redirects to Course with a Start action. Start course creates an enrollment through POST for the latest published release and opens preparation. Until orientation is acknowledged, Continue goes to preparation; the seven checks are advisory and may be deferred explicitly.
2. Compute the earliest incomplete required unit in day order, with study before exercise inside each day. This is the recommended next action.
3. If a valid explicitly active study cursor points to an incomplete unit, resume there at its last saved section/task anchor. Opening another page for reference changes Last opened only. Selecting Study this day deliberately changes the active cursor; label later work as out of sequence.
4. If the cursor unit is complete, choose the first incomplete required unit in that same day. If none remains, choose the earliest incomplete required unit anywhere in the enrolled release. Thus finishing later work returns the learner to earlier gaps.
5. If the cursor is missing or invalid, use the earliest incomplete unit. If every required unit is complete, go to Progress with the course completed state and Appendix G.

Previous and Next are navigation only and never complete anything. Completing a study lesson changes the primary button to Continue to exercise after the save succeeds. Completing the exercise shows day completed only if the study lesson is also complete. Browser Back does not change completion. A completed item viewed as reference must not override an unfinished study cursor.

Persist an allowlisted section anchor on section changes, debounced to one second, and immediately after a confirmed task/progress action. Store the last opened item separately. Resume restores the last acknowledged section, checked tasks and saved note text; exact pixel position and text never acknowledged by the server are not guaranteed. Do not promise to recover unsaved keystrokes after a forced crash.

### Concurrency and durable mutations

Use a transaction for progress, task changes, enrollment revision, resume updates and activity events. Clients submit an idempotency key and expected enrollment revision with explicit desired state, never a blind toggle. A duplicate key with the same request returns its original result; a reused key with different content fails. A stale revision returns 409 and current state, with a message that another tab updated progress. A successful completion response means SQLite has committed. Disable the relevant action while pending; do not display completed as confirmed before success. Revalidate the dashboard and progress queries after every successful mutation.

### Changed curriculum

Published releases are immutable and seed runs are idempotent. New students use the latest release; existing students stay on their pinned release. Typo or URL corrections are still packaged as a new release. A developer operated upgrade tool must show a dry run and make a backup before explicitly migrating an enrollment; there is no automatic migration on app start.

Preserve completion for stable item keys with equivalent learning requirements using an explicit migration map. New required units start incomplete. Materially changed exercises require reattempt even if a title is unchanged. Removed items remain in the archived release/history; they are excluded from the new denominator. Removed cursor targets fall back through the resolver. Transfer notes and evidence using the same map. Recompute percentages and explain any decrease as new/changed material. Do not match by title, array index or paragraph number. The initial JSON identifiers become stable keys and must remain unchanged when reordered.

## 8 Authentication

Use a small server only authentication module with opaque database sessions and a maintained Argon2 implementation. The module has registration, login, logout, currentUser and password change functions. Do not implement cryptographic primitives. The local scope justifies a limited custom module; deploying it publicly requires an authentication review or migration to a supported provider. Next.js documents a server data access layer and authorization checks at each entry point; use those boundaries here. [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication).

Normalize email by trimming surrounding whitespace and lowercasing for an application defined case insensitive identity. Preserve the entered address separately for display if desired; do not remove dots or plus aliases. Validate a conventional email shape and maximum 254 characters on the server. Enforce a unique canonical email in the database and handle concurrent duplicate registration through that constraint. Local registration may say “An account with this email already exists on this installation.” It does not verify mailbox ownership. Public hosting will need verification and anti enumeration behavior.

Require 15 to 128 Unicode code points, with at most 512 UTF8 bytes, for passwords. Allow spaces, password managers, paste and Show password. Do not impose arbitrary symbol rules or periodic expiration. Do not trim or silently normalize a password. Reject a bundled set of common compromised passwords without a network dependency. Client validation improves feedback; server validation is authoritative. Confirm password exists only in the registration form, never in the database.

Use Argon2id, a unique random salt and encoded parameters in each stored hash. Initial parameters are 64 MiB memory, three iterations, parallelism one, tuned on supported hardware without going below the OWASP baseline. Limit concurrent password hashing to two operations per process to avoid memory exhaustion. Rehash on successful login when parameters change. SHA256 is not a password hash. [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Generate a 32 byte cryptographically random session token. Put only the opaque token in the cookie and store its SHA256 digest in the Session table. On every protected request look up the digest and enforce expiration/revocation. Use a fresh token on login; logout revokes that session and clears the cookie. Password change requires the current password, updates the hash and revokes all sessions, then sends the user to login.

Session policy: seven days idle timeout, 30 days absolute maximum; the persistent cookie expires at the absolute limit. Refresh `last_seen_at` at most every five minutes. Expiry changes login state, never learning progress. Cookie: HttpOnly, SameSite=Lax, Path=/, no Domain. Use Secure over HTTPS in hosted mode. Plain HTTP loopback local mode, including a local production build, uses Secure=false and a non `__Host-` cookie name; do not pretend that configuration is suitable for network hosting. Protect all writes with exact Origin checks and a CSRF token. [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Allow at most five failed login attempts per canonical email and ten per client IP per 15 minutes, with a 15 minute temporary block, stored in AuthThrottle. Clear an account's failure count after a successful login; do not permanently lock it. Use the same incorrect credentials message and an Argon2 dummy check for unknown users. Registration is limited to ten attempts per installation/client IP per hour. Return 429 with a retry time. Log outcomes without credentials or raw tokens.

There is no email based recovery in MVP. The login help explains that the trusted device owner can run a documented interactive local password reset command. It prompts for the account and new password without echoing or putting the password in command history, rehashes it and revokes sessions while preserving progress. This is an OS level recovery capability, not a web endpoint or proof of email ownership.

## 9 Local persistence

| Option | Strengths | Limitations for this product | Decision |
| --- | --- | --- | --- |
| SQLite on server filesystem | Transactions, constraints, several accounts, reliable restart persistence, straightforward backups | One writer at a time; requires a writable local data directory and correct backup handling | Authoritative account, content and progress store |
| LocalStorage | Simple UI preferences | Browser/profile dependent, script accessible, no relational constraints, can be cleared | Theme preference only if needed before hydration; never passwords, sessions or progress |
| IndexedDB | Useful structured browser cache and offline app features | Data tied to browser origin/profile, complex sync and local auth boundary | Defer; not authoritative in MVP |
| Local JSON files | Excellent reviewed content authoring and interchange | Weak concurrent write handling and no relational integrity for accounts/progress | Use for versioned curriculum and backups/export metadata, not live user records |

SQLite fits a local application where a separate database service would add setup burden. Its own guidance distinguishes local embedded use from deployments requiring many concurrent writers. [SQLite appropriate uses](https://www.sqlite.org/whentouse.html).

Default writable data directory is `./data` resolved from the repository root, overridden by an absolute `APP_DATA_DIR`. Store the database at `APP_DATA_DIR/learning.sqlite`, outside public assets and build output. Exclude data, backups and local secrets from Git. Bind the app to `127.0.0.1`, use one canonical origin and never use an in memory database except in explicitly isolated tests. Multiple accounts share this one database but queries are scoped to their own enrollment.

Enable foreign keys on every connection, WAL mode, a five second busy timeout and FULL synchronous durability for this small local workload. Use short transactions and one application database connection manager. A disk full, busy or read only failure must fail the save clearly. Do not reset or seed a new database over an unavailable one. WAL improves reader/writer coexistence but does not make SQLite a multiwriter server. [SQLite WAL documentation](https://sqlite.org/wal.html).

Provide `npm run backup` using the SQLite online backup mechanism, plus the release manifest hashes. Create a timestamped backup before migrations and content/enrollment upgrades. Never copy only a live WAL database's main file as the backup strategy. Verify the backup opens and passes integrity checks. `npm run restore -- --file <backup>` requires the server stopped, confirms the target and creates a safety backup before replacing data. Revoke restored sessions so old tokens do not unexpectedly become valid. Backups include all local users and password hashes; protect them with OS permissions. [SQLite backup documentation](https://sqlite.org/backup.html).

Closing the tab, stopping the server and restarting the computer must leave committed accounts, content, notes and progress intact in this directory. Clearing browser storage removes neither accounts nor course progress. Copying an installation without its data directory does not transfer the learner's records; README must explain this.

## 10 Technical architecture

Use a single Next.js App Router application, React, TypeScript strict mode, Node.js runtime, SQLite, Drizzle ORM with the better-sqlite3 driver, Zod validation, Tailwind CSS and accessible unstyled UI primitives where helpful. Use Vitest and React Testing Library for logic/components, Playwright for end to end tests, and axe for automated accessibility checks. Pin a tested stable dependency set and supported Node LTS version in package metadata and the lockfile during Phase 1. Do not copy release candidate install commands from documentation without review.

Drizzle is selected as the lightweight ORM equivalent to Prisma: the engineer can express the supplied SQL constraints directly and keep database queries in TypeScript. It supports SQLite drivers including better-sqlite3. Prisma is also capable but is not an additional dependency in this chosen stack. A PostgreSQL move still requires dialect/schema and migration work; no ORM makes that a connection string only change. [Drizzle SQLite documentation](https://orm.drizzle.team/docs/get-started/sqlite-new).

Use Server Components for authenticated initial reads. Use Route Handlers under `/api` for explicit mutations and a small client request helper. Both call the same application services and repositories. Do not add Express, GraphQL, Redis, a message broker, Docker, Redux or a separate backend process in MVP. The Node server must run locally; static export and an Edge runtime cannot provide this database architecture.

```text
Browser UI
  Next.js pages and authenticated Route Handlers
    Session and authorization checks
    Input validation and application services
      Curriculum queries and source mapping
      Progress resolver and completion rules
      Notes and scorecards
    Drizzle repositories
      SQLite file in APP_DATA_DIR

Versioned JSON and Markdown content
  Validate and preview import
  Transactional publication into SQLite
```

Only server code imports the database driver and auth module. UI receives explicit safe data transfer objects. Private requests use no shared cache and responses include `Cache-Control: no-store`. Do not cache user state solely by content ID. Static public content can be cached by release ID, but its user progress overlay cannot be shared.

Required service contracts are `register`, `login`, `logout`, `changePassword`, `startCourse`, `getDashboard`, `getCourseTree`, `getDay`, `resolveContinue`, `setLessonCompletion`, `setTaskState`, `setExerciseCompletion`, `recordCheckpointResult`, `saveNote`, `saveScorecard`, `saveSettings` and `importRelease`. Authenticated services derive the user from the session, never from submitted user IDs.

| Endpoint | Request and result |
| --- | --- |
| POST `/api/auth/register` | Email/password/confirmation/displayName; creates user, 201; duplicate 409; does not auto login |
| POST `/api/auth/login` | Email/password; validates and sets cookie, 200; invalid 401; throttled 429 |
| POST `/api/auth/logout` | Valid session/CSRF; revoke current session and clear cookie, 204; idempotent |
| POST `/api/auth/password` | Current and new password; 204 then login required |
| POST `/api/enrollment` | Course slug; creates or returns existing enrollment; no duplicate enrollment |
| PUT `/api/progress/lessons/:id` | `completed`, `mutationId`, `expectedRevision`; returns canonical affected progress and next target |
| PUT `/api/progress/tasks/:id` | Explicit done/not applicable/unset, reason/choice and revision; may reopen exercise |
| PUT `/api/progress/exercises/:id` | Explicit completion/result/evidence/scope/criterion and revision; checks all task rules |
| PUT `/api/progress/preparation/:id` | Explicit completion and revision; update checklist without changing denominator |
| PUT `/api/enrollment/orientation` | Acknowledged or deferred preparation; persist orientation acknowledgment and start cursor |
| PUT `/api/enrollment/cursor` | Allowlisted item/anchor and mode open/study; last opened separate from active resume |
| PUT `/api/notes/:itemId` | Body and note revision; 409 returns latest revision on conflict |
| PUT `/api/scorecards/:periodKey` | Fourteen keyed ratings/evidence and revision; absent rating remains unassessed |
| PUT `/api/settings` | Display name up to 80 characters, supported IANA timezone and light/dark/system theme; current session owns the record; email is read only |
| GET `/api/search` | Query, filters, page; results only from enrolled release; no private note search |

Mutation responses use `{ data, revision }` or `{ error: { code, message, fieldErrors?, requestId } }`. Use 400 for malformed input, 401 expired auth, 404 inaccessible/missing content, 409 conflicts, 422 unsatisfied completion rules, 429 throttling and 503 unavailable database. Reads may call services directly in Server Components rather than creating duplicate read APIs. Import and password recovery are local CLI commands, not browser endpoints.

## 11 Database schema and invariants

The full field definitions, constraints and indexes are in **schema.sql**. IDs are UUID strings for users, sessions, enrollments, events and mutations. Content row IDs combine immutable release identity with stable content keys or use generated UUIDs; stable keys such as `d001-learn` persist across releases. SQL timestamps are UTC epoch milliseconds; date only source strings remain source metadata. JSON fields are validated with Zod before writing and a database JSON validity check. Do not store executable MDX in database fields.

The shared ContentItem record supplies stable identity, hierarchy, ordering, title, body, provenance hash and required status. Typed detail tables keep the actual models explicit. This lets notes, resource uses and source maps point to one content identity without many ambiguous nullable foreign keys.

| Model and physical table | Important fields | Relationship and invariant |
| --- | --- | --- |
| User `app_user` | id, emailCanonical unique, passwordHash, displayName, timezone, uiLocale, theme, timestamps | One user owns sessions and enrollments; safe DTO never contains passwordHash |
| Session `session` | userId, tokenHash unique, createdAt, lastSeenAt, expiresAt, revokedAt | Belongs to User; expiry checked server side |
| AuthThrottle `auth_throttle` | keyHash, failureCount, windowStartedAt, blockedUntil | Persist local rate limits without storing attempted passwords |
| Course `course` | id, slug unique, title | Parent of immutable releases |
| CourseRelease `course_release` | courseId, version, status, source/manifest hashes, language, publishedAt | Unique course/version; enrollment pins one release |
| ContentItem `content_item` | releaseId, stableKey, kind, parentId, orderIndex, title, bodyMarkdown, required, metadata, hash | Unique release/key; parent must be in same release |
| Module `course_module` | itemId, phaseNumber, introduction | Item kind module; root under release |
| Week `course_week` | itemId, weekNumber, objective, resource instructions, main evidence, source dates, phase signal | Parent must be Module |
| Day `course_day` | itemId, dayNumber, sourceDate, estimatedMinutes, aiPolicy, criterion, assessmentKind, remediation | Parent Week; numbers 1 to 182 unique within release |
| Lesson `lesson` | itemId, studyInstruction, optional objective, typed blocks | Parent Day; one required lesson per day in initial release |
| Exercise `exercise` | itemId, relatedLessonId, instructions, expected result, nullable difficulty/time/hints/solution, help policy | Parent same related Lesson; one required bundle per lesson initially |
| ExerciseTask `exercise_task` | itemId, requirementMode, ruleJson | Parent Exercise; original order and clause rules preserved |
| Resource `resource` | releaseId, stableKey, title, original/resolved URL, source, type, description, link origin/status/check time | Immutable source URL; replacement URL is separate metadata |
| ResourceUse `resource_use` | resourceId, contentItemId, assignedText, sectionLocator, requirementMode, order | Context specific requiredness, not global required flag |
| SourceBlock `source_block` | source locator, style, table/row/cell, exactText, links, hash | One per original body paragraph including whitespace and metadata records |
| SourceMapping `source_mapping` | sourceBlockId, contentItemId, targetField, websiteLocation, kind | One source block may map to several app locations; every substantive block maps at least once |
| Enrollment `enrollment` | userId/courseId unique, releaseId, startedAt, orientation acknowledgment, revision, lastOpened and resume cursor | All cursor targets must be inside its release |
| UserProgress `user_progress` | enrollmentId/lessonId key, status, startedAt, completedAt, updatedAt | Only required completed lessons contribute to course totals |
| ExerciseProgress `exercise_progress` | enrollment/exercise key, status, evidence, scope, criterion, result, rubric, help reveals, timestamps | Completion requires task rules, evidence and criterion; a failed checkpoint is started |
| TaskProgress `task_progress` | enrollment/task key, done or notApplicable, reason, timestamp | Missing row means unchecked; notApplicable requires a valid conditional rule and reason |
| PreparationProgress `preparation_progress` | enrollment/item key, completedAt | Separate from course denominator |
| Note `note` | enrollment/item unique, bodyText, revision, createdAt, updatedAt | Private and conflict checked |
| Scorecard `scorecard` | enrollment/period unique, keyed ratings/evidence, revision | Exactly the 14 source dimensions; each rating absent or integer 0 to 3 |
| ActivityEvent `activity_event` | enrollment, stable item key, event type, occurredAt, payload | Append on state transition, not every page view or duplicate request |
| MutationReceipt `mutation_receipt` | enrollment/mutation key, request hash, response, createdAt | Retry deduplication; retain seven days then prune |

Module/week/day are not weighted as independent progress units. The `completed_day` view in the supplied DDL demonstrates initial release rollup. A future release with multiple required lessons per day must replace that view with an all required descendants aggregation and matching tests before publication.

Importer checks enforce unique sibling order, unique week/day/phase numbers within a release, valid parent types, acyclic hierarchy, one initial lesson/exercise bundle per day, matching exercise relation, valid task rules, source coverage and valid resource scope. Content publication is one transaction after validation. These cross table semantic rules are not all expressible as simple SQLite checks; they must be tested in the importer and rechecked before publishing. Runtime services validate enrollment ownership and release membership for every read/write. Compound foreign keys prevent cross release progress references. Completed records require timestamps; exercise completion additionally requires evidence, passed result and criterion attestation.

Do not hard delete published content referenced by progress. Users can be deleted only through a future explicit account deletion workflow or a documented developer recovery procedure; the schema's cascade behavior is not permission to expose deletion casually in MVP.

## 12 Curriculum content model and import contract

Use a hybrid of version controlled JSON metadata and plain Markdown content, imported into the database. JSON defines identities, order, relationships, task rules, resource uses and source mapping. Markdown supplies long content blocks and templates. Avoid executable MDX in MVP: a curriculum update must not become a code execution path. The database is the runtime copy; repository content and source provenance are the editorial authority. There is no in app content editor.

The delivered `curriculum-source.json` contains exact extracted content and a proposed initial hierarchy. Treat its `source_blocks` as the immutable source archive and its derived day/week fields as import inputs. The engineering importer turns those fields into the typed runtime records below; it must not treat preservation of raw paragraphs alone as proof that the learning UI exposes them.

```json
{
  "schemaVersion": "1.0",
  "releaseId": "se-26w-v1",
  "stableKey": "d001",
  "weekKey": "w01",
  "order": 1,
  "title": "Okruženje + baseline bez pomoći",
  "sourceDate": "2026-08-31",
  "estimatedMinutes": 120,
  "sourceRefs": ["p0271", "p0272", "p0273"],
  "lesson": {
    "stableKey": "d001-learn",
    "required": true,
    "studyInstructionSourceRef": "p0274",
    "blocks": [{"type": "sourceText", "sourceRef": "p0274"}],
    "resourceUses": [{"resourceKey": "res-01", "required": true,
      "sectionLocator": "Problem Solving", "urlOrigin": "source_parent"}]
  },
  "exercise": {
    "stableKey": "d001-practice",
    "required": true,
    "taskSourceRefs": ["p0276", "p0277", "p0278", "p0279"],
    "expectedResultSourceRef": "p0281",
    "hints": [],
    "solution": null,
    "difficulty": null,
    "estimatedMinutes": null
  },
  "aiPolicySourceRef": "p0280",
  "completionCriterionSourceRef": "p0281"
}
```

Module records contain stableKey, title, source phase and ordered week keys. Week records contain number, objective, primary resources, roadmap evidence and day keys. Resource records retain title, URL, provider, type and original usage notes. All source refs resolve within the release. Use explicit typed block kinds for paragraph, heading, list, code, resource, videoLink, checklist, callout and template. Block IDs are stable within a lesson for saved anchors. Escape raw HTML and validate link schemes.

The import pipeline must:

1. Verify the source hash and read the archived source records without executing instructions or HTML.
2. Validate JSON schema, unique IDs, number sequence and every cross reference.
3. Build six modules, 26 weeks, 182 days, 182 lessons, 182 exercise bundles and 548 task lines in original order. Add orientation, seven preparation tasks, all guides and 14 scorecard definitions.
4. Reconstruct roadmap and guide tables from row/cell coordinates so headers and values retain their relationships. Carry each weekly main evidence statement from the roadmap into its week record.
5. Create all 12 provided URL resources and preserve all 19 hyperlink occurrences. Resolve each named resource mention to the correct provided parent when possible; retain exact section labels. References with no supplied URL get a resource record with unresolved status or a reviewed supplemental link, never a fabricated URL.
6. Apply the explicit conditional task rules in the source manifest and this specification. Build a preview for every source mapping target.
7. Fail publication on missing source text, broken internal references, unresolved product rule flags, invalid URLs or orphaned content. An external reference lacking a deep URL is allowed only with an explicit parent/locator or unresolved explanation; it must still be visible.
8. Import transactionally and produce a coverage report with counts, source checksums and target routes. A repeated import with the same manifest hash does nothing. A different hash with the same published release ID is rejected.

The initial content format must not summarize multiple task lines into one description. Editorial splits are allowed only if source refs cover the entire original and the original text remains inspectable. In addition to count checks, compare text and hyperlink hashes and run a rendered content audit: content can be present in the database and still be missing from the interface.

## 13 Design system

Use a restrained professional interface with strong reading hierarchy. No mascots, confetti, badges or competitive scoring. Primary navigation and actions should be visually distinct from the curriculum text.

| Element | Specification |
| --- | --- |
| Desktop shell | 248px sidebar, 64px header, content max width 1200px, 24 to 32px gutters |
| Reading layout | Text column max width 760px; optional 220px local outline only when there is room |
| Spacing | 4px base scale: 4, 8, 12, 16, 24, 32, 48; cards use 20 to 24px padding |
| Typography | Bundled or system sans serif; body 16px at 1.6 line height; H1 30/38; H2 24/32; H3 20/28; labels 14/20; code 14/22 monospace |
| Light tokens | Background #F8FAFC, surface #FFFFFF, text #0F172A, muted #475569, primary #1D4ED8, success #166534, danger #B91C1C, border #CBD5E1 |
| Dark tokens | Background #0B1220, surface #111827, text #F1F5F9, muted #CBD5E1, link/focus #93C5FD, success #86EFAC, danger #FCA5A5, border #475569 |
| Buttons | Primary filled action, secondary outlined navigation, quiet text action; minimum 44px interaction height; pending label and disabled double submission |
| Cards | 1px border, 10px radius, minimal shadow; title, metadata, status and one primary action |
| Progress | Native semantic progress element or equivalent, visible percent and counts, label includes scope; no color only meaning |
| Status | Not started circle, In progress partial circle, Completed check plus words; Needs review uses text/icon and an action |
| Code | Language label, preserved indentation, horizontal scrolling inside block, copy feedback announced; never forced wrap that changes code meaning |
| Resources | Provider, type, assigned section, required/optional/reference chip, descriptive link and external destination indicator |
| Exercise tasks | Native checkbox with full label, condition text immediately adjacent, optional designation visible, save status per interaction |
| Focus | At least 2px visible outline with offset; focus not hidden by sticky header/action bars |
| Motion | Short functional transitions only; respect reduced motion; progress updates do not animate distractingly |

Use semantic token pairs and test actual contrast; listed colors do not excuse failing a specific foreground/background combination. Dark mode supports light/dark/system. Persist the choice per user, with a nonsecret browser preference allowed for first paint. No external font or icon CDN dependency. The same components render completed and incomplete states to avoid inconsistent spacing and controls.

## 14 UX rules

| Rule | Default behavior |
| --- | --- |
| Availability | Every published day is browsable after login; no calendar or prerequisite locks |
| Skip ahead | Allowed through course navigation; explicit Study this day changes active resume; earlier gaps remain visible |
| Sequential recommendation | Earliest incomplete required unit remains recommended; source order is never changed by dates |
| External reading | Clicking a link does not complete the lesson or resource; learner confirms study separately |
| Exercise completion | Manual evidence and criterion confirmation; all applicable required tasks must be satisfied |
| Partial work | Task checks, notes and scope save independently; partially complete exercises contribute zero unit credit until complete |
| Day completion | All required study and exercise units complete; no extra Mark day complete switch |
| Revisit | Read without changing status; Reopen is explicit |
| Undo | Restore incomplete immediately and recalculate affected ancestors; retain evidence and history |
| Failed checkpoint | Save Needs review and suggested remediation; no pass credit or punitive lock |
| Optional work | Visible and checkable, excluded from required task gates where optional; never counted as skipped failure |
| Other users | UI/account/session data isolated; logging into another account clears user scoped UI state |
| Full completion | Offer final retrospective, handbook and Appendix G; no certificate claim |

Use original AI guidance as learning support, not surveillance. There is no reliable way for this local app to know whether a student used AI in another application. Any “AI off” completion statement is the student's attestation.

## 15 Navigation

Desktop sidebar contains Dashboard, Course, Progress, Resources and Settings, with Handbook as a secondary link inside Course. The header contains the current page title, search entry, theme control and account menu. Logout is reachable from the account menu and Settings. Keep course navigation expanded to the current module/week/day without displaying all 182 days at once.

Breadcrumbs follow Course → original module title → Week N → Day N → Study or Exercise. Each ancestor is linked except the current page. Use the exact curriculum title on day/lesson links, prefixed with the day number to disambiguate repeated names such as Checkpoint.

The learning sequence is Day 1 study → Day 1 exercise → Day 2 study, continuing through Day 182 exercise. Previous/Next follow this sequence independent of completion. First study has Back to preparation instead of Previous lesson. Final exercise has Review progress instead of Next. Day workspace has separate Previous day/Next day controls. Disabled boundary controls have an understandable label or are replaced by the stated destination. Never silently mark a unit complete on navigation.

Mobile uses a header menu button opening a modal navigation drawer with the same primary links, a Course outline button and a compact breadcrumb. The drawer traps focus while open, closes with Escape, and returns focus to its trigger. A sticky bottom study action may appear only if it does not obscure text, errors or the onscreen keyboard. No separate mobile course hierarchy.

## 16 Resource library

Preserve the 12 source URLs exactly as provided and each of their 19 uses. Canonical records represent The Odin Project Foundations, The Odin Project JavaScript, CS50x, CS50x Problem Sets, Full Stack Open, Exercism JavaScript, MDN JavaScript Guide, javascript.info, React Learn, Node.js Docs, Pro Git and PostgreSQL Tutorial. The complete URL list and source usage descriptions are in the audit and JSON.

Each resource has title, original URL, optional resolved/replacement URL, source/provider, type, description, release, link origin, link check status and check time. Its uses carry exact assignment wording, section locator, requirement mode and related content item. Inherit module/week/day filters through that item. A reference can be optional in one context and required in another, so do not put requiredness solely on the resource record.

Use types documentation, article, video, course, tool, reference, practice website and internal guide. Library filters combine with AND; multiple values within one filter combine with OR. Show result count, clear filters, related days, and source defined status. Search/filter state lives in the URL so Back restores it. Paginate 25 results with stable title/ID ordering.

Named references without supplied links, such as Jest setup, ESLint, Express, SQLite, tool documentation or a specific Odin section, remain first class resource mentions. Use a known parent URL plus exact section text when that is enough; otherwise show “No direct link supplied in the manual” and the original reference. Verified supplemental URLs may be added with separate provenance and a date. Do not claim this handoff has audited availability of every external page; the 12 supplied targets were extracted and preserved, not exhaustively live checked.

External resources open through descriptive anchors with `target="_blank"` and `rel="noopener noreferrer"`, visibly announcing a new tab. Do not proxy arbitrary student supplied URLs through the backend. A developer link check command checks only the reviewed resource registry with bounded redirects/timeouts; it does not execute during setup or block local startup for internet failure. Keep unavailable resources visible with original wording, parent navigation or a reviewed replacement. A failed external page load never erases progress.

## 17 Search

Include simple MVP search because 182 days and the handbook are too large to scan manually. Search lesson/day titles, week topics, exercise instructions/task text, handbook text and resources. Do not search password fields, other users' information or private notes. Search is available from the header and within Resources.

On import, derive plain searchable text from safe content. For this small course, use parameterized SQLite LIKE queries and a server side normalized text representation; no hosted search service or FTS dependency is required. Normalize case and diacritics for matching while retaining original display text. Escape LIKE wildcard characters. Limit the query to 100 characters, split into at most eight tokens, require every token, and rank exact/prefix title matches before title token and body matches. Order ties by curriculum order then ID. A Unicode normalization test must cover Serbian Latin diacritics and English technical terms.

Debounce 250 milliseconds and search after two characters, while Enter can submit a one character technical term. Show grouped results, a short escaped snippet and breadcrumbs. Return 20 results per page. Highlight matches with text markup without injecting raw HTML. Empty query shows guidance and recently opened course links; no matches offers clear query/filters. Database error shows Retry and preserves query.

## 18 Accessibility

Target WCAG 2.2 AA for the core journey. Use semantic landmarks, one H1 per page, logical headings, a skip to content link, native form elements and programmatic labels. Error text must be associated with fields and an error summary must receive focus after a failed form submit. Keep logical DOM order consistent with visible order. [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

All navigation, checklists, reveals, menus and completion actions must work with keyboard alone. Focus is visible and restored after dialogs. Current navigation uses `aria-current`; expanders use `aria-expanded` and proper controls relationships. Statuses do not rely on color. Announce saved/completed messages with a polite live region without repeatedly reading the whole page.

Test text contrast at least 4.5:1 for normal text and 3:1 for large text; nontext controls/focus also meet applicable contrast. Use 44px interaction targets where practical. Support 200 percent zoom and 320 CSS pixel reflow, with intentional exceptions for horizontally scrollable code and data tables. Prevent sticky bars from obscuring focus. Password managers and paste must work.

Code blocks have a readable label, preserved plain text and a labeled Copy button; syntax color is supplementary. External video links identify provider/title; do not autoplay. When embedding is added, require keyboard usable controls and captions/transcripts or an accessible alternative. The source does not contain video transcripts; never label absent transcripts as available.

Acceptance includes automated checks plus keyboard and screen reader review of registration, login, dashboard, a day, exercise completion, navigation drawer and errors. Automated checks alone cannot establish conformance.

## 19 Responsive behavior

| Viewport | Required behavior |
| --- | --- |
| Desktop at least 1280px | Full sidebar, reading column with optional outline, dashboard cards in a row |
| Laptop 1024 to 1279px | Sidebar remains or collapses to a toggle based on available content width; no required right outline |
| Tablet 768 to 1023px | Navigation drawer, two column dashboard where cards remain legible, single reading column |
| Mobile below 768px | Drawer, one column, full width actions, wrapping breadcrumbs, compact course outline, filters in expandable panel |

Exercise instructions, task checks, notes, resource access and progress must work on mobile. Show a small “Code in your local IDE” explanation rather than a broken editor. Do not disable completion on mobile; the student may have coded on another device, although this local installation itself does not synchronize to another device. Test at 360×800, 768×1024, 1024×768 and 1440×900, plus 320px reflow and 200 percent zoom. Wide code/tables scroll inside their own containers; the whole page must not overflow horizontally.

## 20 Error handling and recovery

| Condition | Student message and behavior | Engineering handling |
| --- | --- | --- |
| Incorrect login | Email or password is incorrect; preserve email, clear password | Generic 401, dummy hash check for missing account, rate limit |
| Duplicate email | This installation already has an account with that email; link to login | Catch database uniqueness conflict as well as precheck |
| Missing seed/release | Course is not available on this installation; show setup help | 503 with request ID; do not create demo content or silently reseed |
| Database busy/unavailable | Could not save; your last confirmed progress is unchanged; Retry | Bounded busy timeout, rollback transaction, log safe diagnostic code |
| Disk full/read only | Saving is unavailable; preserve draft in the current page and offer copy | No misleading Saved state, no in memory fallback |
| Broken external resource | Retain source title/URL and alternative navigation if reviewed | Link status is descriptive; no auto completion or deletion |
| Invalid route | Page not found; Course and Dashboard links | 404, not a redirect that hides missing curriculum |
| Session expired | Sign in again to continue; preserve a safe internal return path | 401; do not log notes or passwords; locally visible draft can be copied before login |
| Conflicting tab update | Progress changed in another tab; reload confirmed state | 409 with current revision; never silently overwrite |
| Invalid progress reference | Progress needs repair; show confirmed valid records if safely queryable | Reject invalid writes; diagnostic command identifies rows and repairs only from backup/reconciliation plan |
| Database integrity failure | Local data could not be opened; restore instructions and backup location | Stop mutations, preserve original file, no automatic deletion or blank replacement |
| Import failure | Existing published course remains available | Validate before transaction; rollback whole new release |

Use plain actionable messages. Unexpected errors include a support/request identifier, not SQL, file secrets or stack traces. A retry repeats the same idempotent mutation. On a server crash, the next launch runs a lightweight availability/schema check; an explicit diagnostic command performs full integrity and foreign key checks. Do not silently convert unknown statuses to complete or reset a course to zero.

## 21 Development phases and delivery plan

Work as a sequence of usable increments. The first vertical slice should cover Day 1 with real authentication and persistence before building every screen. Content conversion can proceed while UI components are developed, but all 182 days and guides are a release requirement. Estimates below are planning ranges for one senior full stack engineer with periodic content review, not a delivery commitment; allow roughly seven to ten calendar weeks depending on availability and content QA.

| Phase | Features and dependencies | Definition of Done | Important tests |
| --- | --- | --- | --- |
| 1 Foundation and local startup | Repository, pinned runtime, Next.js shell, TypeScript, lint/format, configuration, loopback startup; no dependencies | Fresh checkout starts; production build runs locally; data path and errors documented | Clean install, missing env, unsupported runtime, port in use |
| 2 Database and authentication | Migrations, connection settings, User/Session, register/login/logout/recovery, route guards; depends on 1 | Two accounts persist across restart; protected service boundaries enforced | Hash/salt tests, duplicate race, expired/revoked sessions, CSRF, throttle, isolation |
| 3 Curriculum import and provenance | Immutable release model, source parser/normalizer, complete source mapping, preview, seed; depends on 1 and database portion of 2 | Six phases, 26 weeks, 182 days, 548 task lines and all supporting material import with zero substantive source omissions | Missing IDs, duplicate numbers, cross release FK, text/link hash coverage, rollback, idempotent seed |
| 4 Course navigation | Course/module/week/day/guide routes, outline, breadcrumbs, previous/next, advisory dependencies; depends on 2 and 3 | Every mapped curriculum destination reachable; canonical order correct | First/last boundaries, direct URL, unknown slug, repeat checkpoint titles |
| 5 Daily study and exercise slice | Study blocks, tasks, resources, AI rules, criterion/evidence, notes, Day 1 through Day 7; depends on 4 | Real learner can complete a day and a checkpoint with original content | Required/conditional/optional rules, no fake hints, keyboard use, note save failure |
| 6 Durable progress and resume | Transactions, idempotency/revisions, resolver, rollups, undo, activity, cursor; depends on 2 to 5 | Close/restart journey passes and exact fractions reconcile | All 364 units, partial day, skip ahead, completed reference visit, double click, two tabs, crash/retry |
| 7 Complete resources and learner tools | Search, filters, all resource mentions, handbook templates, 14 dimension scorecard; depends on 3 to 6 | All appendices usable and every resource reference visible in context and catalog | Diacritics, no results, resource use requiredness, source link preservation, score validation |
| 8 Dashboard and settings | Continue card, current module, totals, recent activity, theme/timezone/password change; depends on 6 and 7 | New/in progress/needs review/completed dashboards are useful and consistent | Exact counts, empty history, theme preference, expired session, settings save conflict |
| 9 Responsive and accessibility review | Full device matrix, keyboard and screen reader review, dark mode, focus/error polish; depends on all UI | No blocking accessibility findings; all major pages usable at target widths | axe, keyboard flow, zoom/reflow, focus trapping/return, code overflow |
| 10 Release verification and handoff | Backup/restore, migration rehearsal, complete content audit, setup README, production smoke test; depends on 1 to 9 | All acceptance criteria pass with recorded evidence; no unresolved data loss or security defects | Clean machine setup, reboot persistence, backup restoration, rollback, full 182 day audit |

Suggested effort allocation is 3 to 4 engineer days for foundation, 4 to 6 for data/authentication, 4 to 7 for curriculum import, 3 to 4 for navigation, 4 to 6 for learning UI, 4 to 6 for progress, 3 to 4 for resources/tools, 2 to 3 for dashboard/settings, 3 to 4 for accessibility/responsive work and 3 to 5 for release validation. Some tasks overlap, but test and content review time must remain in the plan. The critical risks are conversion fidelity, ambiguous external assignment scope, native SQLite/Argon2 installation on supported systems, and save/restore correctness. Resolve installation feasibility and the Day 1 restart slice before investing in polish.

## 22 MVP boundaries and later versions

**MVP** includes the complete single course, local multiuser email/password accounts, database sessions, preparation, source faithful course navigation, study and exercise pages, task rules, manual completion and evidence, durable notes, checkpoints, progress/resume, dashboard, resource catalog, simple search, complete handbook, saved source scorecard, light/dark/system appearance, responsive accessibility, CLI content import, backup/restore/recovery, automated tests and setup documentation.

**Version 1.1** may add bookmarks, richer evidence entries and per student export/import, better search ranking, a reviewed library of original hints, optional personal study dates, source link health reporting, in app curriculum upgrade review and an offline resource availability checklist. Add only features whose value is shown by student use. Translation is a separate content project, not automatic replacement of the source language.

**Future versions** may add hosted accounts and synchronization, teacher review, assignment submission, GitHub integration, browser editing, isolated execution/tests, analytics, discussion and an AI tutor. Certificates require a defined assessment standard; checkbox completion alone is insufficient. An AI tutor must obey daily learning restrictions and be optional. Any execution or submission system requires its own security design. These features are not prerequisites for using the initial course.

## 23 Testing strategy

Unit tests cover completion eligibility, every conditional task mode, percentages, current context derivation, the Continue resolver, email normalization, validation, safe return paths and content rule validation. Use table driven tests with boundary examples rather than snapshot tests that merely mirror code.

Database integration tests use temporary file based SQLite databases with the same migrations, foreign keys and durability settings as the app. Test unique accounts, duplicate enrollment, cross release rejection, rollback, failed imports, reopen propagation, note conflicts, idempotency receipts, seed repetition and backup restore. A separate test directory must never resolve to the live APP_DATA_DIR.

Component tests cover form errors, pending/saved/failure state, task applicability, source AI rule visibility, missing hint controls, completed/reopen controls, keyboard navigation, search empty/error results and accessible labeling. Avoid brittle snapshots of the whole 182 day tree.

End to end acceptance must run against a production build in addition to development smoke testing. The critical journey is:

1. Start with a new temporary disk database and import the complete course.
2. Register user A, land at login, log in, acknowledge preparation and start Day 1.
3. Complete the study lesson; verify Day 1 is 50 percent and the course is 1/364.
4. Check all four Day 1 tasks, enter evidence, attest the original criterion and complete the exercise. Verify Day 1 complete and course 2/364.
5. Open Day 2 study, save a note and section cursor without completing it.
6. Close the browser and terminate the application process. Start a new application process against the same database. Use a fresh browser context and log in again.
7. Verify the account, Day 1 completion, evidence, note and exact counts remain. Continue must open Day 2 study at the saved section.
8. Log out, register/log in as user B, and verify B sees zero progress and no A notes/evidence/history. Attempt direct API access to A records and expect rejection.

Also test restart with a still valid persistent session, session expiry, account password recovery, clearing browser storage, abrupt termination immediately after an acknowledged save, duplicate completion requests, 409 conflicts, resource visits that do not change progress, failed checkpoints, day 125 alternative path, and revisiting completed Day 1 while Day 2 remains active. Test course completion through fixtures, not 364 repetitive UI clicks; verify final state and last/next boundaries.

Content tests compare source text and link hashes, not only counts. Walk every mapped route and verify the intended content field or accessible panel exists. Check the 26 weekly goal/evidence records, all preparation tasks, all appendix table labels/values and repeated hyperlink occurrences. Audit global resource aliases and unresolved references. A source paragraph visible only in an engineering JSON file does not pass the student UI criterion.

Accessibility testing combines axe, keyboard checks, screen reader checks and contrast validation in both themes. Responsive tests use the four stated viewports plus zoom/reflow. Test external resources with deterministic fixtures/stubs in automated tests; internet outages should not make core tests flaky. Perform a separate manual link review without treating external site availability as a platform defect.

Performance targets on the engineer's documented reference laptop and production build: dashboard/day navigation generally under 500ms after warm startup, progress mutations under 300ms excluding intentional authentication hashing, and course search under 300ms for the complete dataset. Treat these as local engineering budgets, measure them and record hardware rather than promising universal timings.

## 24 Developer setup and README requirements

The desired first run is:

```sh
git clone <repository-url>
cd <repository-directory>
npm install
npm run setup
npm run dev
```

Use `npm ci` for repeatable installs from the committed lockfile. Only the pinned Node LTS runtime and Git should be ordinary prerequisites. `setup` must work on Windows PowerShell, macOS and Linux through a Node script, without shell specific commands or a separately installed SQLite command line program. Verify better-sqlite3 and Argon2 package installation on the supported runtime/platforms; document a precise build tool remedy if prebuilt binaries are unavailable. Never hide this dependency behind a command that fails with an unexplained compiler error.

The setup command validates configuration, resolves/creates the data directory, acquires an exclusive setup lock, generates local nonpublic configuration values when absent, applies committed migrations, validates the full content package, imports the published release and prints the local URL and data path. It creates no default administrator or shared password. Setup never drops tables, overwrites a user's database, changes existing progress or republishes an altered release under the same ID. Repeating it is safe.

`npm run dev` binds to `127.0.0.1:3000`. Print that canonical origin and handle occupied ports with a clear instruction. `npm run build` and `npm start` provide the normal student local runtime without hot reload. Development is for the engineer; the README should recommend the production build for regular study. No cloud keys are required. Fonts, styling, icons and all source text are bundled.

Document: purpose and scope; supported OS/runtime; installation commands; first registration; starting/stopping and browser URL; where data lives; what closing the app preserves; limits of offline use; email verification/recovery limitations; password reset command; backups/restoration; migration and release import commands; content file format; source traceability checks; tests/lint/format/typecheck; environment variables; port/database/native module troubleshooting; architecture; known limitations; production migration outline; and the difference between platform setup and student course tooling such as VS Code, Git, C, Python or MongoDB.

Required environment settings: `APP_MODE=local` for this release, `APP_DATA_DIR`, canonical `APP_ORIGIN`, `NODE_ENV`, optional `PORT`, log level and CSRF secret if the implementation uses signed CSRF tokens. Defaults must be safe for loopback. Local mode must reject nonloopback binding/origins regardless of NODE_ENV. A future hosted mode must require HTTPS and Secure cookies. NODE_ENV=production alone must not disable the supported local loopback workflow. Never prefix server secrets with `NEXT_PUBLIC_`.

Required scripts: setup, dev, build, start, typecheck, lint, format:check, test, test:integration, test:e2e, content:validate, content:import, content:audit, db:diagnose, backup, restore, auth:reset-password and curriculum:upgrade with dry run support. The local upgrade CLI is developer operated; public admin UI is out of scope.

## 25 Project folder structure

```text
programming-learning-platform/
  src/
    app/
      (auth)/login/page.tsx
      (auth)/register/page.tsx
      (student)/dashboard/page.tsx
      (student)/course/[courseSlug]/
        page.tsx
        modules/[moduleKey]/page.tsx
        weeks/[weekKey]/page.tsx
        days/[dayKey]/page.tsx
        days/[dayKey]/lessons/[lessonKey]/page.tsx
        days/[dayKey]/exercises/[exerciseKey]/page.tsx
        guide/[slug]/page.tsx
      (student)/resources/
      (student)/progress/
      (student)/settings/
      continue/route.ts
      api/auth/ api/progress/ api/notes/ api/search/
      layout.tsx  error.tsx  not-found.tsx
    components/
      ui/          # Buttons, fields, dialog, status, progress
      layout/      # Sidebar, header, breadcrumbs, mobile drawer
      course/      # Course tree, day cards, study blocks
      exercises/   # Task list, evidence, completion, hints
      resources/   # Cards, filters, resource contexts
      dashboard/   # Continue card and progress summaries
    server/
      auth/        # Passwords, sessions, guards, CSRF, throttle
      services/    # Enrollment, progress, resume, notes, scorecards
      repositories/# Typed database access only
      content/     # Validate, normalize, import, provenance audit
      db/          # Connection, typed schema, migration runner
      logging/
    domain/
      progress.ts  completion.ts  curriculum.ts
      validation/  types/
    lib/           # Formatting, safe URL helpers, UI utilities
    styles/        # Semantic tokens and global styles
    i18n/en.ts
  content/software-engineer/releases/se-26w-v1/
    manifest.json
    modules/ weeks/ days/ guides/ resources.json
    source/        # Original source snapshot, blocks and mappings
  drizzle/         # Reviewed committed SQL migrations
  scripts/         # Cross platform setup, backup, restore, audit
  tests/unit/ tests/integration/ tests/components/ tests/e2e/
  tests/fixtures/  # Isolated data and alternate releases
  public/          # Bundled public assets only
  data/            # Ignored local DB and backups
  .env.example  .gitignore  README.md
  package.json  package-lock.json  tsconfig.json
  drizzle.config.ts  playwright.config.ts  vitest.config.ts
```

Route groups are organization, not security. Each service and handler still verifies the session and ownership. Preparation and roadmap routes use the same course group even if omitted from this abbreviated tree.

## 26 Engineering standards

Use TypeScript strict mode, explicit input schemas, typed safe DTOs, named domain operations and reusable accessible UI components. Keep progress formulas and the Continue algorithm in one domain module used by dashboard, day pages, progress and APIs. Tests target that shared behavior. Do not duplicate curriculum arrays inside components.

Use reviewed database migrations, never destructive schema push against learner data. Store configuration in validated environment settings and commit only examples. ESLint, formatter, typecheck, domain/integration tests, production build and the critical end to end journey must run before merge. Avoid unbounded any types and suppressions without an explanation.

Make small cohesive Git commits such as content schema, session protection or completion rules, with the relevant tests and documentation. PR descriptions explain resulting behavior and validation. Logging is structured and minimal: request ID, operation, result, duration and safe error code. Never log passwords, session tokens, hashes, private note bodies or full authentication payloads. Record course import versions and migration outcomes. No remote telemetry in MVP.

Keep abstractions limited to actual boundaries: auth, curriculum, progress and persistence. No generic plugin engine, repository framework, custom design system generator or dependency graph service. Use straightforward SQL/Drizzle queries and pure functions for completion/resume. All supported user facing states must have deliberate copy, including pending and failure states.

## 27 Security requirements

- Hash passwords and store only digests of opaque sessions. Keep all authentication code server side. Never expose hashes through API responses, page props, browser bundles, exports intended for one student's progress or logs.
- Protect every data access and mutation with session verification and enrollment ownership. A hidden button or page layout check is insufficient. Return 404 for inaccessible learner records where revealing existence is unnecessary.
- Validate IDs, body sizes, content types, state transitions and source version membership. Use parameterized queries. Do not interpolate SQL, shell commands or paths from user input.
- Check exact Host/Origin against the configured loopback origin, use CSRF tokens and SameSite cookies, reject unsupported origins and avoid permissive CORS. The local service must not be reachable from other devices by default.
- Sanitize rendered Markdown, disallow raw executable HTML/MDX, allow only reviewed URL schemes and add a restrictive content security policy suited to Next.js. Do not add third party scripts to study pages.
- The server never executes student code, opens submitted file paths or fetches arbitrary evidence URLs. Private notes are rendered as text or restricted Markdown with the same sanitization.
- Keep the database and backups outside public directories. SQLite is not encrypted by default; OS access to the data directory is a trust boundary. Local account separation does not protect against the device owner reading the database. Use OS permissions and full disk encryption where appropriate.
- Set security headers including nosniff and frame restrictions. Reassess HTTPS, email verification, rate limiting infrastructure, backups and provider integration before public hosting. Keep dependencies patched and record the pinned runtime in the README.

These controls protect a loopback learning application within its stated scope. Do not expose the local build on a LAN or the internet by changing a bind address and calling it production ready.

## 28 Migration to hosting and PostgreSQL

Preserve domain services, stable content IDs, DTOs and frontend behavior. Keep server database imports behind repositories and authentication behind a currentUser/session adapter. This is enough separation for migration without building an unused generalized storage system.

The migration is a controlled project:

1. Freeze writes for the cutover and make a verified SQLite backup with source/release hashes. Inventory every installation to migrate; multiple local installations may contain different people using the same email, because email was never verified.
2. Create a PostgreSQL schema and a new dialect appropriate migration history. Translate integer booleans, epoch timestamps and JSON to appropriate target types; preserve UUIDs/stable keys, Unicode, constraints and indexes. Drizzle's SQLite table declarations must be replaced or adapted for the PostgreSQL dialect.
3. Export content, source mappings, users, enrollments, canonical progress, notes, scorecards and history. Import in dependency order, inside controlled batches with validation. Never merge users across installations solely by unverified email.
4. Reconcile row counts, content hashes, foreign keys, per user unit totals, day totals and resume targets. Run the same domain and journey tests against PostgreSQL. Dry run on a copy before production cutover.
5. For hosted authentication, introduce a separate mapping from provider subject to the existing internal user ID. If the provider safely supports the existing password hash format, use its supported import path. Otherwise require a verified account claim/reset; do not invent password conversion or store plaintext. Do not carry local session tokens into hosting.
6. Add HTTPS, secure cookies, verified email/recovery, production CSRF/origin configuration, persistent rate limiting, managed secrets, backup/restore monitoring and a deliberate privacy/retention policy. Choose durable hosted storage rather than an ephemeral server filesystem.
7. Switch configuration and repositories, invalidate sessions, test the hosted journey, and retain the protected read only local snapshot for rollback. Roll back before accepting new hosted writes if verification fails; after hosted writes begin, a rollback requires data reconciliation, not simply pointing at old SQLite.

Keep SQLite for local development if integration tests also exercise PostgreSQL's real semantics. Do not assume copying a SQLite file into a hosting filesystem or changing an ORM provider migrates data. In the first hosted version, cloud storage becomes authoritative; simultaneous offline/cloud synchronization is a separate feature with conflict rules and is not bundled into this migration.

## 29 Acceptance criteria and source traceability

The board should receive a working repository, complete content package, setup documentation, test evidence and a successful live demonstration. The following checklist is the release gate.

| ID | Acceptance criterion | Evidence required |
| --- | --- | --- |
| A01 | A new user registers with email/password and then logs in | Demonstration and end to end test |
| A02 | Duplicate canonical emails are rejected, including case variants and concurrent requests | Integration test |
| A03 | Passwords are hashed; hashes/tokens are absent from browser data and logs | Schema/data inspection and response checks |
| A04 | Login/logout, expiration and password change/recovery behave as specified | Auth tests and local recovery demonstration |
| A05 | Two users have separate progress, notes, evidence, scorecards and activity | UI and direct unauthorized API tests |
| A06 | Six phases, 26 weeks and all 182 days follow the original order | Content audit report and course tree inspection |
| A07 | Every study direction, topic, task, AI rule and completion criterion is accessible in its intended context | Exact text/provenance comparison and rendered route audit |
| A08 | All 548 task lines, seven preparation tasks, seven appendices and 14 scorecard dimensions are present | Automated count and text checks, manual guide/table review |
| A09 | All 19 original hyperlink uses and 12 distinct original URLs are preserved; unlinked mentions remain visible | Resource registry and source mapping comparison |
| A10 | A lesson and exercise can be completed independently; day completion follows required units | Behavior tests and demonstration |
| A11 | Optional/conditional/alternative work follows source meaning, including Day 125 | Table driven tests and targeted demo |
| A12 | External resource clicks do not complete anything automatically | UI test |
| A13 | Saved progress and notes survive browser close, server restart and computer restart | Critical journey test and manual reboot smoke test |
| A14 | Continue Learning returns to the correct saved lesson/exercise and section; reference browsing does not hijack it | Resolver tests and restarted journey |
| A15 | Completed work remains complete when revisited; explicit reopen updates every affected total | Integration/UI tests |
| A16 | Course and module percentages equal required completed units, with no early 100 percent | Exact denominator and rounding tests |
| A17 | Failed checkpoints stay incomplete and show original criteria and remediation | Day 7/28 and generic checkpoint tests |
| A18 | Failed/duplicate/conflicting saves cannot falsely claim success or double count | Failure injection and retry tests |
| A19 | Search finds titles, exercises, topics, resources and guides, including Serbian diacritics | Search tests with complete content |
| A20 | Major pages work on desktop/tablet/mobile with keyboard and screen reader | Viewport matrix and manual accessibility evidence |
| A21 | No cloud services are needed for local account/progress operation; bundled content works without internet | Disconnected network demonstration |
| A22 | A clean checkout starts through documented commands; repeated setup preserves users/progress | Fresh directory test, all target OS installation checks |
| A23 | Backup can be restored and retains content, accounts and correct progress | Restore rehearsal; restored sessions invalidated |
| A24 | Content imports are transactional and versioned; existing enrollments are not silently changed | Failed import, repeat seed and release upgrade tests |
| A25 | Full source mapping has no unmapped substantive source records and every mapped destination is reachable | Coverage report plus route verification |
| A26 | No browser code runner, hosted dependency, AI integration or other deferred feature is required for completion | Scope inspection |

### How the mapping proves coverage

`source-to-website.csv` contains source locator, enclosing heading, table/row/cell where relevant, module/week/day context, content role, website route, exact source text and every hyperlink label/target. `curriculum-audit.html` lets reviewers search that mapping and inspect all 182 days in full. `curriculum-source.json` includes the same mapping and raw source archive so the importer can verify text and link identity automatically.

| Source location | Example destination | Mapping meaning |
| --- | --- | --- |
| p0001 to p0005 | Course introduction and source details | Title, purpose, original dates and core principle |
| p0008 to p0052 | Guide on how to study | Usage rules, daily blocks and problem solving ritual |
| p0053 to p0077 | AI protocol guide and contextual help | AI rules, hint ladder and eight prompt templates |
| p0078 to p0117 | Resource library and resource details | Original twelve resource entries with usage notes |
| p0118 to p0126 | Preparation | Seven setup items and pacing guidance |
| p0128 to p0263 | Roadmap and each week overview | All 26 roadmap rows, phases, focus and evidence |
| p0274 | Day 1 study lesson | Exact reading assignment |
| p0276 to p0279 | Day 1 exercise tasks 1 to 4 | Repo setup, FizzBuzz, sumTo and reflection all preserved |
| p0280 and p0281 | Day 1 AI policy and completion panel | No AI baseline and original completion criterion |
| p0337 to p0341 | Day 7 checkpoint | Tasks, allowed postattempt review, score threshold and remediation |
| p1606 to p1610 | Day 125 exercise and source note | Optional language path plus explicit product resolution |
| p2220 to p2225 | Day 182 final exam and retrospective | All timed tasks, AI rule and completion criterion |
| p2227 to p2355 | Handbook Appendices A to G and Scorecard | All templates, rules, rubric values and next steps |
| p2356 to p2364 | Source status and learning outcome guide | Source dated assertions, repeated citations and closing principle |
| Header/footer | Source metadata | Original document identity and period, with page furniture retained as metadata |

This table is an orientation to the exhaustive mapping, not a substitute for it. The source audit counts and preservation checks in this handoff are verified; student facing route existence is an implementation acceptance test and has not yet been run against an application. The supplied SQL is a tested reference schema, not proof that authentication or UI code has been implemented.

## 30 Instructions to the Senior Full-Stack Engineer

Build the Programming Learning Platform specified in this handoff. Deliver a locally runnable single Next.js App Router application using React, TypeScript strict mode, Node.js, SQLite, Drizzle with better-sqlite3, Tailwind CSS, Zod, Argon2id password hashing and opaque server side sessions. Pin and document a tested stable runtime/dependency set. No cloud infrastructure is required for MVP.

Implement registration, login/logout, private profiles, course orientation/preparation, dashboard, course/module/week/day navigation, lesson and exercise pages, resources, simple search, notes, checkpoints, the original scorecard and durable progress. Every published day is available; the recommended path follows original order. Exercises run in the student's local IDE and completion is self reported with task confirmation, evidence and the original daily criterion.

Import the complete supplied curriculum, preserving six phases, 26 weeks, 182 days, 548 task lines, all supporting guides and every source resource/link occurrence. Use one required study lesson and one required exercise bundle per day in the initial release. Preserve the Serbian Latin curriculum and all source conditions. The JSON/Markdown authoring package is versioned; the database is its runtime copy. Published releases are immutable and each enrollment pins a release. Use the exhaustive source mapping and exact text/link checks to prove nothing was lost or hidden from the student interface.

Follow the reference schema and enforce its documented semantic invariants. Store accounts, content, notes and progress in the SQLite file outside public/build directories. Keep auth, application services, pure completion/resume rules and database repositories separate. All reads/writes must enforce session identity and ownership. Never put passwords, hashes or session credentials in LocalStorage, client bundles or logs.

Calculate progress from required lesson/exercise units, initially 364, without double counting days, tasks or resource clicks. Derive day/module/course completion and percentages from canonical records. Persist task checks and notes immediately, confirm saves only after commit, use idempotency/revision checks and implement the exact Continue Learning rules. Revisiting does not reset completion; explicit reopening recalculates totals. Restarting the application or computer must preserve all confirmed records.

Deliver responsive, accessible pages with clear next actions, visible saved/unsaved states, readable code, unobtrusive progress and the original AI/checkpoint guidance. Exclude code execution, automatic grading, AI tutoring, cloud sync, social features, certificates and an admin CMS from MVP.

Provide cross platform setup, migration, complete seed, backup/restore, local password recovery and README instructions. Verify the register → login → study → exercise → close → restart → login → preserved progress → correct Continue journey, two user isolation, source coverage, all progress rules, accessibility and mobile layouts. Definition of Done is all A01 through A26 acceptance criteria passed with evidence, a clean documented installation, a successful restore rehearsal, complete curriculum fidelity and no unresolved critical security, data loss or core journey defects.
