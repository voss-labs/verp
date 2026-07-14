# Codebase Audit: VERP

## Archetype match
- Matched: frontend-web-app--serverless (Next.js 16 App Router + React 19 + TypeScript strict + Drizzle ORM + Neon Postgres + better-auth + Tailwind 4)
- Signals: `package.json` pins `next@16.1.6`, `react@19.2.3`, `drizzle-orm`, `@neondatabase/serverless`, `better-auth`, `zod`, `tailwindcss@4`, `shadcn`. App Router layout under `src/app`, serverless Neon HTTP driver in `src/db/index.ts`, Next 16 `proxy.ts` (the renamed middleware) for auth gating. 142 TS/TSX source files organized by domain (schema, queries, columns, api). README and stack match the archetype exactly.
- Drift: None in the app itself. The only drift is a stray, uncommitted dependency (`den-agent`, an AI-agent terminal CLI) added to runtime deps — see Blockers. It is not imported anywhere in `src/` or `scripts/`.

## Recent activity
- Recent commits / PRs: Active community project with steady PR flow. Latest merged work: bulk student promotion + graduation (#40, commit `057c983`), export/xlsx functionality (#37), custom 404/error pages (#34), theme provider + dark mode (#36), interactive setup wizard (#39, `dcf65e5`), API docs (#35). Newest merged upstream commit is CSV/Excel bulk student import (#42, `e86c4cb`).
- In flight: Working tree has modified `package.json` and `package-lock.json` — the sole change is the addition of `den-agent@^0.1.2` plus its transitive tree (ink/react-terminal deps like `@alcalzone/ansi-tokenize`). `.preset/` is untracked (this audit run). One open community PR: #43 (student filtering by department/year/division). Local `main` is 1 commit behind `origin/main` (#42 not yet pulled).
- Last session: none (no `.preset/SUMMARY.md`; only `state.json` with project_id and repo_key present).

## Blockers (must fix before new work)
1. HIGH: Uncommitted stray dependency `den-agent@^0.1.2` in `package.json` + `package-lock.json` — this is an unrelated AI-agent CLI (author's own package), pulls a large ink/React-terminal transitive tree into the ERP web app's runtime dependencies, and is imported by zero source files. Revert both files (`git checkout package.json package-lock.json`) to restore a clean working tree before starting any new work. Building on a dirty tree with an accidental dependency risks it being committed and shipped.
2. MEDIUM: Local `main` is 1 commit behind `origin/main` (bulk import #42). Fast-forward (`git pull`) before branching so new work starts from the current tip and avoids a stale-base merge.

## Warnings (should fix soon)
1. Zero automated tests. No `*.test.*` / `*.spec.*` / `__tests__` anywhere, and no test runner in `package.json`. Academically critical, non-trivial logic ships unverified: SGPI/grade computation (`src/lib/sgpi.ts`), bulk promotion/graduation eligibility (`src/app/api/admin/promote/route.ts`, 281 lines), and marks upsert/lock flow (`src/app/api/marks/route.ts`). The only guardrails are typecheck, lint, and `next build` — none of which validate behavior. A regression in grade math would pass CI.
2. Six ESLint warnings (0 errors): unused imports in `src/app/dashboard/audit/client.tsx`, `marks/[offeringId]/client.tsx`, `sgpi/client.tsx`; a `useMemo` dependency warning in `admin/promote/client.tsx:107`; a React-Compiler incompatible-library note on TanStack Table in `data-table.tsx:365`. CONTRIBUTING claims strict standards with no `any` — keep the warning count at zero to hold the bar.
3. `src/db/migrations/` mixes schema DDL with committed seed data (`0004_seed_test_data.sql`, `0006_seed_real_students.sql`). Confirm no real personal data is committed and that seed migrations are gated out of production runs; seeds interleaved with schema migrations can pollute prod on a full migrate.

## Recommendations
- After reverting `den-agent`, if the author genuinely needs an agent-tooling experiment, keep it in a separate repo — it does not belong in VERP's dependency graph.
- Introduce a minimal test setup (Vitest) covering `src/lib/sgpi.ts` and the promotion eligibility logic first; add it to the CI `check` job. This is the highest-leverage guardrail gap.
- CI (`.github/workflows/ci.yml`) is sound (lint + typecheck + format:check + build on PR and push to main). Add the test step once tests exist.
- Positive findings to preserve: consistent per-route auth via `getSessionUser()` with explicit role checks (admin/faculty/student) on every mutating API route; Zod validation at the boundary; standardized `apiSuccess`/`apiError` + `withApiHandler` error wrapping; audit logging on mutations; secrets correctly gitignored (`.env*`), `.env.example` uses placeholders, no secrets or build artifacts tracked; clean domain-partitioned schema/queries; strong docs (README, CONTRIBUTING, `docs/api.md`, CHANGELOG, onboarding).

## Next phase
product-definition
