# Deploys

Production deploys run from `.github/workflows/deploy.yml`, not from Vercel's git
integration. The point is ordering: the schema is migrated first, and the deploy
only happens if that succeeded. A build that would query a table its migration
never created is the failure this exists to prevent — it is the one that took
`/dashboard/imports` down in August 2026.

## What happens on a push to main

1. Migrations are applied to the production database.
2. The ledger is checked against the migration files in the repo.
3. The Vercel deploy hook is called.

If step 1 or 2 fails, step 3 does not run and production stays on the previous
build. Failing closed is deliberate: an old build against an old schema works,
a new build against an old schema does not.

`vercel.json` sets `git.deploymentEnabled.main` to `false` so Vercel does not
also deploy on push. Preview deploys for pull requests are untouched.

## Setup

Two secrets on the `production-database` GitHub environment
(Settings, Environments, `production-database`):

| Secret | Where it comes from |
| --- | --- |
| `PRODUCTION_DATABASE_URL` | The production Postgres connection string |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel project, Settings, Git, Deploy Hooks — create one for `main` |

Until both exist the workflow does nothing and says so in its run summary, so
turning `deploymentEnabled` back to `true` in `vercel.json` restores the old
behaviour at any time.

Add required reviewers on that environment if a deploy should wait for a human.
The secrets are scoped to it, so nothing else in CI can read the production
connection string.

## Pointing at a new database

The workflow migrates; it does not provision. Migrations assume the tables
already exist — `0001` opens with `ALTER TABLE students`, and nothing in
`src/db/migrations` creates the core tables. Those come from the Drizzle schema
in `src/db/schema`, which `drizzle-kit push` builds. The migration files carry
only what a push cannot express: partial unique indexes, check constraints,
backfills.

So an empty database is not something the deploy workflow can bring up. Running
it against one fails on the first statement with `relation "students" does not
exist`, and it fails before the deploy hook, so nothing ships against a database
that is not there.

Bringing up a new one is deliberate and manual, once:

```
DIRECT_URL="<the new unpooled url>" npm run db:setup
```

That pushes the schema, then runs the migrations over it — they are written to
be re-runnable, so replaying them onto a freshly pushed schema is a no-op rather
than a conflict. After that the ledger is populated and the workflow takes over.

`drizzle-kit push` is deliberately not in the workflow. Push computes a diff
against live tables and will happily propose dropping what it cannot see a
reason for; it has already cost this project its migration ledger once. It stays
a thing a person runs, having read what it intends to do.

A new database also starts with no departments, faculty or students, and no way
in. `SUPER_ADMIN_EMAILS` is the bootstrap: an address on that list is
super-admin on first login with no seed data behind it.

## Running migrations without deploying

Run the workflow by hand from the Actions tab. It migrates, checks the ledger,
and deploys the current `main` — which is what you want when the schema is
behind but the code is already shipped.

## When a deploy fails

A failed migration leaves the previous build serving. Fix the migration, push,
and the next run applies it. Migrations are written to be re-runnable, and CI
proves that on every pull request by applying them twice, so a retry is safe.

`npm run db:migrate:status` reports against the wrong table name and will claim
a migrated database has no migrations. Query `_migrations` directly instead.
