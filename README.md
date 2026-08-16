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
5. Lets you create one or more user accounts (admin / HoD / faculty (TR) / student) with hashed passwords seeded directly into the DB

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

## Project Structure

```
src/
  app/              Next.js pages and API routes
    api/            REST endpoints (auth, marks, offerings)
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

| Command                     | Description                                |
| --------------------------- | ------------------------------------------ |
| `npm run db:push`           | Push schema changes to database            |
| `npm run db:migrate`        | Run pending SQL migrations                 |
| `npm run db:migrate:status` | Check migration status                     |
| `npm run db:generate`       | Generate new migration from schema changes |
| `npm run db:studio`         | Open Drizzle Studio (visual DB browser)    |
| `npm run db:setup`          | Full setup (push + migrate)                |

## Scripts

| Command             | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `npm run setup`     | Interactive setup wizard (Neon + .env.local + migrations) |
| `npm run dev`       | Start dev server with Turbopack                           |
| `npm run build`     | Production build                                          |
| `npm run lint`      | Run ESLint                                                |
| `npm run typecheck` | Run TypeScript type checking                              |
| `npm run format`    | Format code with Prettier                                 |
| `npm run check`     | Run typecheck + lint + format check                       |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and contribution guidelines.

## License

[MIT](./LICENSE)
