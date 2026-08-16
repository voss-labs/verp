# VERP

Open-source ERP for Vidyalankar Institute of Technology. Built and maintained by [VOSS Labs](https://vosslabs.org).

VERP handles the core academic operations of the college: student records, faculty management, course offerings, marks entry, attendance tracking, and departmental administration.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL on [Neon](https://neon.tech)
- **ORM**: Drizzle ORM
- **Auth**: VOSS OIDC via Better Auth (VERP holds no credentials)
- **Styling**: Tailwind CSS 4, shadcn/ui
- **Validation**: Zod

## Getting Started

### Contributing? Start here

```bash
git clone https://github.com/voss-labs/verp.git
cd verp
npm install
npm run dev:setup
npm run dev
```

One command, a Postgres container, and a college's worth of mock data. No Neon
account and no VOSS credentials: you pick who you are — super-admin, HOD,
coordinator, teacher, student — from a switcher in the sidebar, and every
permission is still resolved from the database exactly as in production.

Needs Docker running ([OrbStack](https://orbstack.dev) works and is lighter on
a Mac). Full detail, including why this cannot reach production, is in
[docs/local-dev.md](docs/local-dev.md).

### Prerequisites

- Node.js 20+ (required by Next 16 / React 19)
- Docker, for the local database
- Or, to run against a hosted database instead: a [Neon](https://neon.tech)
  project and a VOSS client

### Setting up a hosted database

For a fresh Neon project:

```bash
npx drizzle-kit push   # creates the schema from src/db/schema
npm run db:migrate     # applies the SQL migrations on top
```

`drizzle-kit push` truncates a table when it has to add a unique constraint to
one that already holds rows. It asks first, but `--force` does not answer that
prompt — so never point `db:push` at a database with data you need without
reading what it says.

### Setup against a hosted database

```bash
git clone https://github.com/voss-labs/verp.git
cd verp
npm install
npm run setup
```

`npm run setup` runs an interactive wizard (Voss) that:

1. Walks you through creating a Neon project (region pick, pooled vs direct URL guidance)
2. Generates `BETTER_AUTH_SECRET` and writes `.env.local`
3. Inspects the database (warns if it's not empty and not a previous verp install)
4. Runs schema push + SQL migrations
5. Seeds roster rows -- faculty and students -- that a VOSS sign-in later binds to. It creates no accounts and sets no passwords, because VERP has none to set

Re-run any time -- it's idempotent. Pass `--ci` (or set `CI=true`) to skip prompts in non-interactive environments.

When the wizard finishes it offers to start the dev server. Otherwise:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

#### Manual setup (advanced)

If you'd rather configure things by hand:

```bash
cp .env.example .env.local        # then edit values
npm run db:push
npm run db:migrate
npm run dev
```

Required env vars:

- `DATABASE_URL` -- pooled Neon connection string (used by the app)
- `DIRECT_URL` -- direct Neon connection string (used by migrations)
- `BETTER_AUTH_SECRET` -- a random secret (`openssl rand -base64 32`)
- `BETTER_AUTH_URL` -- `http://localhost:3000` for local dev

## Authentication

VERP holds no credentials. [VOSS](https://accounts.vosslabs.org) is the identity
provider and the only way in; Better Auth runs here as the relying party, signing
VERP's own session cookie and the PKCE/state cookies for the OAuth handshake.

There is no password to reset, no email to verify, and no sign-up form. Adding
one would mean two doors into the same account with only one of them watched.

**Signing in has two halves.** VOSS answers _who you are_ -- a one-time code to
the real mailbox is the login, and the @vit.edu.in gate is enforced there. VERP
then answers _who that is here_, by matching the verified email to a roster row:

| Match                              | Result                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| A `faculty` row                    | that row's tier -- `super_admin`, `hod`, or `faculty`           |
| A `students` row                   | the `student` tier, scoped to their own record                  |
| An address in `SUPER_ADMIN_EMAILS` | `super_admin`, with or without a faculty row                    |
| Nothing                            | no tier; the account lands on `/unclaimed` to request placement |

That last row is the bootstrap seam: `SUPER_ADMIN_EMAILS` is how the first
administrator gets in on an empty database, since nobody is on a roster yet.

Binding runs on **every** sign-in, not only the first, so a student who signed in
before their TR imported them is linked the next time they return rather than
being stuck.

### Capability and scope are separate

Capability answers _may this tier do X at all_ -- `marks:write`, `audit:read`,
one of 35 in the `Capability` union. Scope answers _on whose records_ -- an
HOD's department codes, a coordinator's class ids, a student's own id. Both must
pass. A teacher holding `marks:write` still cannot touch a class they are not
assigned to, and a capability is never a scope.

Defaults live in code (`src/lib/rbac.ts`) and a super-admin can grant or revoke
over them per role or per user from `/dashboard/admin/roles`. `super_admin` is a
wildcard that no override can reduce -- a permissions console that could lock out
the only person able to fix it is a trap.

## Project Structure

```
src/
  app/              Next.js pages and API routes
    api/            HTTP routes (auth callback, session, importers)
    dashboard/      Protected dashboard pages
    login/          Login page
  components/       React components
    ui/             shadcn/ui primitives
    columns/        Data table column definitions
  db/
    schema/         Drizzle ORM table definitions
    queries/        Database query functions (organized by domain)
    migrations/     SQL migration files
  lib/              Utilities (auth, session, API helpers)
  hooks/            React hooks
```

## Database

Schema is defined in `src/db/schema/` using Drizzle ORM. Queries are organized by domain in `src/db/queries/`.

**Key commands:**

| Command                     | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| `npm run db:push`           | Push schema changes to database (see the warning above) |
| `npm run db:migrate`        | Run pending SQL migrations                              |
| `npm run db:migrate:status` | Check migration status                                  |
| `npm run db:generate`       | Generate new migration from schema changes              |
| `npm run db:studio`         | Open Drizzle Studio (visual DB browser)                 |
| `npm run db:setup`          | Full setup (push + migrate)                             |

## Scripts

| Command             | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev:setup` | Local Postgres container, schema and mock data — start here |
| `npm run dev:seed`  | Rewrite the mock data                                       |
| `npm run dev:down`  | Stop the container, keep its data                           |
| `npm run dev:reset` | Destroy the container and its data, then set up again       |
| `npm run setup`     | Interactive wizard for a hosted database (Neon + VOSS)      |
| `npm run dev`       | Start dev server with Turbopack                             |
| `npm run build`     | Production build                                            |
| `npm run lint`      | Run ESLint                                                  |
| `npm run typecheck` | Run TypeScript type checking                                |
| `npm run format`    | Format code with Prettier                                   |
| `npm run check`     | Run typecheck + lint + format check                         |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and contribution guidelines.

## License

[MIT](./LICENSE)
