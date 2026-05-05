# Changelog

All notable changes to VERP are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every release credits the contributors whose pull requests shipped in that cycle. If you contributed and your handle is missing, open a PR against this file — we want the record straight.

## [Unreleased]

First wave of community contributions. Five pull requests landed in this cycle, every one of them from a first-time contributor.

### Added

- Dark mode support across the dashboard — `next-themes` provider wired into the root layout with a sun / moon toggle in the site header; the existing palette already used semantic tokens, so the rollout is theme-aware out of the box. ([#36](https://github.com/voss-labs/verp/pull/36) by [@jimmyorpheus](https://github.com/jimmyorpheus))
- 404 and error pages — root `not-found.tsx`, root `error.tsx` boundary that surfaces `error.digest` for production bug reports, plus a dashboard-scoped `not-found.tsx` and a `[...missing]` catch-all so unmatched dashboard URLs keep the sidebar chrome. ([#34](https://github.com/voss-labs/verp/pull/34) by [@OTWL](https://github.com/OTWL))
- CSV / XLSX export on the Students, Faculty, Courses, Attendance, and Audit Log pages — exports honour active filters and the user's current sort order, with styled XLSX output via `exceljs`. ([#37](https://github.com/voss-labs/verp/pull/37) by [@Aniket-Saw](https://github.com/Aniket-Saw))
- Global search across the Students, Faculty, Courses, and Attendance tables — one input filters by every visible column simultaneously. ([#37](https://github.com/voss-labs/verp/pull/37) by [@Aniket-Saw](https://github.com/Aniket-Saw))
- REST API reference at `docs/api.md` — every endpoint, role requirement, request / response shape, and error code in one place. ([#35](https://github.com/voss-labs/verp/pull/35) by [@Synergy738](https://github.com/Synergy738))

### Fixed

- Windows compatibility for `npm run setup` — `start`, `npm`, and `npx` invocations all work via the platform's shell, and migration `0008_fix_marks_locks_user_ref` is idempotent for fresh databases (uses `IF EXISTS` / `IF NOT EXISTS` guards). The wizard now completes end-to-end on Windows. ([#39](https://github.com/voss-labs/verp/pull/39) by [@Mandar885](https://github.com/Mandar885))

### Contributors

Every contributor in this cycle is a first-time contributor to VERP. Thank you for shipping with us.

- [@Synergy738](https://github.com/Synergy738) — Blu Dennis ([#35](https://github.com/voss-labs/verp/pull/35))
- [@Mandar885](https://github.com/Mandar885) — Mandar Patil ([#39](https://github.com/voss-labs/verp/pull/39))
- [@jimmyorpheus](https://github.com/jimmyorpheus) — David Siegers ([#36](https://github.com/voss-labs/verp/pull/36))
- [@OTWL](https://github.com/OTWL) ([#34](https://github.com/voss-labs/verp/pull/34))
- [@Aniket-Saw](https://github.com/Aniket-Saw) ([#37](https://github.com/voss-labs/verp/pull/37))

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
