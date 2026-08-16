# Changelog

All notable changes to VERP are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every release credits the contributors whose pull requests shipped in that cycle. If you contributed and your handle is missing, open a PR against this file — we want the record straight.

## [Unreleased]

First wave of community contributions, alongside the marks and setup work that followed the MVP reset. Every community pull request in this cycle came from a first-time contributor.

### Added

- Local development environment: `npm run dev:setup` starts a Postgres container, applies the schema and seeds a college's worth of mock data — three departments, all four year-cohorts, ~1,700 students — then you pick who you are from a switcher in the sidebar. VERP authenticates through VOSS and a contributor cannot register a VOSS client, so before this the app ran and then redirected them to a login they had no way to complete; the setup instructions were unfollowable through no fault of anyone following them. Only authentication is bypassed: `getSessionUser()` takes four fields from the identity provider and resolves tier, department and class scope and the whole capability set from the database, so becoming the HOD of EXTC does not grant EXTC — it becomes a person whose faculty row says so, and the same queries decide the rest. Measured on the seeded data, the roster each persona can read is 1736 / 509 / 503 / 62 / 0. Three independent locks keep it out of a deployed build, any one of them sufficient: `NODE_ENV` must not be production, `VERP_DEV_AUTH` must be exactly `"1"`, and `next.config.ts` refuses to build or start when both are present. ([#98](https://github.com/voss-labs/verp/pull/98))
- The marks importer says where to go when the subject you need is not in the dropdown. It offered the subjects allocated to you and, when the marksheet in your hand was for a subject nobody had added, said nothing at all. The one hint it did have fired only on a completely empty list and linked to a page the add form had moved off. ([#80](https://github.com/voss-labs/verp/pull/80))

- Attendance recorded per subject, not per day. The register was keyed on (student, date, slot), so two subjects taught in the same slot on the same day collided and the second silently overwrote the first. The subject is part of what identifies a session, so it is now part of the key — as two partial unique indexes rather than one constraint, because Postgres treats NULLs as distinct and a single index over a nullable column would let a class-level register be recorded any number of times. Teachers pick the session at the top of the register; students see attendance per subject, since the 75% rule is enforced per subject and one overall figure hides a subject sitting at 60%. ([#89](https://github.com/voss-labs/verp/pull/89))
- Cmd+K command palette, built from the same `buildNavigation` the sidebar renders. A palette with its own list is a list that will disagree — it would keep offering a page after a capability was revoked and land the user on a Forbidden screen the sidebar had already stopped showing. Ctrl+K too, because the college's lab machines are Windows. ([#92](https://github.com/voss-labs/verp/pull/92))
- Attention inbox on the overview, ranking work by who is stuck rather than by how big the number is. A student waiting on an enrolment decision cannot make progress alone, so that outranks forty missing marks — and the unstaffed class is usually why the marks are missing. Derived from the facts the overview already fetches, so it costs no extra query. ([#93](https://github.com/voss-labs/verp/pull/93))
- Contextual audit history in every record drawer. The activity log answers "what happened today"; this answers "why does this record look like this", which previously meant scrolling thousands of unrelated rows. Bulk actions are logged against a plural target with no id, so a roster import correctly does not appear in each of two hundred students' histories. ([#94](https://github.com/voss-labs/verp/pull/94))
- Shared record drawer wired to the student and faculty tables, with a record-list rendering below the `sm` breakpoint. Inspecting a person meant leaving the table and losing the filters and scroll position; a phone cannot show eight columns, and a horizontally scrolling table hides the columns that matter behind the ones that do not. ([#91](https://github.com/voss-labs/verp/pull/91))
- Permissions console with capability search, a sticky header carrying each tier's headcount, and an impact preview before any revocation — how many active accounts lose the capability the moment it is saved, and that anyone mid-task is refused on their next action. Granting goes straight through: nobody loses work because a switch turned on. Search matches the capability string as well as its label, because somebody arriving from a Forbidden error knows `marks:lock`, not "Lock a marks component". ([#92](https://github.com/voss-labs/verp/pull/92))
- Whole-product redesign against `docs/UI_UX_SPEC.md`, in five phases: the application shell and design tokens ([#82](https://github.com/voss-labs/verp/pull/82)), a role-specific overview that answers "what needs me today" instead of showing everyone the same institution-wide counts ([#83](https://github.com/voss-labs/verp/pull/83)), the academic context trail and tabbed class workspace ([#84](https://github.com/voss-labs/verp/pull/84)), department workspace sections ([#86](https://github.com/voss-labs/verp/pull/86)), and marks publication as a governed state ([#87](https://github.com/voss-labs/verp/pull/87)).
- Marks publication is now a state a coordinator controls. Students previously saw a mark the instant a teacher typed it. Subjects awaiting publication are named rather than hidden, because silence looks like the subject was forgotten. ([#87](https://github.com/voss-labs/verp/pull/87))
- HOD cover authority over attendance and marks. Allocation already let an HOD write any subject in their department and the Subjects page said so, while the capability table redirected them away — the product contradicted itself. An HOD does not routinely take a register, but when a teacher is absent mid-term somebody senior has to finish the work. ([#85](https://github.com/voss-labs/verp/pull/85))
- Subject allocation: an HOD assigns catalogue subjects to teachers, and only the teacher holding a subject for a division may enter its marks. ([#74](https://github.com/voss-labs/verp/pull/74), [#76](https://github.com/voss-labs/verp/pull/76), [#77](https://github.com/voss-labs/verp/pull/77))
- Per-department dashboard. ([#72](https://github.com/voss-labs/verp/pull/72))
- Test coverage for the grading, roll-number, RBAC and syllabus logic — 126 tests. ([#73](https://github.com/voss-labs/verp/pull/73))

- Syllabus PDF import at `/dashboard/dept/courses/import` — an HOD uploads a Scheme & Syllabus PDF and reviews every row before anything is saved. A syllabus states each course twice: the assessment table carries the code, credits and ISA/MSE/ESE split but its name column wraps unreadably, while each course's detail page carries a clean `Course Name:` field and no marks. Both are read and joined on the code. Measured across the four EXCS regulations (R22-R25, 486 pages): 152 courses found, all 152 with self-consistent marks. Names are not treated as one thing — 117 come from a labelled field and arrive pre-selected, 32 are recovered from the table and flagged as suggestions because that recovery agrees with the labelled source only about half the time, and 3 are left blank. A plausible wrong name is worse than an empty one, so nothing uncertain is ever pre-selected. ([#67](https://github.com/voss-labs/verp/pull/67))
- Courses can be created directly in the catalogue. They previously appeared only as a side effect of a TR adding a subject to a class, so an HOD opening an empty catalogue had no way in — the dead end its own empty state described. The class-level path remains as the fallback for a subject nobody catalogued. Uses the same VIT maxima presets as the class form, so a course created either way comes out identical. ([#67](https://github.com/voss-labs/verp/pull/67))

- Marks entry hardened for real submission cycles — ISA, MSE and ESE lock independently, because they are finished at different points in the term and freezing the whole subject when internals go in would block the ESE column for the rest of the semester. Anyone who can enter marks may lock; reopening is the class coordinator's, HOD's or an admin's call. The `marks_locks` table and the `marks:lock` capability had both shipped unused. Grid also exports to CSV and Excel. ([#65](https://github.com/voss-labs/verp/pull/65))
- Student marks history at `/dashboard/my-marks` — per-semester cards with the subject breakdown behind each SGPI, plus CGPA across semesters. Students previously saw one number with no way to see what produced it. ([#66](https://github.com/voss-labs/verp/pull/66))
- Class results console at `/dashboard/class/[classId]/results` — sortable CGPA table with roll/name search, CSV and Excel export, and a per-student breakdown dialog. Roster-first: a student with no marks yet is a blank row rather than an omission, since those are the ones worth chasing. ([#66](https://github.com/voss-labs/verp/pull/66))
- Department course catalogue at `/dashboard/dept/courses` — view, correct and retire subjects. Courses could previously only be created as a side effect of adding a subject to a class, and a typo in a course name was permanent. Retiring is a soft delete: offerings and marks reference the row. ([#66](https://github.com/voss-labs/verp/pull/66))
- Practical batches — a lab of 70 runs as B1/B2/B3 in a room that seats 25. A batch belongs to an offering rather than a class, so a student can sit in B1 for one lab and B2 for another; re-assigning retires the previous batch so nobody is registered for two sessions at once. Theory subjects are excluded. ([#66](https://github.com/voss-labs/verp/pull/66))
- Cohort graduation — `students.graduated_at`, set per cohort from the department page. `expectedYear()` returns null past BE, so a finished cohort previously displayed a raw admission year, indistinguishable from a roll that failed to parse. This is the part of [#40](https://github.com/voss-labs/verp/pull/40) by [@TanishqChavan10](https://github.com/TanishqChavan10) that survives the roll-keyed roster — promotion itself is no longer an action anyone performs, because the cohort advances when the calendar does. ([#66](https://github.com/voss-labs/verp/pull/66))
- Department, Year and Division filters on the Students table — three dropdowns, each showing a live count that narrows as the other filters are applied, with a Clear button once any is set. The filters live on the shared `DataTableView` behind a `facets` prop, so faculty and every future table opt in with one line; counts come from TanStack's faceted row model rather than extra `GROUP BY` queries. Division is now a visible column too — it had always been in the CSV and XLSX exports but never on screen. ([#43](https://github.com/voss-labs/verp/pull/43) by [@Himanshux99](https://github.com/Himanshux99), rebased onto the post-MVP table in [#62](https://github.com/voss-labs/verp/pull/62))
- Dark mode support across the dashboard — `next-themes` provider wired into the root layout with a sun / moon toggle in the site header; the existing palette already used semantic tokens, so the rollout is theme-aware out of the box. ([#36](https://github.com/voss-labs/verp/pull/36) by [@jimmyorpheus](https://github.com/jimmyorpheus))
- 404 and error pages — root `not-found.tsx`, root `error.tsx` boundary that surfaces `error.digest` for production bug reports, plus a dashboard-scoped `not-found.tsx` and a `[...missing]` catch-all so unmatched dashboard URLs keep the sidebar chrome. ([#34](https://github.com/voss-labs/verp/pull/34) by [@OTWL](https://github.com/OTWL))
- CSV / XLSX export on the Students, Faculty, Courses, Attendance, and Audit Log pages — exports honour active filters and the user's current sort order, with styled XLSX output via `exceljs`. ([#37](https://github.com/voss-labs/verp/pull/37) by [@Aniket-Saw](https://github.com/Aniket-Saw))
- Global search across the Students, Faculty, Courses, and Attendance tables — one input filters by every visible column simultaneously. ([#37](https://github.com/voss-labs/verp/pull/37) by [@Aniket-Saw](https://github.com/Aniket-Saw))
- REST API reference at `docs/api.md` — every endpoint, role requirement, request / response shape, and error code in one place. ([#35](https://github.com/voss-labs/verp/pull/35) by [@Synergy738](https://github.com/Synergy738))

### Security

- Every academic write is now scoped to the teacher it was allocated to. Four gaps closed: any teacher on a class could **lock** a colleague's subject (marks entry applied the allocation rule, locking checked only class membership, so a teacher could submit somebody else's marks on their behalf); any teacher could take a **subject register** they did not hold, and was offered every subject on the class to choose from; **every** teacher could approve or reject **enrolment requests**, which is governance rather than teaching and is now the coordinator's with HOD and admin cover; and the **roster importer** admitted any staff account via `isStaff()`, so revoking `student:update` in the permissions console changed nothing — the commit route, the preview route and the page now all require the capability that names what they do. ([#97](https://github.com/voss-labs/verp/pull/97))
- Navigation offered pages that then refused the viewer. An HOD saw "Classes" and was told to ask their HOD, because the page listed class _assignments_ and an HOD holds none; a teacher saw "Course catalogue", which sits behind a layout admitting only HOD and above; the Attendance tab appeared on read access when the register requires write. ([#97](https://github.com/voss-labs/verp/pull/97))

### Fixed

- Results could be published over an empty register. Publication checked that components were _locked_ — which says a teacher considers them finished, not that anybody was marked — so the live EC33T offering was published with 89 students, 89 marks rows and zero of them complete, and every student behind it was shown a finished semester worth no credits. Counting rows is what made it look done: a row exists the moment anyone opens a student. Locking now requires that component complete for every active student on the roster, publishing re-checks the whole set, and the dashboard counts students with every required component rather than rows touched. ([#97](https://github.com/voss-labs/verp/pull/97))
- Marks were written without validation. The number inputs carry min and max, but that is a courtesy to whoever is typing — a crafted request stored a negative mark, or one above the component maximum, and every average computed from it downstream was silently wrong. Payloads are now validated against the course's own maxima and rejected whole, and migration `0006` adds non-negative CHECK constraints. ([#97](https://github.com/voss-labs/verp/pull/97))
- `drizzle-kit push` was dropping the `_migrations` table, because it removes any table not found in the schema and the ledger was not declared in it. Every push wiped the record of which migrations had run, and the next `db:migrate` replayed all six against a database that already had them. Declaring it was not enough on its own: `migrate.ts` creates the table with a constraint Postgres names `_migrations_filename_key`, and an unnamed unique made Drizzle conclude the constraint was missing and ask whether to TRUNCATE the table to add it — a question `--force` does not answer, so a push against any populated database hung on a prompt nobody sees. That same prompt is how `push` empties a table, and is the mechanism behind data lost from `course_offerings` and `marks` during this cycle. ([#102](https://github.com/voss-labs/verp/pull/102))
- `/unclaimed` had returned a 500 since [#82](https://github.com/voss-labs/verp/pull/82). It renders the app sidebar, which reads the signed-in identity from context and throws without a provider, and that page never had one. Nobody hit it because reaching it needs an account VOSS authenticated that VERP cannot place — the dev switcher makes that state one click away, and found a route broken in shipped code that nobody could reach to notice. ([#101](https://github.com/voss-labs/verp/pull/101))
- The dev identity switcher crashed the page on open (`DropdownMenuLabel` is Base UI's `Menu.GroupLabel` and throws outside a `Menu.Group`), and the dev sign-in panel rendered one full viewport below a `min-h-svh` login form — present in the DOM, invisible on screen, which for the only control that lets a contributor in is the same as not existing. ([#101](https://github.com/voss-labs/verp/pull/101))
- `npm run dev:setup` checked whether the target database was local only at its last step, the seeder. Every step before it ran unguarded, and `drizzle-kit push --force` truncates a table to add a unique constraint, so a run against a leftover hosted `.env.local` reached the schema push and stopped politely afterwards with the damage done. The check now runs before anything touches a database. It also reads only `.env.local` no longer: dotenv does not overwrite an exported variable, so a `DATABASE_URL` in the shell beat the file and was the one being pushed to. It now refuses when either source names a remote host, and `--baseline` refuses before opening a connection rather than after. ([#99](https://github.com/voss-labs/verp/pull/99), [#100](https://github.com/voss-labs/verp/pull/100))

- Cross-scope academic writes closed. `saveMarksAction` and `assignBatchAction` mapped every submitted student id straight into the write without intersecting it against the target class roster, and the roster importer checked only that the caller was staff before trusting the department and class on each row. A teacher could attach marks or lab-batch membership to a student in another class, and any faculty member could create students for a department they had nothing to do with. Every academic write now passes through one scope boundary that rejects the whole request rather than dropping the offending rows — a partial write looks successful, so a forged id would leave no trace and a genuine bug would look like data that quietly went missing. ([#81](https://github.com/voss-labs/verp/pull/81))
- Class page returned a 500 in production while typecheck, lint and build all passed: `buttonVariants` was called from a Server Component. The `cva()` call now lives in its own module outside the `"use client"` boundary. ([#78](https://github.com/voss-labs/verp/pull/78))
- Attendance no longer defaults every unmarked student to present — an untouched register would have saved the whole class as attending. An unmarked student is now an explicit state, and only students somebody actually marked are written. The default date is derived in `Asia/Kolkata`; `toISOString()` selected the previous day during early-morning use. ([#89](https://github.com/voss-labs/verp/pull/89))
- One presentation for a subject's result everywhere. Three screens computed total, percentage and grade from their own copy of the logic and had drifted: the overview read `0 / 75` where My marks read `—`, for the same subject on the same day. A partly marked subject now shows its running total labelled provisional — until both MSEs exist their component counts nothing, so the sum is genuinely lower than the student scored, and stating it unqualified would be a lie. ([#90](https://github.com/voss-labs/verp/pull/90))
- Marks entry no longer rewrites a mark on scroll. A wheel over a focused number input changes its value, so scrolling down a class of ninety would silently overwrite whichever mark the pointer crossed with nothing on screen to say so. ([#90](https://github.com/voss-labs/verp/pull/90))
- A teacher who locked a marks component can reopen it, and students can see their component marks. ([#79](https://github.com/voss-labs/verp/pull/79))
- The allocation rule is applied everywhere, not only to marks. ([#75](https://github.com/voss-labs/verp/pull/75))
- Interactive surfaces are reachable without a pointer: 36 accessibility findings across 19 files, down to zero. Most were a label sitting beside its control rather than owning it, which a screen reader reads as an orphaned word and a stray box. A student's own marks row expanded on click alone, with the ▸ glyph announcing "there is more here" to sighted users and nothing to anyone else. The rules are now enforced in CI rather than assumed. ([#95](https://github.com/voss-labs/verp/pull/95))
- Filter dropdowns no longer show the internal `__all` sentinel, and the faculty role filter shows "Super-admin" rather than the stored `super_admin`. ([#91](https://github.com/voss-labs/verp/pull/91))

- Sidebar navigation no longer reloads the whole page. `nav-main` and `nav-secondary` rendered raw `<a href>` rather than `next/link`, so Next's router never saw the click: the browser re-fetched the document and React remounted from scratch on every navigation. They were the only two internal links in the app not already using `Link`, which is why it presented as an app-wide problem. ([#67](https://github.com/voss-labs/verp/pull/67))

- SGPI no longer diluted by subjects that have not been graded yet — every subject's credits went into the denominator including ones with no computable grade, so a term whose ESE had not happened reported an SGPI of 0 rather than "not yet". An ungraded subject now contributes neither credits nor credit points; a fail still contributes its credits, because a fail is a result. This changes the figure previously shown on the student dashboard. ([#66](https://github.com/voss-labs/verp/pull/66))
- Academic year derived from the roll number instead of a stored snapshot — `students.year` was written once at import and never revisited, so 80 of 168 students on the live roster were displaying the year they were imported with, the 2024 cohort reading SE having reached TE. Class labels never had this problem because they compute `expectedYear()` on render; student rows now do the same, folding DSY rolls back to their cohort's start year. ([#66](https://github.com/voss-labs/verp/pull/66))
- One TR per class, not several — `assignClassStaff` now deactivates any existing live TR before inserting the new one, matching the single-coordinator rule the schema already enforced. ([#61](https://github.com/voss-labs/verp/pull/61))
- `npm run setup` and the migration runner restored — the MVP reset removed `scripts/setup.ts`, `src/db/migrate.ts`, `migrate-status.ts` and `db/setup.ts` while every doc still pointed at them, so a fresh clone answered `Missing script: setup`. The wizard is back on the current architecture: it seeds roster rows that a VOSS login binds to rather than password accounts, collects the `VOSS_*` client credentials and `SUPER_ADMIN_EMAILS`, and no longer misreads a `db:push` database as foreign. ([#63](https://github.com/voss-labs/verp/pull/63))
- Windows compatibility for `npm run setup` — `start`, `npm`, and `npx` invocations all work via the platform's shell, and migration `0008_fix_marks_locks_user_ref` is idempotent for fresh databases (uses `IF EXISTS` / `IF NOT EXISTS` guards). The wizard now completes end-to-end on Windows. ([#39](https://github.com/voss-labs/verp/pull/39) by [@Mandar885](https://github.com/Mandar885))

### Contributors

Every contributor in this cycle is a first-time contributor to VERP. Thank you for shipping with us.

- [@Synergy738](https://github.com/Synergy738) — Blu Dennis ([#35](https://github.com/voss-labs/verp/pull/35))
- [@Mandar885](https://github.com/Mandar885) — Mandar Patil ([#39](https://github.com/voss-labs/verp/pull/39))
- [@jimmyorpheus](https://github.com/jimmyorpheus) — David Siegers ([#36](https://github.com/voss-labs/verp/pull/36))
- [@OTWL](https://github.com/OTWL) ([#34](https://github.com/voss-labs/verp/pull/34))
- [@Aniket-Saw](https://github.com/Aniket-Saw) ([#37](https://github.com/voss-labs/verp/pull/37))
- [@Himanshux99](https://github.com/Himanshux99) — Himanshu Choyal ([#43](https://github.com/voss-labs/verp/pull/43))
- [@ManasD2011](https://github.com/ManasD2011) — Manas Deshpande ([#42](https://github.com/voss-labs/verp/pull/42))
- [@TanishqChavan10](https://github.com/TanishqChavan10) — Tanishq Chavan ([#40](https://github.com/voss-labs/verp/pull/40))

---

## [0.3.0] - 2026-04-28

The two-command onboarding release. A new contributor goes from `git clone` to a running local dashboard in two commands: `npm install && npm run setup`.

### Added

- Interactive setup wizard (`scripts/setup.ts`, runnable via `npm run setup`) covering Neon credential capture, secret generation, schema push, migration runner, and an idempotent quick-seed of admin / faculty / student users
- Mascot-driven CLI experience in `scripts/lib/voss.ts` with animated typewriter intro and an ASCII-safe fallback for non-TTY environments
- Reusable wizard helpers split by responsibility:
  - `scripts/lib/env.ts` - `.env.local` read/write plus connection-string validators
  - `scripts/lib/neon-guide.ts` - boxed instructional panels that walk users through the Neon console
  - `scripts/lib/db.ts` - spinner-wrapped database inspection and migration runners
  - `scripts/lib/users.ts` - Better Auth-backed quick-seed of preset accounts
- Setup wizard flag support: `--ci`, `--dry-run`, `--non-interactive`, `--skip-voss`

### Changed

- README rewritten around the new onboarding flow
- CONTRIBUTING.md points new contributors at `npm run setup` instead of manual env wiring

### Contributors

- @harshalmore31

---

## [0.2.1] - 2026-04-08

### Added

- `onboarding.md` walkthrough for new contributors covering repo layout, daily workflow, and how to pick up an issue

### Contributors

- @harshalmore31

---

## [0.2.0] - 2026-04-07

VERP becomes a real open-source project. License, contribution guidelines, issue and PR templates, and CI all land in one cycle.

### Added

- MIT `LICENSE`
- `CONTRIBUTING.md` covering branch workflow, code style, and review expectations
- GitHub issue templates (bug report, feature request) and pull request template
- CI workflow (`.github/workflows/ci.yml`) running typecheck, lint, and format checks on every push and pull request
- Public-facing README covering purpose, tech stack, and getting started

### Changed

- Codebase-wide cleanup pass across 123 files: tightened types, removed dead code, harmonised the page-and-client component pattern used by every dashboard route

### Removed

- `db-guide.md` (1140 lines of internal-only schema notes); schema is now self-documenting via Drizzle definitions in `src/db/schema/`

### Contributors

- @harshalmore31

---

## [0.1.0] - 2026-03-11

The initial scaffold. Vidyalankar Institute ERP built on Next.js 16, Drizzle ORM, PostgreSQL (Neon), Better Auth, Tailwind 4, and shadcn/ui.

### Added

**Platform**

- Next.js 16 App Router scaffold with TypeScript strict mode and Turbopack
- Better Auth email-and-password authentication with session storage in PostgreSQL
- Drizzle ORM schema, migration toolchain, and Neon-backed Postgres
- Tailwind 4 plus shadcn/ui component system
- Role-based access control with `admin`, `faculty`, and `student` roles, hierarchical role definitions, and JSONB permissions ready for fine-grained extension

**Domains**

- Student directory - profile CRUD, division and year tracking, active flag
- Faculty directory - profile CRUD, employee ID, designation
- Department registry
- Course catalogue - course type, credits, and max ISA / MSE / ESE scores
- Course offerings - course, semester, faculty, and division pairing
- Batches and enrollments - batch assignments plus direct student enrollments
- Marks entry - ISA, MSE1, MSE2, ESE bulk upsert
- Marks locks - component-level (ISA / MSE / ESE / all) locking with admin-only unlock
- SGPI calculator computed from marks and credits
- Audit log - every mutation captured with actor, target, and JSONB details
- Dashboard home with section cards and an interactive recharts area chart

**API**

- `POST /api/marks` - bulk upsert with permission and lock checks
- `GET /api/me` - current session profile
- `PATCH /api/offerings/[id]/assign-faculty` - admin-only faculty assignment
- `GET` and `POST /api/offerings/[id]/batches` - batch management
- `POST /api/offerings/[id]/enroll` - student enrollment
- `PATCH /api/offerings/[id]/lock` - marks lock toggle
- Standardised `apiSuccess` and `apiError` response helpers in `src/lib/api-response.ts`

**Database migrations**

- `0001` initial schema
- `0002_academic_schema` - semesters, divisions, departments
- `0003_seed_sem6_courses` - sample course data
- `0004_seed_test_data` - test fixtures
- `0005_assign_admin_role` - bootstrap admin user
- `0006_seed_real_students` - student fixtures
- `0007_audit_logs` - audit table
- `0008_fix_marks_locks_user_ref` - foreign-key correction on `marks_locks`

### Contributors

- @harshalmore31

---

[Unreleased]: https://github.com/voss-labs/verp/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/voss-labs/verp/releases/tag/v0.3.0
[0.2.1]: https://github.com/voss-labs/verp/releases/tag/v0.2.1
[0.2.0]: https://github.com/voss-labs/verp/releases/tag/v0.2.0
[0.1.0]: https://github.com/voss-labs/verp/releases/tag/v0.1.0
