# Changelog

All notable changes to VERP are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every release credits the contributors whose pull requests shipped in that cycle. If you contributed and your handle is missing, open a PR against this file — we want the record straight.

## [Unreleased]

First wave of community contributions, alongside the marks and setup work that followed the MVP reset. Every community pull request in this cycle came from a first-time contributor.

### Added

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

### Fixed

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
